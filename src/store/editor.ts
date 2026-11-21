import { create } from 'zustand';
import { ASPECTS, defaultWheels, makeClip, uid } from '../model/defaults';
import { clipEnd, clipsOnTrack, mainClips, maxClipDuration, mediaById, packMain, projectDuration } from '../model/timeline';
import type { CaptionWord, Clip, MediaAsset, Project, Track, TrackKind } from '../model/types';
import { db } from './db';

const clone = <T,>(v: T): T => structuredClone(v);
const HISTORY = 80;

export type Panel =
  | null | 'media' | 'audio' | 'text' | 'captions' | 'effects' | 'filters' | 'adjust' | 'transition' | 'speed' | 'volume'
  | 'animation' | 'transform' | 'mask' | 'chroma' | 'blend' | 'ai' | 'format' | 'background' | 'export' | 'textEdit'
  | 'keyframes' | 'voice' | 'color' | 'soundtrack' | 'stickers' | 'overlay' | 'crop' | 'captionEdit' | 'settings' | 'record';

interface EditorState {
  project: Project | null;
  past: Project[];
  future: Project[];
  selectedId: string | null;
  time: number;
  playing: boolean;
  zoom: number; // px per second
  panel: Panel;
  toast: { msg: string; kind: 'info' | 'error' | 'ok'; id: number } | null;
  busy: { msg: string; progress?: number } | null;
  dirty: boolean;

  load(p: Project): void;
  close(): void;
  /** Mutate project with history (coalesce: merge with previous history entry when same key within 600ms) */
  edit(fn: (p: Project) => void, coalesce?: string): void;
  undo(): void;
  redo(): void;
  select(id: string | null): void;
  setTime(t: number): void;
  setPlaying(v: boolean): void;
  setZoom(z: number): void;
  openPanel(p: Panel): void;
  notify(msg: string, kind?: 'info' | 'error' | 'ok'): void;
  setBusy(b: { msg: string; progress?: number } | null): void;

  addMedia(assets: MediaAsset[], target: 'main' | 'overlay' | 'audio'): void;
  addText(text?: string, preset?: Partial<Clip>): void;
  splitAtPlayhead(): void;
  deleteSelected(): void;
  duplicateSelected(): void;
  updateClip(id: string, fn: (c: Clip) => void, coalesce?: string): void;
  setCaptions(words: CaptionWord[]): void;
  ensureTrack(kind: TrackKind): string;
  moveClip(id: string, start: number, trackId?: string): void;
  trimClip(id: string, edge: 'start' | 'end', delta: number): void;
  reorderMain(id: string, toIndex: number): void;
  setAspect(aspect: string): void;
}

let lastCoalesce = { key: '', at: 0 };
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(get: () => EditorState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const p = get().project;
    if (!p) return;
    try {
      await db.saveProject({ ...p, updatedAt: Date.now(), thumb: p.thumb ?? p.media.find((m) => m.thumb)?.thumb });
      useEditor.setState({ dirty: false });
    } catch (e) {
      useEditor.getState().notify('Falha ao salvar: ' + (e as Error).message, 'error');
    }
  }, 700);
}

export function flushSave() {
  const p = useEditor.getState().project;
  if (saveTimer) clearTimeout(saveTimer);
  if (p) return db.saveProject({ ...p, updatedAt: Date.now(), thumb: p.thumb ?? p.media.find((m) => m.thumb)?.thumb });
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  past: [],
  future: [],
  selectedId: null,
  time: 0,
  playing: false,
  zoom: 60,
  panel: null,
  toast: null,
  busy: null,
  dirty: false,

  load(p) {
    // migrate older/partial data defensively
    p.tracks = p.tracks?.length ? p.tracks : [{ id: 'main', kind: 'main', name: 'Principal', muted: false, hidden: false, locked: false }];
    p.markers = p.markers ?? [];
    p.media = p.media ?? [];
    p.customLuts = p.customLuts ?? [];
    for (const c of p.clips) {
      c.lut = c.lut ?? null;
      c.wheels = c.wheels ?? defaultWheels();
      c.camera = c.camera ?? null;
    }
    set({ project: p, past: [], future: [], selectedId: null, time: 0, playing: false, panel: null, dirty: false });
  },
  close() {
    flushSave();
    set({ project: null, past: [], future: [], selectedId: null, panel: null, playing: false });
  },

  edit(fn, coalesce) {
    const cur = get().project;
    if (!cur) return;
    const next = clone(cur);
    try { fn(next); } catch (e) { console.error(e); get().notify('Operação falhou: ' + (e as Error).message, 'error'); return; }
    packMain(next);
    // keep the selection valid
    let sel = get().selectedId;
    if (sel && !next.clips.find((c) => c.id === sel)) sel = null;
    const now = Date.now();
    const merge = coalesce && lastCoalesce.key === coalesce && now - lastCoalesce.at < 800;
    lastCoalesce = { key: coalesce ?? '', at: now };
    const past = merge ? get().past : [...get().past, cur].slice(-HISTORY);
    const dur = projectDuration(next);
    set({ project: next, past, future: [], selectedId: sel, dirty: true, time: Math.min(get().time, Math.max(0, dur)) });
    scheduleSave(get);
  },
  undo() {
    const { past, project, future } = get();
    if (!past.length || !project) return;
    const prev = past[past.length - 1];
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future].slice(0, HISTORY), dirty: true });
    lastCoalesce = { key: '', at: 0 };
    if (get().selectedId && !prev.clips.find((c) => c.id === get().selectedId)) set({ selectedId: null });
    scheduleSave(get);
  },
  redo() {
    const { past, project, future } = get();
    if (!future.length || !project) return;
    const nxt = future[0];
    set({ project: nxt, past: [...past, project].slice(-HISTORY), future: future.slice(1), dirty: true });
    lastCoalesce = { key: '', at: 0 };
    if (get().selectedId && !nxt.clips.find((c) => c.id === get().selectedId)) set({ selectedId: null });
    scheduleSave(get);
  },
  select(id) {
    const panel = get().panel;
    // close clip-specific panels when deselecting
    const clipPanels: Panel[] = ['speed', 'volume', 'animation', 'transform', 'mask', 'chroma', 'blend', 'textEdit', 'keyframes', 'voice', 'crop', 'transition'];
    set({ selectedId: id, panel: !id && clipPanels.includes(panel) ? null : panel });
  },
  setTime(t) { set({ time: Math.max(0, t) }); },
  setPlaying(v) { set({ playing: v }); },
  setZoom(z) { set({ zoom: Math.max(8, Math.min(600, z)) }); },
  openPanel(p) { set({ panel: get().panel === p ? null : p }); },
  notify(msg, kind = 'info') { set({ toast: { msg, kind, id: Date.now() } }); },
  setBusy(b) { set({ busy: b }); },

  ensureTrack(kind) {
    const p = get().project!;
    const existing = p.tracks.find((t) => t.kind === kind);
    if (existing) return existing.id;
    const id = uid('t');
    get().edit((d) => {
      const t: Track = { id, kind, name: kind === 'audio' ? 'Áudio' : kind === 'text' ? 'Texto' : 'Sobreposição', muted: false, hidden: false, locked: false };
      d.tracks.push(t);
    });
    return id;
  },

  addMedia(assets, target) {
    const t0 = get().time;
    let firstId: string | null = null;
    get().edit((p) => {
      for (const a of assets) if (!p.media.find((m) => m.id === a.id)) p.media.push(a);
      if (target === 'main') {
        const mains = mainClips(p);
        // insert after the clip under the playhead
        let idx = mains.findIndex((c) => t0 >= c.start && t0 < clipEnd(c));
        idx = idx < 0 ? mains.length : idx + 1;
        let insertAt = idx < mains.length ? mains[idx].start - 0.0005 : (mains.length ? clipEnd(mains[mains.length - 1]) : 0);
        for (const a of assets) {
          if (a.kind === 'audio') continue;
          const c = makeClip(a.kind, 'main', {
            mediaId: a.id, name: a.name, start: insertAt, duration: a.kind === 'image' ? 3 : a.duration,
          });
          if (a.kind === 'image') c.anims.loop = { type: 'zoom-slow', duration: 1 };
          p.clips.push(c);
          insertAt += 0.0001;
          firstId = firstId ?? c.id;
        }
        packMain(p);
        const audios = assets.filter((a) => a.kind === 'audio');
        if (audios.length) addToTrack(p, 'audio', audios, t0);
      } else if (target === 'overlay') {
        firstId = addToTrack(p, 'video', assets.filter((a) => a.kind !== 'audio'), t0) ?? null;
      } else {
        firstId = addToTrack(p, 'audio', assets.filter((a) => a.kind !== 'image'), t0) ?? null;
      }
    });
    if (firstId) set({ selectedId: firstId });
  },

  addText(text = 'Seu texto', preset) {
    const t0 = get().time;
    let id = '';
    get().edit((p) => {
      const trackId = freeTrack(p, 'text', t0, 3);
      const c = makeClip('text', trackId, { start: t0, duration: 3, name: 'Texto', ...preset });
      c.text = { ...c.text!, text, ...(preset?.text ?? {}) };
      c.anims.in = c.anims.in ?? { type: 'pop', duration: 0.4 };
      p.clips.push(c);
      id = c.id;
    });
    set({ selectedId: id, panel: 'textEdit' });
  },

  splitAtPlayhead() {
    const { selectedId, time, project } = get();
    if (!project) return;
    let target = selectedId ? project.clips.find((c) => c.id === selectedId) : undefined;
    if (!target || !(time > target.start + 0.05 && time < clipEnd(target) - 0.05)) {
      target = mainClips(project).find((c) => time > c.start + 0.05 && time < clipEnd(c) - 0.05);
    }
    if (!target) { get().notify('Posicione o cursor sobre um clipe para dividir'); return; }
    const id = target.id;
    let newId = '';
    get().edit((p) => {
      const c = p.clips.find((x) => x.id === id)!;
      const cut = time - c.start;
      const right = clone(c);
      right.id = uid('c');
      right.start = c.start + cut;
      right.duration = c.duration - cut;
      right.in = c.in + cut * c.speed;
      right.transition = null;
      right.anims = { ...right.anims, in: null };
      // shift keyframes
      for (const k of Object.keys(right.keyframes) as (keyof Clip['keyframes'])[]) {
        right.keyframes[k] = right.keyframes[k]!.map((f) => ({ ...f, t: f.t - cut })).filter((f) => f.t >= -0.001);
        c.keyframes[k] = c.keyframes[k]!.filter((f) => f.t <= cut + 0.001);
      }
      c.duration = cut;
      c.anims = { ...c.anims, out: null };
      p.clips.push(right);
      newId = right.id;
    });
    set({ selectedId: newId });
  },

  deleteSelected() {
    const id = get().selectedId;
    if (!id) return;
    get().edit((p) => {
      const i = p.clips.findIndex((c) => c.id === id);
      if (i >= 0) p.clips.splice(i, 1);
      // drop empty non-main tracks
      p.tracks = p.tracks.filter((t) => t.kind === 'main' || p.clips.some((c) => c.trackId === t.id));
    });
    set({ selectedId: null });
  },

  duplicateSelected() {
    const id = get().selectedId;
    if (!id) return;
    let nid = '';
    get().edit((p) => {
      const c = p.clips.find((x) => x.id === id);
      if (!c) return;
      const d = clone(c);
      d.id = uid('c');
      if (c.trackId === 'main') { d.start = clipEnd(c) - 0.0005; d.transition = null; }
      else { d.start = clipEnd(c); d.trackId = freeTrack(p, p.tracks.find((t) => t.id === c.trackId)!.kind, d.start, d.duration, c.trackId); }
      p.clips.push(d);
      nid = d.id;
    });
    set({ selectedId: nid });
  },

  updateClip(id, fn, coalesce) {
    get().edit((p) => {
      const c = p.clips.find((x) => x.id === id);
      if (c) fn(c);
      if (c) {
        const m = mediaById(p, c.mediaId);
        const max = maxClipDuration(c, m);
        if (c.duration > max) c.duration = max;
        c.duration = Math.max(0.1, c.duration);
      }
    }, coalesce);
  },

  setCaptions(words) {
    get().edit((p) => { p.captions.words = words; p.captions.enabled = true; });
  },

  moveClip(id, start, trackId) {
    get().edit((p) => {
      const c = p.clips.find((x) => x.id === id);
      if (!c || c.trackId === 'main') return;
      const tid = trackId ?? c.trackId;
      const others = clipsOnTrack(p, tid).filter((x) => x.id !== id);
      let s = Math.max(0, start);
      // resolve overlap on target track: push to nearest free spot
      const overl = others.find((o) => s < clipEnd(o) - 0.001 && s + c.duration > o.start + 0.001);
      if (overl) {
        const before = overl.start - c.duration, after = clipEnd(overl);
        const free = (pos: number) => pos >= 0 && !others.some((o) => pos < clipEnd(o) - 0.001 && pos + c.duration > o.start + 0.001);
        if (free(after) && (Math.abs(after - s) <= Math.abs(before - s) || !free(before))) s = after;
        else if (free(before)) s = before;
        else { c.trackId = freeTrack(p, p.tracks.find((t) => t.id === tid)!.kind, s, c.duration); c.start = s; return; }
      }
      c.trackId = tid;
      c.start = s;
      p.tracks = p.tracks.filter((t) => t.kind === 'main' || p.clips.some((x) => x.trackId === t.id));
    }, 'move:' + id);
  },

  trimClip(id, edge, delta) {
    get().edit((p) => {
      const c = p.clips.find((x) => x.id === id);
      if (!c) return;
      const m = mediaById(p, c.mediaId);
      const isMedia = c.kind === 'video' || c.kind === 'audio';
      if (edge === 'start') {
        let d = delta;
        if (isMedia) d = Math.max(d, -c.in / c.speed);
        d = Math.min(d, c.duration - 0.1);
        if (c.trackId !== 'main') d = Math.max(d, -c.start);
        if (isMedia) c.in += d * c.speed;
        if (c.trackId !== 'main') c.start += d;
        c.duration -= d;
        for (const k of Object.keys(c.keyframes) as (keyof Clip['keyframes'])[]) c.keyframes[k] = c.keyframes[k]!.map((f) => ({ ...f, t: f.t - d }));
      } else {
        const max = maxClipDuration(c, m);
        c.duration = Math.max(0.1, Math.min(max, c.duration + delta));
      }
    }, 'trim:' + id + edge);
  },

  reorderMain(id, toIndex) {
    get().edit((p) => {
      const mains = mainClips(p);
      const from = mains.findIndex((c) => c.id === id);
      if (from < 0) return;
      const [c] = mains.splice(from, 1);
      mains.splice(Math.max(0, Math.min(mains.length, toIndex)), 0, c);
      let t = 0;
      for (const m of mains) { m.start = t; t += m.duration; }
      // transitions only valid between neighbours; reset moved clip's transition
      c.transition = null;
    });
  },

  setAspect(aspect) {
    const a = ASPECTS.find((x) => x.id === aspect);
    if (!a) return;
    get().edit((p) => { p.aspect = a.id; p.width = a.w; p.height = a.h; });
  },
}));

function freeTrack(p: Project, kind: TrackKind, start: number, dur: number, prefer?: string): string {
  const candidates = p.tracks.filter((t) => t.kind === kind);
  if (prefer) { const pt = candidates.find((t) => t.id === prefer); if (pt) candidates.unshift(pt); }
  for (const t of candidates) {
    const busy = p.clips.some((c) => c.trackId === t.id && start < clipEnd(c) - 0.001 && start + dur > c.start + 0.001);
    if (!busy) return t.id;
  }
  const id = uid('t');
  const n = candidates.length + 1;
  p.tracks.push({ id, kind, name: (kind === 'audio' ? 'Áudio ' : kind === 'text' ? 'Texto ' : 'Sobreposição ') + n, muted: false, hidden: false, locked: false });
  return id;
}

function addToTrack(p: Project, kind: TrackKind, assets: MediaAsset[], t0: number): string | undefined {
  let first: string | undefined;
  let t = t0;
  for (const a of assets) {
    const dur = a.kind === 'image' ? 3 : a.duration;
    const trackId = freeTrack(p, kind, t, dur);
    const c = makeClip(a.kind === 'audio' ? 'audio' : a.kind, trackId, { mediaId: a.id, name: a.name, start: t, duration: dur, fit: 'contain' });
    if (kind === 'video') { c.transform.scale = 0.6; }
    p.clips.push(c);
    first = first ?? c.id;
    t += dur;
  }
  return first;
}

export const selectedClip = (s: EditorState) => s.project?.clips.find((c) => c.id === s.selectedId) ?? null;

// debugging / automated testing hook
if (typeof window !== 'undefined') (window as unknown as { __editor: typeof useEditor }).__editor = useEditor;
