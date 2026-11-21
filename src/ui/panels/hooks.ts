import { clipEnd, mainClips } from '../../model/timeline';
import type { Clip } from '../../model/types';
import { useEditor } from '../../store/editor';

/** The selected clip, or (for look tools) the visual main clip under the playhead. */
export function useTargetClip(allowFallback = true): Clip | null {
  return useEditor((s) => {
    const p = s.project;
    if (!p) return null;
    const sel = p.clips.find((c) => c.id === s.selectedId);
    if (sel) return sel;
    if (!allowFallback) return null;
    const mains = mainClips(p);
    return mains.find((c) => s.time >= c.start && s.time < clipEnd(c)) ?? mains[mains.length - 1] ?? null;
  });
}

export function upd(id: string, fn: (c: Clip) => void, key?: string) {
  useEditor.getState().updateClip(id, fn, key);
}
