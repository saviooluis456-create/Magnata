/** Synthesized instruments for the music generator (work in any BaseAudioContext, incl. OfflineAudioContext). */

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Rng {
  private s: number;
  constructor(seed: number) { this.s = (seed >>> 0) || 1; }
  next() { let t = (this.s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  pick<T>(a: T[]): T { return a[Math.floor(this.next() * a.length)]; }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
}

export interface Bus { drums: AudioNode; bass: AudioNode; music: AudioNode; lead: AudioNode; fx: AudioNode; reverb: AudioNode }

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuf(ctx: BaseAudioContext) {
  let b = noiseCache.get(ctx);
  if (b) return b;
  b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = b.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
  noiseCache.set(ctx, b);
  return b;
}

function env(g: GainNode, t: number, a: number, peak: number, d: number, sus = 0, rel = 0.05, hold = 0) {
  const p = g.gain;
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + Math.max(0.001, a));
  if (hold > 0) {
    p.setTargetAtTime(Math.max(0.0001, peak * sus), t + a, d / 3);
    p.setTargetAtTime(0.0001, t + a + hold, rel / 3);
  } else p.setTargetAtTime(0.0001, t + a, d / 3);
}

function noise(ctx: BaseAudioContext, t: number, dur: number, dest: AudioNode, filterType: BiquadFilterType, freq: number, q: number, vol: number, decay: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf(ctx);
  const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, 0.001, vol, decay);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t, Math.random() * 1.5, dur + 0.1);
}

function tone(ctx: BaseAudioContext, t: number, type: OscillatorType, f0: number, f1: number, glide: number, dest: AudioNode, vol: number, a: number, d: number, dur: number) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + glide);
  const g = ctx.createGain();
  env(g, t, a, vol, d);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}

// ---------------------------------------------------------------- drums
export function kick(ctx: BaseAudioContext, t: number, dest: AudioNode, vel = 1, kind: 'punch' | '808' | 'soft' | 'acoustic' = 'punch') {
  if (kind === '808') { tone(ctx, t, 'sine', 120, 42, 0.12, dest, 1.0 * vel, 0.002, 0.9, 1.0); return; }
  const top = kind === 'soft' ? 110 : kind === 'acoustic' ? 140 : 160;
  tone(ctx, t, 'sine', top, 48, 0.08, dest, 1.0 * vel, 0.001, kind === 'soft' ? 0.25 : 0.35, 0.45);
  noise(ctx, t, 0.02, dest, 'highpass', kind === 'acoustic' ? 1500 : 3000, 0.7, 0.25 * vel, 0.012);
}

export function snare(ctx: BaseAudioContext, t: number, dest: AudioNode, vel = 1, kind: 'tight' | 'fat' | 'lofi' | 'acoustic' = 'tight') {
  const dec = kind === 'fat' ? 0.25 : kind === 'lofi' ? 0.12 : 0.16;
  noise(ctx, t, dec, dest, kind === 'lofi' ? 'bandpass' : 'highpass', kind === 'lofi' ? 2500 : 1600, kind === 'lofi' ? 1.2 : 0.7, 0.55 * vel, dec);
  tone(ctx, t, 'triangle', kind === 'fat' ? 200 : 240, 160, 0.05, dest, 0.45 * vel, 0.001, 0.1, 0.15);
}

export function clap(ctx: BaseAudioContext, t: number, dest: AudioNode, vel = 1) {
  for (let i = 0; i < 3; i++) noise(ctx, t + i * 0.011, 0.05, dest, 'bandpass', 1400, 1.6, 0.45 * vel, 0.03);
  noise(ctx, t + 0.033, 0.25, dest, 'bandpass', 1300, 1.2, 0.4 * vel, 0.18);
}

export function hat(ctx: BaseAudioContext, t: number, dest: AudioNode, vel = 1, open = false) {
  noise(ctx, t, open ? 0.35 : 0.06, dest, 'highpass', 8000, 0.9, (open ? 0.22 : 0.17) * vel, open ? 0.25 : 0.035);
}

export function rim(ctx: BaseAudioContext, t: number, dest: AudioNode, vel = 1) {
  tone(ctx, t, 'square', 1700, 1700, 0, dest, 0.12 * vel, 0.001, 0.03, 0.05);
  noise(ctx, t, 0.02, dest, 'bandpass', 3000, 2, 0.15 * vel, 0.015);
}

export function shaker(ctx: BaseAudioContext, t: number, dest: AudioNode, vel = 1) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 6500; f.Q.value = 1.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1 * vel, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  src.connect(f); f.connect(g); g.connect(dest); src.start(t, Math.random(), 0.15);
}

export function tom(ctx: BaseAudioContext, t: number, dest: AudioNode, pitch = 1, vel = 1) {
  tone(ctx, t, 'sine', 180 * pitch, 90 * pitch, 0.15, dest, 0.7 * vel, 0.002, 0.35, 0.45);
}

export function crash(ctx: BaseAudioContext, t: number, dest: AudioNode, vel = 1) {
  noise(ctx, t, 2.2, dest, 'highpass', 5000, 0.5, 0.25 * vel, 1.6);
  noise(ctx, t, 1.0, dest, 'bandpass', 3500, 0.8, 0.12 * vel, 0.7);
}

// ---------------------------------------------------------------- bass
export function bass(ctx: BaseAudioContext, t: number, midi: number, dur: number, dest: AudioNode, kind: 'sub' | '808' | 'pluck' | 'saw' | 'finger' | 'reese', vel = 1, glideFrom?: number) {
  const f = midiToHz(midi);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  if (kind === '808') {
    o.type = 'sine';
    o.frequency.setValueAtTime(glideFrom ? midiToHz(glideFrom) : f * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(f, t + (glideFrom ? 0.12 : 0.04));
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 256 - 1; curve[i] = Math.tanh(x * 2.5); }
    ws.curve = curve;
    lp.frequency.value = 900;
    env(g, t, 0.003, 0.75 * vel, dur, 0.8, 0.1, dur * 0.9);
    o.connect(ws); ws.connect(lp);
  } else if (kind === 'sub') {
    o.type = 'sine'; o.frequency.value = f; lp.frequency.value = 400;
    env(g, t, 0.01, 0.75 * vel, dur, 0.9, 0.08, dur * 0.9);
    o.connect(lp);
  } else if (kind === 'reese') {
    o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = -12;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f; o2.detune.value = 12; o2.connect(lp); o2.start(t); o2.stop(t + dur + 0.2);
    lp.frequency.value = 500; lp.Q.value = 2;
    env(g, t, 0.01, 0.35 * vel, dur, 0.9, 0.1, dur * 0.9);
    o.connect(lp);
  } else {
    o.type = kind === 'finger' ? 'triangle' : 'sawtooth';
    o.frequency.value = f;
    lp.frequency.setValueAtTime(kind === 'pluck' ? 2200 : kind === 'finger' ? 1400 : 1600, t);
    lp.frequency.exponentialRampToValueAtTime(kind === 'pluck' ? 200 : 450, t + (kind === 'pluck' ? 0.18 : 0.35));
    lp.Q.value = kind === 'pluck' ? 6 : 1.5;
    env(g, t, 0.004, (kind === 'finger' ? 0.7 : 0.45) * vel, dur, kind === 'pluck' ? 0.3 : 0.7, 0.06, dur * 0.85);
    o.connect(lp);
  }
  lp.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.3);
}

// ---------------------------------------------------------------- harmonic instruments
const ksCache = new Map<string, AudioBuffer>();
/** Karplus-Strong plucked string (acoustic guitar / ukulele / harp) */
export function pluckString(ctx: BaseAudioContext, t: number, midi: number, dur: number, dest: AudioNode, vel = 1, bright = 0.5) {
  const f = midiToHz(midi);
  const len = Math.min(4, dur + 1.2);
  const key = `${midi}|${len.toFixed(1)}|${bright}|${ctx.sampleRate}`;
  let buf = ksCache.get(key);
  if (!buf) {
    const sr = ctx.sampleRate, n = Math.floor(sr * len), period = Math.max(2, Math.round(sr / f));
    buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const ring = new Float32Array(period);
    let s = midi * 7919;
    for (let i = 0; i < period; i++) { s = (s * 16807) % 2147483647; ring[i] = (s / 2147483647) * 2 - 1; }
    let idx = 0, prev = 0;
    const damp = 0.996 - (1 - bright) * 0.004;
    for (let i = 0; i < n; i++) {
      const cur = ring[idx];
      const nv = damp * (bright * cur + (1 - bright) * 0.5 * (cur + prev));
      prev = cur; ring[idx] = nv; d[i] = cur;
      idx = (idx + 1) % period;
    }
    if (ksCache.size > 300) ksCache.clear();
    ksCache.set(key, buf);
  }
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); g.gain.value = 0.32 * vel;
  g.gain.setValueAtTime(0.32 * vel, t + dur); g.gain.setTargetAtTime(0.0001, t + dur, 0.15);
  src.connect(g); g.connect(dest); src.start(t);
}

export function piano(ctx: BaseAudioContext, t: number, midi: number, dur: number, dest: AudioNode, vel = 1, kind: 'piano' | 'epiano' | 'bell' | 'organ' = 'piano') {
  const f = midiToHz(midi);
  const partials = kind === 'bell' ? [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.9, 0.1]] : kind === 'organ' ? [[1, 1], [2, 0.6], [3, 0.4], [4, 0.25], [6, 0.15]] : kind === 'epiano' ? [[1, 1], [2, 0.3], [3, 0.08], [14, 0.04]] : [[1, 1], [2, 0.45], [3, 0.2]];
  const out = ctx.createGain(); out.gain.value = (kind === 'organ' ? 0.08 : 0.16) * vel;
  out.connect(dest);
  const decay = kind === 'bell' ? 2.5 : kind === 'epiano' ? 1.6 : kind === 'organ' ? dur : Math.max(0.6, 2.2 - (midi - 48) * 0.02);
  for (const [m, a] of partials) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m * (1 + (m > 1 ? 0.0008 * m : 0));
    const g = ctx.createGain();
    if (kind === 'organ') env(g, t, 0.02, a, 0.1, 1, 0.08, dur);
    else { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a, t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.004, decay / (m * 0.8 + 0.6)); g.gain.setTargetAtTime(0.0001, t + dur, 0.12); }
    if (kind === 'epiano' && m === 1) { const lfo = ctx.createOscillator(); lfo.frequency.value = 5; const lg = ctx.createGain(); lg.gain.value = 0.15; lfo.connect(lg); lg.connect(g.gain); lfo.start(t); lfo.stop(t + dur + 0.5); }
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + Math.min(dur + 0.8, decay * 1.5 + 0.2));
  }
  if (kind === 'piano') noise(ctx, t, 0.02, out, 'bandpass', 2000, 1, 0.08, 0.01);
}

export function pad(ctx: BaseAudioContext, t: number, midis: number[], dur: number, dest: AudioNode, vel = 1, kind: 'warm' | 'strings' | 'dark' | 'airy' | 'choir' = 'warm') {
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.value = kind === 'dark' ? 700 : kind === 'airy' ? 4000 : kind === 'strings' ? 2600 : 1600;
  lp.Q.value = kind === 'choir' ? 4 : 0.7;
  const g = ctx.createGain();
  const att = kind === 'strings' ? 0.35 : kind === 'airy' ? 0.8 : 0.6;
  env(g, t, Math.min(att, dur * 0.4), 0.09 * vel, 0.5, 0.95, Math.min(1.2, dur * 0.5), Math.max(0.05, dur - att));
  lp.connect(g); g.connect(dest);
  for (const m of midis) {
    for (const det of kind === 'strings' ? [-9, 0, 9] : [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = kind === 'choir' ? 'triangle' : 'sawtooth';
      o.frequency.value = midiToHz(m); o.detune.value = det;
      if (kind === 'strings') { const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2 + Math.random(); const lg = ctx.createGain(); lg.gain.value = 6; lfo.connect(lg); lg.connect(o.detune); lfo.start(t); lfo.stop(t + dur + 1.5); }
      o.connect(lp); o.start(t); o.stop(t + dur + 1.5);
    }
  }
}

export function lead(ctx: BaseAudioContext, t: number, midi: number, dur: number, dest: AudioNode, vel = 1, kind: 'square' | 'saw' | 'flute' | 'pluck' | 'whistle' = 'saw') {
  const o = ctx.createOscillator();
  o.type = kind === 'square' ? 'square' : kind === 'flute' || kind === 'whistle' ? 'sine' : 'sawtooth';
  o.frequency.value = midiToHz(midi);
  const vib = ctx.createOscillator(); vib.frequency.value = 5.5; const vg = ctx.createGain(); vg.gain.value = kind === 'flute' || kind === 'whistle' ? 8 : 4;
  vib.connect(vg); vg.connect(o.detune); vib.start(t); vib.stop(t + dur + 0.3);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(kind === 'pluck' ? 4000 : 3000, t);
  if (kind === 'pluck') lp.frequency.exponentialRampToValueAtTime(400, t + 0.25);
  const g = ctx.createGain();
  const vol = (kind === 'square' ? 0.07 : kind === 'flute' || kind === 'whistle' ? 0.16 : 0.08) * vel;
  if (kind === 'pluck') env(g, t, 0.003, vol * 1.6, 0.25); else env(g, t, kind === 'flute' ? 0.06 : 0.01, vol, 0.2, 0.8, 0.12, dur * 0.9);
  o.connect(lp); lp.connect(g); g.connect(dest);
  if (kind === 'flute') noise(ctx, t, dur, g, 'bandpass', midiToHz(midi) * 2, 3, 0.15, dur);
  o.start(t); o.stop(t + dur + 0.4);
}

// ---------------------------------------------------------------- fx
export function riser(ctx: BaseAudioContext, t: number, dur: number, dest: AudioNode, vol = 0.3) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx); src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
  f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(8000, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
  src.connect(f); f.connect(g); g.connect(dest); src.start(t); src.stop(t + dur + 0.1);
  tone(ctx, t, 'sawtooth', 110, 880, dur, dest, vol * 0.15, dur * 0.9, 0.05, dur);
}

export function impact(ctx: BaseAudioContext, t: number, dest: AudioNode, vol = 0.8) {
  tone(ctx, t, 'sine', 90, 30, 0.6, dest, vol, 0.002, 1.2, 1.6);
  noise(ctx, t, 1.5, dest, 'lowpass', 1200, 0.7, vol * 0.6, 0.8);
}

export function vinyl(ctx: BaseAudioContext, t: number, dur: number, dest: AudioNode, vol = 0.04) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx); src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3500; f.Q.value = 0.5;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(dest); src.start(t); src.stop(t + dur);
}

export function makeReverb(ctx: BaseAudioContext, seconds = 2.4) {
  const conv = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let s = 99 + c; for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = ((s / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 3); } }
  conv.buffer = b;
  return conv;
}
