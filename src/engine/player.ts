import { clamp, clipEnd, mainClips, mediaById, projectDuration, sourceTime, trackById, visualClipsAt } from '../model/timeline';
import { clipVolumeAt } from './volume';
import type { Clip, Project } from '../model/types';
import { buildChain, chainKey, type FxChain } from './audioFx';
import { Compositor, type FrameImage, type SourceProvider } from './compositor';
import { audioCtx, ensureUrl, imageIfReady, loadImage, urlOf } from './media';
import { sfxBuffer } from './sfx';
import { Segmenter } from '../ai/segment';

interface VEl {
  el: HTMLVideoElement | HTMLAudioElement;
  clipId: string;
  mediaId: string;
  node: MediaElementAudioSourceNode | null;
  gain: GainNode | null;
  chain: FxChain | null;
  chainKey: string;
  lastFrameTime: number;
  ready: boolean;
  seeking: boolean;
  version: number;
}

const LOOKAHEAD = 2.5; // seconds: preload elements for clips starting soon
const MAX_ELEMENTS = 10;

/** Real-time preview engine: owns media elements, audio graph and the compositor. */
export class Player implements SourceProvider {
  project: Project;
  time = 0;
  playing = false;
  compositor: Compositor;
  private els = new Map<string, VEl>();
  private raf = 0;
  private lastTick = 0;
  private master: GainNode | null = null;
  private sfxPlayed = new Set<string>();
  private sfxNodes: AudioBufferSourceNode[] = [];
  private needsRender = true;
  private segmenter: Segmenter | null = null;
  onTime?: (t: number) => void;
  onEnded?: () => void;
  onError?: (msg: string) => void;
  loopRange: [number, number] | null = null;

  constructor(canvas: HTMLCanvasElement, project: Project) {
    this.project = project;
    this.compositor = new Compositor(canvas);
    this.compositor.onRestored = () => this.invalidate();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  setProject(p: Project) {
    this.project = p;
    this.invalidate();
    if (p.clips.some((c) => c.bgRemove)) this.getSegmenter();
  }

  invalidate() { this.needsRender = true; }

  private getSegmenter() {
    if (!this.segmenter) {
      this.segmenter = new Segmenter();
      this.segmenter.init().then(() => this.invalidate()).catch((e) => this.onError?.('Remover fundo: ' + (e?.message ?? e)));
    }
    return this.segmenter;
  }

  private ensureMaster() {
    if (this.master) return this.master;
    const ctx = audioCtx();
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    return this.master;
  }

  // ------------------------------------------------------------- elements
  private wantedClips(t: number): Clip[] {
    const p = this.project;
    const out = new Map<string, Clip>();
    const consider = (c: Clip) => { if ((c.kind === 'video' || c.kind === 'audio') && c.mediaId) out.set(c.id, c); };
    visualClipsAt(p, t).forEach(consider);
    for (const c of p.clips) {
      if (c.kind !== 'video' && c.kind !== 'audio') continue;
      const tr = trackById(p, c.trackId);
      if (!tr) continue;
      const half = c.transition ? c.transition.duration / 2 : 0;
      const start = c.start - half;
      const end = clipEnd(c) + 0.6;
      if (t >= start - (this.playing ? LOOKAHEAD : 0.2) && t < end) consider(c);
    }
    return [...out.values()];
  }

  private createEl(c: Clip): VEl | null {
    const m = mediaById(this.project, c.mediaId);
    if (!m) return null;
    const url = urlOf(m.id);
    if (!url) { ensureUrl(m.id).then(() => this.invalidate()); return null; }
    const el = m.kind === 'audio' ? document.createElement('audio') : document.createElement('video');
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    (el as HTMLVideoElement).playsInline = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.muted = false;
    (el as unknown as { preservesPitch: boolean }).preservesPitch = false;
    el.src = url;
    const v: VEl = { el, clipId: c.id, mediaId: m.id, node: null, gain: null, chain: null, chainKey: '', lastFrameTime: -1, ready: false, seeking: false, version: 0 };
    el.addEventListener('loadeddata', () => { v.ready = true; this.invalidate(); });
    el.addEventListener('seeked', () => { v.seeking = false; v.version++; this.invalidate(); });
    el.addEventListener('error', () => this.onError?.(`Não foi possível reproduzir ${m.name}`));
    el.load();
    return v;
  }

  private connectAudio(v: VEl, c: Clip) {
    const m = mediaById(this.project, c.mediaId);
    if (!m?.hasAudio) return;
    const ctx = audioCtx();
    const key = chainKey(c.audio);
    try {
      if (!v.node) {
        v.node = ctx.createMediaElementSource(v.el);
        v.gain = ctx.createGain();
      }
      if (v.chainKey !== key) {
        v.node.disconnect();
        v.chain?.output.disconnect();
        v.chain?.oscillators.forEach((o) => { try { o.stop(); } catch { /* */ } });
        v.chain = buildChain(ctx, c.audio);
        v.chain.oscillators.forEach((o) => o.start());
        v.node.connect(v.chain.input);
        v.chain.output.connect(v.gain!);
        v.gain!.disconnect();
        v.gain!.connect(this.ensureMaster());
        v.chainKey = key;
      }
    } catch (e) {
      // createMediaElementSource may fail (e.g., already connected); fall back to element volume
      console.warn(e);
    }
  }

  private releaseEl(id: string) {
    const v = this.els.get(id);
    if (!v) return;
    try { v.el.pause(); } catch { /* */ }
    v.chain?.oscillators.forEach((o) => { try { o.stop(); } catch { /* */ } });
    try { v.node?.disconnect(); v.gain?.disconnect(); v.chain?.output.disconnect(); } catch { /* */ }
    v.el.removeAttribute('src');
    try { v.el.load(); } catch { /* */ }
    this.els.delete(id);
  }

  private syncElements(t: number) {
    const wanted = this.wantedClips(t);
    const wantedIds = new Set(wanted.map((c) => c.id));
    for (const id of [...this.els.keys()]) {
      const v = this.els.get(id)!;
      const c = this.project.clips.find((x) => x.id === id);
      if (!wantedIds.has(id) || !c || c.mediaId !== v.mediaId) this.releaseEl(id);
    }
    // prioritize visible
    for (const c of wanted) {
      if (this.els.size >= MAX_ELEMENTS && !this.els.has(c.id)) break;
      let v = this.els.get(c.id);
      if (!v) { const nv = this.createEl(c); if (!nv) continue; v = nv; this.els.set(c.id, v); }
      this.updateEl(v, c, t);
    }
  }

  private clipVolume(c: Clip, t: number): number {
    return clipVolumeAt(this.project, c, t);
  }

  private updateEl(v: VEl, c: Clip, t: number) {
    const m = mediaById(this.project, c.mediaId);
    const el = v.el;
    const half = c.transition ? c.transition.duration / 2 : 0;
    const active = t >= c.start - half && t < clipEnd(c) + this.nextHalf(c);
    const st = sourceTime(c, t, m);
    const inRange = t >= c.start && t < clipEnd(c);
    this.connectAudio(v, c);
    const vol = active ? this.clipVolume(c, t) : 0;
    if (v.gain) v.gain.gain.setTargetAtTime(Math.min(vol, 4), audioCtx().currentTime, 0.015);
    else el.volume = clamp(vol, 0, 1);

    if (this.playing && inRange) {
      if (Math.abs(el.playbackRate - c.speed) > 0.001) {
        try { el.playbackRate = clamp(c.speed, 0.0625, 16); } catch { /* */ }
      }
      const drift = Math.abs(el.currentTime - st);
      if (drift > 0.25 * Math.max(1, c.speed) && !v.seeking) { v.seeking = true; el.currentTime = st; }
      if (el.paused && v.ready) el.play().catch(() => { /* autoplay */ });
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - st) > 0.02 && !v.seeking && el.readyState >= 1) { v.seeking = true; el.currentTime = st; }
    }
  }

  private nextHalf(c: Clip): number {
    if (c.trackId !== 'main') return 0;
    const mains = mainClips(this.project);
    const i = mains.findIndex((x) => x.id === c.id);
    const n = mains[i + 1];
    return n?.transition ? n.transition.duration / 2 : 0;
  }

  // ------------------------------------------------------------- SourceProvider
  frame(c: Clip): FrameImage | null {
    if (c.kind === 'image' && c.mediaId) {
      const img = imageIfReady(c.mediaId);
      if (!img) { loadImage(c.mediaId).then(() => this.invalidate()).catch(() => {}); return null; }
      const w = (img as ImageBitmap).width || (img as HTMLImageElement).naturalWidth;
      const h = (img as ImageBitmap).height || (img as HTMLImageElement).naturalHeight;
      return { img: img as TexImageSource, w, h, version: img };
    }
    const v = this.els.get(c.id);
    if (!v || !(v.el instanceof HTMLVideoElement)) return null;
    const el = v.el;
    if (el.readyState < 2 || !el.videoWidth) return null;
    // during playback the frame changes constantly -> force upload
    return { img: el, w: el.videoWidth, h: el.videoHeight, version: this.playing ? undefined : `${v.version}:${el.currentTime}` };
  }

  mask(c: Clip): FrameImage | null {
    const seg = this.getSegmenter();
    if (!seg.ready) return null;
    const v = this.els.get(c.id);
    let src: TexImageSource | null = null;
    if (c.kind === 'image' && c.mediaId) src = imageIfReady(c.mediaId) as TexImageSource | null;
    else if (v && v.el instanceof HTMLVideoElement && v.el.readyState >= 2) src = v.el;
    if (!src) return null;
    const m = seg.segment(src as CanvasImageSource, performance.now());
    return m ? { img: m.canvas as TexImageSource, w: m.width, h: m.height, version: undefined } : null;
  }

  // ------------------------------------------------------------- transport
  play() {
    const dur = projectDuration(this.project);
    if (dur <= 0) return;
    if (this.time >= dur - 0.05) this.time = 0;
    const ctx = audioCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    this.ensureMaster();
    this.playing = true;
    this.lastTick = performance.now();
    this.sfxPlayed.clear();
    this.markPastSfx();
    this.syncElements(this.time);
  }

  pause() {
    this.playing = false;
    this.els.forEach((v) => { try { v.el.pause(); } catch { /* */ } });
    this.stopSfx();
    this.invalidate();
  }

  toggle() { if (this.playing) this.pause(); else this.play(); }

  seek(t: number) {
    const dur = projectDuration(this.project);
    this.time = clamp(t, 0, Math.max(0, dur));
    if (this.playing) { this.stopSfx(); this.sfxPlayed.clear(); this.markPastSfx(); }
    this.syncElements(this.time);
    this.invalidate();
  }

  private stopSfx() {
    this.sfxNodes.forEach((n) => { try { n.stop(); } catch { /* */ } });
    this.sfxNodes = [];
  }

  private markPastSfx() {
    for (const c of mainClips(this.project)) {
      if (c.transition?.sound && c.start - c.transition.duration / 2 < this.time - 0.05) this.sfxPlayed.add(c.id + c.transition.sound);
    }
  }

  private scheduleSfx() {
    const ctx = audioCtx();
    for (const c of mainClips(this.project)) {
      const tr = c.transition;
      if (!tr?.sound) continue;
      const key = c.id + tr.sound;
      if (this.sfxPlayed.has(key)) continue;
      const startT = c.start - tr.duration / 2;
      const until = startT - this.time;
      if (until <= 0.12 && until > -tr.duration) {
        this.sfxPlayed.add(key);
        const buf = sfxBuffer(ctx, tr.sound, tr.duration);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.value = tr.soundVolume;
        src.connect(g);
        g.connect(this.ensureMaster());
        const when = ctx.currentTime + Math.max(0, until);
        const offset = Math.max(0, -until);
        src.start(when, Math.min(offset, buf.duration - 0.01));
        src.onended = () => { this.sfxNodes = this.sfxNodes.filter((n) => n !== src); };
        this.sfxNodes.push(src);
      }
    }
  }

  private loop(now: number) {
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    try {
      if (this.playing) {
        const dt = Math.min(0.1, (now - this.lastTick) / 1000);
        this.lastTick = now;
        // follow the main video element clock when possible for tight A/V sync
        let t = this.time + dt;
        const lead = this.leadElementTime();
        if (lead !== null && Math.abs(lead - t) < 0.3) t = t * 0.85 + lead * 0.15;
        this.time = t;
        const dur = projectDuration(this.project);
        if (this.loopRange && this.time >= this.loopRange[1]) this.seek(this.loopRange[0]);
        if (this.time >= dur) {
          this.time = dur;
          this.pause();
          this.onEnded?.();
        } else {
          this.syncElements(this.time);
          this.scheduleSfx();
        }
        this.onTime?.(this.time);
        this.needsRender = true;
      } else {
        // keep paused elements aligned (e.g. after edits)
        if (this.needsRender) this.syncElements(this.time);
      }
      if (this.needsRender) {
        this.needsRender = false;
        this.compositor.render(this.project, this.time, this);
      }
    } catch (e) {
      console.error(e);
    }
  }

  private leadElementTime(): number | null {
    const vis = visualClipsAt(this.project, this.time);
    const c = vis[0];
    if (!c || c.kind !== 'video') return null;
    const v = this.els.get(c.id);
    if (!v || v.el.paused || v.seeking || v.el.readyState < 3) return null;
    const lt = (v.el.currentTime - c.in) / c.speed;
    if (lt < 0 || lt > c.duration) return null;
    return c.start + lt;
  }

  resize(w: number, h: number) {
    this.compositor.resize(w, h);
    this.invalidate();
  }

  /** Renders the current frame and captures it in the same task (WebGL buffer is only valid until compositing). */
  snapshot(type = 'image/png'): Promise<Blob> {
    this.compositor.render(this.project, this.time, this);
    return this.compositor.snapshot(type);
  }

  /** Average luminance of the current frame (diagnostics/tests). */
  luma(): number {
    this.compositor.render(this.project, this.time, this);
    const gl = this.compositor.gl;
    const px = new Uint8Array(4 * 16);
    let sum = 0, n = 0;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      gl.readPixels(Math.floor(((i + 0.5) / 4) * this.compositor.W), Math.floor(((j + 0.5) / 4) * this.compositor.H), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      sum += (px[0] + px[1] + px[2]) / 3; n++;
    }
    return sum / n;
  }

  /** Current video element of a clip (used by AI tools / freeze frame) */
  elementFor(clipId: string) { return this.els.get(clipId)?.el ?? null; }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.stopSfx();
    for (const id of [...this.els.keys()]) this.releaseEl(id);
    this.master?.disconnect();
    this.compositor.dispose();
    this.segmenter?.dispose();
  }
}
