import { clipEnd, mainClips, mediaById } from '../model/timeline';
import type { Project } from '../model/types';
import { buildChain } from './audioFx';
import { decodeAudio } from './media';
import { sfxBuffer } from './sfx';
import { clipVolumeAt } from './volume';

/** Renders the full project audio mix offline (identical processing to preview). */
export async function renderMix(p: Project, from: number, to: number, sampleRate = 48000, onProgress?: (f: number) => void): Promise<AudioBuffer | null> {
  const dur = Math.max(0.05, to - from);
  const length = Math.ceil(dur * sampleRate);
  const OAC = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new OAC(2, length, sampleRate);
  const master = ctx.createGain();
  // gentle limiter so stacked tracks don't clip
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.1;
  master.connect(limiter);
  limiter.connect(ctx.destination);

  const audible = p.clips.filter((c) => (c.kind === 'video' || c.kind === 'audio') && c.mediaId && mediaById(p, c.mediaId)?.hasAudio);
  let done = 0;
  let any = false;
  for (const c of audible) {
    const half = c.transition ? c.transition.duration / 2 : 0;
    const mains = mainClips(p);
    const idx = mains.findIndex((x) => x.id === c.id);
    const nextHalf = idx >= 0 && mains[idx + 1]?.transition ? mains[idx + 1].transition!.duration / 2 : 0;
    const cStart = c.start - (c.trackId === 'main' ? half : 0);
    const cEnd = clipEnd(c) + (c.trackId === 'main' ? nextHalf : 0);
    if (cEnd <= from || cStart >= to) { done++; continue; }
    const buf = await decodeAudio(c.mediaId!);
    done++;
    onProgress?.(done / Math.max(1, audible.length));
    if (!buf) continue;
    any = true;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = c.speed;
    const chain = buildChain(ctx, c.audio);
    chain.oscillators.forEach((o) => o.start(0));
    const gain = ctx.createGain();
    src.connect(chain.input);
    chain.output.connect(gain);
    gain.connect(master);
    // gain automation (20 points per second)
    const a = Math.max(from, cStart), b = Math.min(to, cEnd);
    const step = 0.05;
    gain.gain.setValueAtTime(clipVolumeAt(p, c, a), a - from);
    for (let t = a + step; t <= b + 1e-6; t += step) gain.gain.linearRampToValueAtTime(clipVolumeAt(p, c, Math.min(t, b)), t - from);
    gain.gain.setValueAtTime(0, Math.max(0, b - from));
    // playback: source plays only within [c.start, end] — outside (transition hold) it's silent anyway by gain curve
    const playStart = Math.max(from, c.start);
    const playEnd = Math.min(to, clipEnd(c));
    if (playEnd <= playStart) continue;
    const offset = c.in + (playStart - c.start) * c.speed;
    const when = playStart - from;
    const srcDur = (playEnd - playStart) * c.speed;
    if (offset >= buf.duration) continue;
    src.start(when, offset, Math.min(srcDur, buf.duration - offset));
  }

  // transition sound effects
  for (const c of mainClips(p)) {
    const tr = c.transition;
    if (!tr?.sound) continue;
    const st = c.start - tr.duration / 2;
    if (st + tr.duration <= from || st >= to) continue;
    const buf = sfxBuffer(ctx, tr.sound, tr.duration);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = tr.soundVolume;
    s.connect(g);
    g.connect(master);
    const off = Math.max(0, from - st);
    s.start(Math.max(0, st - from), off);
    any = true;
  }
  if (!any) return null;
  return ctx.startRendering();
}

/** Encode an AudioBuffer into a 16-bit PCM WAV blob */
export function audioBufferToWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length;
  const bytes = 44 + len * ch * 2;
  const ab = new ArrayBuffer(bytes);
  const v = new DataView(ab);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, bytes - 8, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, chans[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Blob([ab], { type: 'audio/wav' });
}
