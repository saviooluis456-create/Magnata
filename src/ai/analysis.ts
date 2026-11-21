/** On-device analysis tools: silence detection, speech regions, beat detection, scene detection, auto-enhance. */
import { ensureUrl } from '../engine/media';
import type { Adjust } from '../model/types';

function rmsWindows(buf: AudioBuffer, from: number, to: number, win = 0.02) {
  const sr = buf.sampleRate;
  const chans = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
  const s0 = Math.max(0, Math.floor(from * sr)), s1 = Math.min(buf.length, Math.floor(to * sr));
  const n = Math.max(1, Math.floor(win * sr));
  const out: number[] = [];
  for (let s = s0; s < s1; s += n) {
    let acc = 0, cnt = 0;
    const e = Math.min(s1, s + n);
    for (let i = s; i < e; i += 2) {
      let v = 0;
      for (const c of chans) v += c[i];
      v /= chans.length;
      acc += v * v; cnt++;
    }
    out.push(Math.sqrt(acc / Math.max(1, cnt)));
  }
  return { values: out, win };
}

const toDb = (v: number) => 20 * Math.log10(Math.max(1e-6, v));

/** Silent ranges (source time) inside [from,to]. thresholdDb relative to the clip's loud level. */
export function silentRanges(buf: AudioBuffer, from: number, to: number, opts: { thresholdDb?: number; minSilence?: number; padding?: number } = {}): [number, number][] {
  const { thresholdDb = -38, minSilence = 0.45, padding = 0.12 } = opts;
  const { values, win } = rmsWindows(buf, from, to);
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * 0.95)] || 1e-3;
  // threshold is relative to the loud (95th percentile) level so it adapts to quiet/loud recordings
  const thr = Math.max(-70, toDb(loud) + thresholdDb * 0.66);
  const ranges: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= values.length; i++) {
    const silent = i < values.length && toDb(values[i]) < thr;
    if (silent && start < 0) start = i;
    if (!silent && start >= 0) {
      const s = from + start * win, e = from + i * win;
      if (e - s >= minSilence) ranges.push([s + padding, e - padding]);
      start = -1;
    }
  }
  return ranges.filter(([s, e]) => e - s > 0.05);
}

export function speechRegions(buf: AudioBuffer): [number, number][] {
  const sil = silentRanges(buf, 0, buf.duration, { minSilence: 0.3, padding: 0.05 });
  const out: [number, number][] = [];
  let t = 0;
  for (const [s, e] of sil) { if (s > t + 0.05) out.push([t, s]); t = e; }
  if (buf.duration > t + 0.05) out.push([t, buf.duration]);
  return out;
}

/** Beat detection via spectral-flux-like energy onsets + tempo estimation. Returns beat times (s) and BPM. */
export function detectBeats(buf: AudioBuffer, from = 0, to = buf.duration): { beats: number[]; bpm: number } {
  const win = 0.0116; // ~512 samples @44.1k
  const { values } = rmsWindows(buf, from, to, win);
  const flux: number[] = values.map((v, i) => Math.max(0, v - (values[i - 1] ?? v)));
  // adaptive threshold
  const W = 20;
  const onsets: number[] = [];
  for (let i = 0; i < flux.length; i++) {
    let m = 0;
    for (let j = Math.max(0, i - W); j < Math.min(flux.length, i + W); j++) m += flux[j];
    m /= 2 * W;
    if (flux[i] > m * 1.6 + 1e-4 && flux[i] >= (flux[i - 1] ?? 0) && flux[i] >= (flux[i + 1] ?? 0)) onsets.push(i);
  }
  // tempo via autocorrelation of onset envelope
  const env = new Float32Array(flux.length);
  onsets.forEach((i) => (env[i] = 1));
  let bestLag = 0, best = 0;
  const minLag = Math.floor(60 / 180 / win), maxLag = Math.floor(60 / 70 / win);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < env.length; i++) s += env[i] * env[i + lag] + 0.5 * env[i] * (env[i + lag - 1] ?? 0) + 0.5 * env[i] * (env[i + lag + 1] ?? 0);
    if (s > best) { best = s; bestLag = lag; }
  }
  const period = bestLag * win;
  const bpm = period > 0 ? Math.round(60 / period) : 0;
  if (!period || onsets.length < 4) return { beats: onsets.map((i) => from + i * win), bpm };
  // phase: align grid to strongest onset cluster
  let bestPhase = 0, bestScore = -1;
  for (let ph = 0; ph < bestLag; ph++) {
    let sc = 0;
    for (let i = ph; i < env.length; i += bestLag) sc += env[i] + 0.5 * ((env[i - 1] ?? 0) + (env[i + 1] ?? 0));
    if (sc > bestScore) { bestScore = sc; bestPhase = ph; }
  }
  const beats: number[] = [];
  for (let t = from + bestPhase * win; t < to; t += period) beats.push(Math.round(t * 1000) / 1000);
  return { beats, bpm };
}

async function openVideo(mediaId: string): Promise<HTMLVideoElement> {
  const url = await ensureUrl(mediaId);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
  v.src = url ?? '';
  await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('Não foi possível abrir o vídeo')); });
  return v;
}

function seekTo(v: HTMLVideoElement, t: number) {
  return new Promise<void>((res) => {
    const to = setTimeout(done, 2000);
    function done() { clearTimeout(to); v.removeEventListener('seeked', done); res(); }
    v.addEventListener('seeked', done);
    v.currentTime = t;
  });
}

/** Scene-change detection by color histogram differences. Returns cut times in source seconds. */
export async function detectScenes(mediaId: string, from: number, to: number, onProgress?: (f: number) => void, sensitivity = 0.5): Promise<number[]> {
  const v = await openVideo(mediaId);
  const c = document.createElement('canvas');
  c.width = 64; c.height = 36;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const step = 1 / 6;
  let prev: Float32Array | null = null;
  const diffs: { t: number; d: number }[] = [];
  for (let t = from; t < to; t += step) {
    await seekTo(v, t);
    ctx.drawImage(v, 0, 0, 64, 36);
    const data = ctx.getImageData(0, 0, 64, 36).data;
    const hist = new Float32Array(48);
    for (let i = 0; i < data.length; i += 4) { hist[data[i] >> 4]++; hist[16 + (data[i + 1] >> 4)]++; hist[32 + (data[i + 2] >> 4)]++; }
    const px = data.length / 4;
    for (let i = 0; i < 48; i++) hist[i] /= px;
    if (prev) { let d = 0; for (let i = 0; i < 48; i++) d += Math.abs(hist[i] - prev[i]); diffs.push({ t, d: d / 6 }); }
    prev = hist;
    onProgress?.((t - from) / Math.max(0.001, to - from));
  }
  v.removeAttribute('src'); v.load();
  if (!diffs.length) return [];
  const mean = diffs.reduce((a, x) => a + x.d, 0) / diffs.length;
  const thr = Math.max(0.12, mean * (2.5 + (1 - sensitivity) * 3));
  const cuts: number[] = [];
  for (const x of diffs) if (x.d > thr && (!cuts.length || x.t - cuts[cuts.length - 1] > 0.6)) cuts.push(x.t);
  return cuts;
}

/** Analyzes sample frames and returns suggested adjustments (auto color/exposure correction). */
export async function autoEnhance(mediaId: string, kind: 'video' | 'image', from: number, to: number): Promise<Partial<Adjust>> {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 96;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const samples: Uint8ClampedArray[] = [];
  if (kind === 'video') {
    const v = await openVideo(mediaId);
    for (let i = 0; i < 5; i++) { await seekTo(v, from + ((to - from) * (i + 0.5)) / 5); ctx.drawImage(v, 0, 0, 96, 96); samples.push(ctx.getImageData(0, 0, 96, 96).data); }
    v.removeAttribute('src'); v.load();
  } else {
    const { loadImage } = await import('../engine/media');
    const img = await loadImage(mediaId);
    ctx.drawImage(img as CanvasImageSource, 0, 0, 96, 96);
    samples.push(ctx.getImageData(0, 0, 96, 96).data);
  }
  let sumL = 0, sumL2 = 0, sumS = 0, sumR = 0, sumB = 0, n = 0;
  const lums: number[] = [];
  for (const d of samples) for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    sumL += l; sumL2 += l * l; sumS += mx - mn; sumR += r; sumB += b; n++;
    lums.push(l);
  }
  const mean = sumL / n, std = Math.sqrt(Math.max(0, sumL2 / n - mean * mean)), sat = sumS / n;
  lums.sort((a, b) => a - b);
  const p05 = lums[Math.floor(lums.length * 0.05)], p95 = lums[Math.floor(lums.length * 0.95)];
  const clampv = (v: number, a = -60, b = 60) => Math.round(Math.max(a, Math.min(b, v)));
  return {
    exposure: clampv((0.48 - mean) * 120, -40, 50),
    contrast: clampv((0.22 - std) * 160, -20, 40),
    saturation: clampv((0.28 - sat) * 90, -20, 35),
    vibrance: 15,
    temperature: clampv(((sumB - sumR) / n) * 120, -30, 30),
    shadows: clampv(p05 < 0.04 ? 18 : 0, 0, 30),
    highlights: clampv(p95 > 0.97 ? -20 : 0, -30, 0),
    sharpen: 12,
  };
}
