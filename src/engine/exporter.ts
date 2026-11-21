import {
  ALL_FORMATS, AudioBufferSource, BlobSource, BufferTarget, CanvasSink, CanvasSource, Input, MovOutputFormat, Mp4OutputFormat, Output,
  WebMOutputFormat, canEncodeAudio, canEncodeVideo, type AudioCodec, type VideoCodec, type WrappedCanvas,
} from 'mediabunny';
import { mediaById, projectDuration, sourceTime, visualClipsAt } from '../model/timeline';
import type { Clip, ExportSettings, Project } from '../model/types';
import { audioBufferToWav, renderMix } from './audioMix';
import { Compositor, type FrameImage, type SourceProvider } from './compositor';
import { preloadFonts } from './fonts';
import { ensureBlob, ensureUrl, loadImage } from './media';
import { Segmenter } from '../ai/segment';

export interface ExportProgress { phase: string; progress: number; fps?: number; eta?: number }

export const RESOLUTIONS = [
  { v: 480, label: '480p', hint: 'Leve' },
  { v: 720, label: '720p', hint: 'HD' },
  { v: 1080, label: '1080p', hint: 'Full HD' },
  { v: 1440, label: '2K', hint: 'QHD' },
  { v: 2160, label: '4K', hint: 'Ultra HD' },
];
export const FPS_OPTIONS = [24, 25, 30, 50, 60];
export const QUALITY_OPTIONS: { v: ExportSettings['quality']; label: string; bpp: number }[] = [
  { v: 'low', label: 'Econômica', bpp: 0.05 },
  { v: 'medium', label: 'Padrão', bpp: 0.08 },
  { v: 'high', label: 'Alta', bpp: 0.12 },
  { v: 'very-high', label: 'Muito alta', bpp: 0.18 },
  { v: 'max', label: 'Máxima', bpp: 0.28 },
];

export function exportDims(p: Project, shortSide: number) {
  const ar = p.width / p.height;
  let w: number, h: number;
  if (ar >= 1) { h = shortSide; w = shortSide * ar; } else { w = shortSide; h = shortSide / ar; }
  // encoders need even dimensions
  return { w: Math.round(w / 2) * 2, h: Math.round(h / 2) * 2 };
}

export function estimateBitrate(s: ExportSettings, w: number, h: number) {
  const bpp = QUALITY_OPTIONS.find((q) => q.v === s.quality)?.bpp ?? 0.1;
  const eff = s.videoCodec === 'avc' ? 1 : 0.7;
  return Math.min(120e6, Math.max(500e3, Math.round(w * h * s.fps * bpp * eff)));
}

export async function supportedCodecs(w: number, h: number, fps: number) {
  const out: Record<string, boolean> = {};
  if (typeof VideoEncoder === 'undefined') return out;
  for (const c of ['avc', 'hevc', 'vp9', 'av1'] as VideoCodec[]) {
    try { out[c] = await canEncodeVideo(c, { width: w, height: h, bitrate: 8e6, frameRate: fps } as never); } catch { out[c] = false; }
  }
  return out;
}

/** Per-clip sequential frame decoder (fast path via WebCodecs; fallback to <video> seeking). */
interface ClipDecoder {
  next(): Promise<FrameImage | null>;
  dispose(): void;
}

async function webcodecsDecoder(blob: Blob, times: number[], maxW: number, maxH: number): Promise<ClipDecoder | null> {
  try {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) return null;
    const dw = track.displayWidth, dh = track.displayHeight;
    const s = Math.min(1, Math.max(maxW / dw, maxH / dh) * 1.15);
    const opts = s < 1 ? { width: Math.round(dw * s / 2) * 2, height: Math.round(dh * s / 2) * 2, fit: 'fill' as const, poolSize: 2 } : { poolSize: 2 };
    const sink = new CanvasSink(track, opts);
    const it = sink.canvasesAtTimestamps(times)[Symbol.asyncIterator]();
    let last: WrappedCanvas | null = null;
    let n = 0;
    return {
      async next() {
        const r = await it.next();
        if (!r.done && r.value) last = r.value;
        if (!last) return null;
        n++;
        return { img: last.canvas as TexImageSource, w: last.canvas.width, h: last.canvas.height, version: n };
      },
      dispose() { it.return?.(undefined); input.dispose?.(); },
    };
  } catch (e) {
    console.warn('webcodecs decode unavailable', e);
    return null;
  }
}

async function elementDecoder(mediaId: string, times: number[]): Promise<ClipDecoder> {
  const url = await ensureUrl(mediaId);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
  v.src = url ?? '';
  await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('vídeo inválido')); setTimeout(res, 8000); });
  let i = 0, n = 0;
  return {
    async next() {
      const t = times[i++] ?? times[times.length - 1] ?? 0;
      if (Math.abs(v.currentTime - t) > 0.001) {
        await new Promise<void>((res) => {
          const to = setTimeout(done, 2500);
          function done() { clearTimeout(to); v.removeEventListener('seeked', done); res(); }
          v.addEventListener('seeked', done);
          v.currentTime = t;
        });
      }
      n++;
      return { img: v, w: v.videoWidth, h: v.videoHeight, version: n };
    },
    dispose() { v.removeAttribute('src'); v.load(); },
  };
}

export class ExportCancelled extends Error { constructor() { super('Exportação cancelada'); } }

export interface ExportResult { blob: Blob; filename: string; warnings: string[]; mime: string }

export async function exportVideo(p: Project, s: ExportSettings, onProgress: (e: ExportProgress) => void, signal: AbortSignal, range?: [number, number]): Promise<ExportResult> {
  const warnings: string[] = [];
  if (typeof VideoEncoder === 'undefined') throw new Error('Este navegador não suporta exportação acelerada (WebCodecs). Use Chrome, Edge ou Safari 16.4+ atualizado.');
  const total = projectDuration(p);
  if (total <= 0) throw new Error('A linha do tempo está vazia');
  const from = range ? Math.max(0, range[0]) : 0;
  const to = range ? Math.min(total, range[1]) : total;
  const { w, h } = exportDims(p, s.resolution);
  const fps = s.fps;
  const frames = Math.max(1, Math.round((to - from) * fps));
  onProgress({ phase: 'Preparando…', progress: 0 });

  // codec negotiation
  let container = s.container;
  let vcodec: VideoCodec = s.videoCodec;
  const bitrate = estimateBitrate(s, w, h);
  const vOk = async (c: VideoCodec) => { try { return await canEncodeVideo(c, { width: w, height: h, bitrate, frameRate: fps } as never); } catch { return false; } };
  if (container === 'webm' && (vcodec === 'avc' || vcodec === 'hevc')) vcodec = 'vp9';
  if (!(await vOk(vcodec))) {
    const order: VideoCodec[] = container === 'webm' ? ['vp9', 'av1', 'vp8'] : ['avc', 'hevc', 'vp9', 'av1'];
    let found: VideoCodec | null = null;
    for (const c of order) if (await vOk(c)) { found = c; break; }
    if (!found) throw new Error(`Seu dispositivo não consegue codificar ${w}x${h} @ ${fps}fps. Tente uma resolução menor.`);
    warnings.push(`Codec ${s.videoCodec.toUpperCase()} indisponível; usando ${found.toUpperCase()}.`);
    vcodec = found;
    if ((vcodec === 'vp9' || vcodec === 'vp8') && container === 'mov') container = 'mp4';
  }

  let acodec: AudioCodec | null = null;
  let audioBuf: AudioBuffer | null = null;
  if (s.includeAudio) {
    onProgress({ phase: 'Mixando áudio…', progress: 0.01 });
    audioBuf = await renderMix(p, from, to, 48000, (f) => onProgress({ phase: 'Mixando áudio…', progress: 0.01 + f * 0.04 }));
    if (signal.aborted) throw new ExportCancelled();
    if (audioBuf) {
      const aOk = async (c: AudioCodec) => { try { return await canEncodeAudio(c, { numberOfChannels: 2, sampleRate: 48000, bitrate: s.audioBitrate } as never); } catch { return false; } };
      const prefs: AudioCodec[] = container === 'webm' ? ['opus', 'vorbis'] : ['aac', 'opus'];
      for (const c of prefs) if (await aOk(c)) { acodec = c; break; }
      if (!acodec && container !== 'webm') {
        container = 'mov';
        acodec = 'pcm-s16';
        warnings.push('AAC indisponível neste navegador: exportado em MOV com áudio PCM sem perdas.');
      }
      if (!acodec) { warnings.push('Codificação de áudio indisponível: vídeo exportado sem som.'); audioBuf = null; }
    }
  }

  // fonts used by text/captions
  const fonts: { family: string; weight: number; italic?: boolean }[] = [];
  p.clips.forEach((c) => c.text && fonts.push({ family: c.text.font, weight: c.text.weight, italic: c.text.italic }));
  if (p.captions.enabled && p.captions.words.length) fonts.push({ family: p.captions.style.font, weight: p.captions.style.weight, italic: p.captions.style.italic });
  await preloadFonts(fonts);

  // precompute per-clip source timestamps
  const clipTimes = new Map<string, number[]>();
  const frameClips: string[][] = [];
  for (let i = 0; i < frames; i++) {
    const t = from + i / fps;
    const ids: string[] = [];
    for (const c of visualClipsAt(p, t)) {
      if (c.kind !== 'video' || !c.mediaId) continue;
      const m = mediaById(p, c.mediaId);
      let arr = clipTimes.get(c.id);
      if (!arr) { arr = []; clipTimes.set(c.id, arr); }
      arr.push(sourceTime(c, t, m));
      ids.push(c.id);
    }
    frameClips.push(ids);
  }

  // decoders
  const decoders = new Map<string, ClipDecoder>();
  const clipById = new Map(p.clips.map((c) => [c.id, c] as [string, Clip]));
  let fallbackUsed = false;
  for (const [id, times] of clipTimes) {
    const c = clipById.get(id)!;
    const blob = await ensureBlob(c.mediaId!);
    if (!blob) throw new Error('Mídia ausente: reimporte o arquivo ' + (mediaById(p, c.mediaId)?.name ?? ''));
    let d = await webcodecsDecoder(blob, times, w, h);
    if (!d) { d = await elementDecoder(c.mediaId!, times); fallbackUsed = true; }
    decoders.set(id, d);
  }
  if (fallbackUsed) warnings.push('Alguns vídeos usaram decodificação de compatibilidade (mais lenta).');
  // images
  for (const c of p.clips) if (c.kind === 'image' && c.mediaId) await loadImage(c.mediaId);
  const images = new Map<string, FrameImage>();
  for (const c of p.clips) {
    if (c.kind !== 'image' || !c.mediaId || images.has(c.mediaId)) continue;
    const img = await loadImage(c.mediaId);
    images.set(c.mediaId, { img: img as TexImageSource, w: (img as ImageBitmap).width || (img as HTMLImageElement).naturalWidth, h: (img as ImageBitmap).height || (img as HTMLImageElement).naturalHeight, version: img });
  }
  let segmenter: Segmenter | null = null;
  if (p.clips.some((c) => c.bgRemove)) {
    onProgress({ phase: 'Carregando IA de recorte…', progress: 0.05 });
    try { segmenter = new Segmenter(); await segmenter.init(); } catch { warnings.push('IA de remover fundo indisponível offline; fundo mantido.'); segmenter = null; }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const comp = new Compositor(canvas, true);
  comp.resize(w, h);
  comp.warmup(p);

  const format = container === 'webm' ? new WebMOutputFormat() : container === 'mov' ? new MovOutputFormat({ fastStart: 'in-memory' }) : new Mp4OutputFormat({ fastStart: 'in-memory' });
  const target = new BufferTarget();
  const output = new Output({ format, target });
  const vsrc = new CanvasSource(canvas, { codec: vcodec, bitrate, keyFrameInterval: 2, latencyMode: 'quality' } as never);
  output.addVideoTrack(vsrc, { frameRate: fps });
  let asrc: AudioBufferSource | null = null;
  if (audioBuf && acodec) {
    asrc = new AudioBufferSource({ codec: acodec, bitrate: s.audioBitrate } as never);
    output.addAudioTrack(asrc);
  }
  await output.start();

  const current = new Map<string, FrameImage>();
  const provider: SourceProvider = {
    frame: (c) => (c.kind === 'image' && c.mediaId ? images.get(c.mediaId) ?? null : current.get(c.id) ?? null),
    mask: (c) => {
      if (!segmenter) return null;
      const f = c.kind === 'image' && c.mediaId ? images.get(c.mediaId) : current.get(c.id);
      if (!f) return null;
      const m = segmenter.segment(f.img as CanvasImageSource, 0, -1);
      return m ? { img: m.canvas as TexImageSource, w: m.width, h: m.height, version: undefined } : null;
    },
  };

  const t0 = performance.now();
  try {
    if (asrc && audioBuf) await asrc.add(audioBuf);
    for (let i = 0; i < frames; i++) {
      if (signal.aborted) throw new ExportCancelled();
      const t = from + i / fps;
      current.clear();
      for (const id of frameClips[i]) {
        const f = await decoders.get(id)!.next();
        if (f) current.set(id, f);
      }
      comp.render(p, t, provider, { quality: 'export' });
      await vsrc.add(i / fps, 1 / fps);
      if (i % 3 === 0 || i === frames - 1) {
        const el = (performance.now() - t0) / 1000;
        const rate = (i + 1) / Math.max(0.001, el);
        onProgress({ phase: 'Renderizando…', progress: 0.06 + 0.9 * ((i + 1) / frames), fps: rate, eta: (frames - i - 1) / rate });
        // yield to keep UI responsive
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    onProgress({ phase: 'Finalizando arquivo…', progress: 0.97 });
    await output.finalize();
  } catch (e) {
    try { await output.cancel(); } catch { /* */ }
    throw e;
  } finally {
    decoders.forEach((d) => d.dispose());
    comp.dispose(true);
    segmenter?.dispose();
  }
  const mime = format.mimeType;
  const blob = new Blob([target.buffer!], { type: mime });
  const safe = p.name.replace(/[^\w\- ]+/g, '').trim() || 'video';
  onProgress({ phase: 'Pronto!', progress: 1 });
  return { blob, filename: `${safe}_${s.resolution}p${fps}${format.fileExtension}`, warnings, mime };
}

/** Export just the mixed audio as WAV */
export async function exportAudioWav(p: Project): Promise<Blob | null> {
  const buf = await renderMix(p, 0, projectDuration(p));
  return buf ? audioBufferToWav(buf) : null;
}

/** Captions as SRT */
export function captionsToSrt(p: Project): string {
  const fmt = (s: number) => {
    const ms = Math.round(s * 1000);
    const hh = Math.floor(ms / 3600000), mm = Math.floor((ms % 3600000) / 60000), ss = Math.floor((ms % 60000) / 1000), mmm = ms % 1000;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(mmm).padStart(3, '0')}`;
  };
  const words = [...p.captions.words].sort((a, b) => a.start - b.start);
  const lines: string[] = [];
  let i = 0, n = 1;
  while (i < words.length) {
    const chunk = words.slice(i, i + Math.max(1, p.captions.style.wordsPerPage * 2));
    lines.push(String(n++), `${fmt(chunk[0].start)} --> ${fmt(chunk[chunk.length - 1].end)}`, chunk.map((w) => w.text).join(' '), '');
    i += chunk.length;
  }
  return lines.join('\n');
}
