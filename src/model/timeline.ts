import type { AnimProp, Clip, Ease, Keyframe, MediaAsset, Project, Track } from './types';

export const EPS = 1e-4;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function ease(e: Ease, t: number): number {
  t = clamp(t, 0, 1);
  switch (e) {
    case 'linear': return t;
    case 'easeIn': return t * t * t;
    case 'easeOut': return 1 - Math.pow(1 - t, 3);
    case 'easeInOut': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'back': { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
    case 'elastic': {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    }
    case 'bounce': {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
    case 'hold': return t < 1 ? 0 : 1;
  }
}

export function evalKeyframes(kfs: Keyframe[] | undefined, t: number, fallback: number): number {
  if (!kfs || kfs.length === 0) return fallback;
  if (kfs.length === 1) return kfs[0].v;
  if (t <= kfs[0].t) return kfs[0].v;
  const last = kfs[kfs.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      const k = span <= EPS ? 1 : (t - a.t) / span;
      return lerp(a.v, b.v, ease(a.ease, k));
    }
  }
  return last.v;
}

export function setKeyframe(kfs: Keyframe[] | undefined, t: number, v: number, e: Ease = 'easeInOut'): Keyframe[] {
  const list = (kfs ?? []).filter((k) => Math.abs(k.t - t) > 0.02);
  list.push({ t, v, ease: e });
  list.sort((a, b) => a.t - b.t);
  return list;
}

export const clipEnd = (c: Clip) => c.start + c.duration;

export function projectDuration(p: Project): number {
  let d = 0;
  for (const c of p.clips) d = Math.max(d, clipEnd(c));
  for (const w of p.captions.words) d = Math.max(d, w.end);
  return d;
}

export const trackById = (p: Project, id: string): Track | undefined => p.tracks.find((t) => t.id === id);
export const mediaById = (p: Project, id: string | null): MediaAsset | undefined =>
  id ? p.media.find((m) => m.id === id) : undefined;

export function clipsOnTrack(p: Project, trackId: string): Clip[] {
  return p.clips.filter((c) => c.trackId === trackId).sort((a, b) => a.start - b.start);
}

export const mainClips = (p: Project) => clipsOnTrack(p, 'main');

/** Pack the magnetic main track: clips sequential from 0 with no gaps. */
export function packMain(p: Project): void {
  let t = 0;
  for (const c of mainClips(p)) {
    c.start = t;
    t += c.duration;
  }
  // sanitize transitions: first clip cannot have a transition; durations limited
  const mains = mainClips(p);
  mains.forEach((c, i) => {
    if (!c.transition) return;
    if (i === 0) { c.transition = null; return; }
    const prev = mains[i - 1];
    const maxD = Math.max(0.1, Math.min(prev.duration, c.duration) * 0.9);
    if (c.transition.duration > maxD) c.transition.duration = maxD;
  });
}

/** Maximum timeline duration a clip may have given its media and speed. */
export function maxClipDuration(c: Clip, m: MediaAsset | undefined): number {
  if (!m || m.kind === 'image' || c.kind === 'text' || c.kind === 'color') return 3600;
  return Math.max(0.05, (m.duration - c.in) / c.speed);
}

export function sourceTime(c: Clip, t: number, m: MediaAsset | undefined): number {
  const lt = clamp(t - c.start, 0, Math.max(0, c.duration - 0.001));
  let st = c.in + lt * c.speed;
  if (m && m.duration > 0) st = clamp(st, 0, Math.max(0, m.duration - 0.04));
  return st;
}

export interface MainLayer {
  clip: Clip;
  /** transition partner, when inside a transition window */
  to?: Clip;
  progress?: number;
}

/** Returns the main-track visual state at time t (single clip or transition pair). */
export function mainAt(p: Project, t: number): MainLayer | null {
  const mains = mainClips(p);
  for (let i = 0; i < mains.length; i++) {
    const c = mains[i];
    const tr = c.transition;
    if (tr && i > 0) {
      const half = tr.duration / 2;
      if (t >= c.start - half && t < c.start + half) {
        return { clip: mains[i - 1], to: c, progress: clamp((t - (c.start - half)) / tr.duration, 0, 1) };
      }
    }
  }
  for (const c of mains) if (t >= c.start - EPS && t < clipEnd(c) - EPS) return { clip: c };
  const last = mains[mains.length - 1];
  if (last && Math.abs(t - clipEnd(last)) < 0.05) return { clip: last };
  return null;
}

/** Overlay clips on a track active at t, considering track order. */
export function overlaysAt(p: Project, t: number): Clip[] {
  const out: Clip[] = [];
  for (const tr of p.tracks) {
    if (tr.kind === 'main' || tr.kind === 'audio' || tr.hidden) continue;
    for (const c of p.clips) {
      if (c.trackId === tr.id && t >= c.start - EPS && t < clipEnd(c) - EPS) out.push(c);
    }
  }
  return out;
}

/** Visible clip ids (and needed source times) at time t, used by both preview and export. */
export function visualClipsAt(p: Project, t: number): Clip[] {
  const res: Clip[] = [];
  const main = trackById(p, 'main');
  if (main && !main.hidden) {
    const m = mainAt(p, t);
    if (m) { res.push(m.clip); if (m.to) res.push(m.to); }
  }
  res.push(...overlaysAt(p, t));
  return res;
}

export function kfValue(c: Clip, prop: AnimProp, t: number, fallback: number): number {
  return evalKeyframes(c.keyframes[prop], t - c.start, fallback);
}

export function formatTime(s: number, withFrac = true): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const f = Math.floor((s % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}${withFrac ? '.' + f : ''}`;
}

export function snapTime(t: number, points: number[], threshold: number): number {
  let best = t, bd = threshold;
  for (const p of points) {
    const d = Math.abs(p - t);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
