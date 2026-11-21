import { clamp, evalKeyframes, mainClips, trackById } from '../model/timeline';
import type { Clip, Project } from '../model/types';

/** Effective linear gain of a clip at timeline time t (volume, keyframes, fades, transition crossfades, mutes). */
export function clipVolumeAt(p: Project, c: Clip, t: number): number {
  const tr = trackById(p, c.trackId);
  if (c.audio.muted || tr?.muted) return 0;
  let vol = evalKeyframes(c.keyframes.volume, t - c.start, c.audio.volume);
  const lt = t - c.start;
  if (c.audio.fadeIn > 0 && lt < c.audio.fadeIn) vol *= clamp(lt / c.audio.fadeIn, 0, 1);
  if (c.audio.fadeOut > 0 && lt > c.duration - c.audio.fadeOut) vol *= clamp((c.duration - lt) / c.audio.fadeOut, 0, 1);
  if (c.trackId === 'main') {
    const mains = mainClips(p);
    const i = mains.findIndex((x) => x.id === c.id);
    const next = mains[i + 1];
    if (c.transition) { const h = c.transition.duration / 2; if (lt < h) vol *= clamp((lt + h) / (2 * h), 0, 1); }
    else if (lt < 0) vol = 0;
    if (next?.transition) { const h = next.transition.duration / 2; const toEnd = c.duration - lt; if (toEnd < h) vol *= clamp((toEnd + h) / (2 * h), 0, 1); }
    else if (lt > c.duration) vol = 0;
  } else if (lt < 0 || lt > c.duration) vol = 0;
  return Math.max(0, vol);
}
