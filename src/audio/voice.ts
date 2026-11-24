/**
 * Voice Studio: offline speech enhancement chain, similar in spirit to podcast "enhance speech" tools.
 *
 * 1. RNNoise (recurrent neural network noise suppression, WebAssembly) at 48 kHz
 * 2. STFT spectral gate (residual stationary noise) + late-reverb suppression (de-reverb)
 * 3. Voice EQ (high-pass, de-mud, presence, air) + de-esser
 * 4. Two-stage compression
 * 5. Loudness normalization (ITU-R BS.1770 / EBU R128 integrated LUFS) + peak limiter
 * 6. Wet/dry "strength" mix (like the intensity slider of enhancement tools)
 */

export interface VoiceSettings {
  denoise: number; // 0..1 ML noise suppression amount
  gate: number; // 0..1 residual spectral noise reduction
  dereverb: number; // 0..1
  deess: number; // 0..1
  eq: 'natural' | 'podcast' | 'radio' | 'warm' | 'bright';
  compress: number; // 0..1
  loudness: number; // target LUFS, e.g. -16
  strength: number; // 0..1 wet/dry
}

export const VOICE_PRESETS: { id: string; name: string; icon: string; hint: string; s: VoiceSettings }[] = [
  { id: 'podcast', name: 'Podcast', icon: '🎙', hint: 'Voz de estúdio, presença e volume padrão', s: { denoise: 1, gate: 0.6, dereverb: 0.5, deess: 0.5, eq: 'podcast', compress: 0.7, loudness: -16, strength: 1 } },
  { id: 'street', name: 'Rua / vento', icon: '🌆', hint: 'Ruído forte de fundo, trânsito, vento', s: { denoise: 1, gate: 0.9, dereverb: 0.3, deess: 0.4, eq: 'podcast', compress: 0.6, loudness: -16, strength: 1 } },
  { id: 'room', name: 'Sala com eco', icon: '🏠', hint: 'Remove reverberação de cômodos vazios', s: { denoise: 0.8, gate: 0.5, dereverb: 0.95, deess: 0.4, eq: 'warm', compress: 0.6, loudness: -16, strength: 1 } },
  { id: 'narration', name: 'Narração', icon: '📖', hint: 'Voz cheia e próxima, ótima para voice-over', s: { denoise: 1, gate: 0.6, dereverb: 0.6, deess: 0.6, eq: 'warm', compress: 0.8, loudness: -16, strength: 1 } },
  { id: 'social', name: 'Redes sociais', icon: '📱', hint: 'Mais alto e brilhante (−14 LUFS)', s: { denoise: 1, gate: 0.6, dereverb: 0.5, deess: 0.6, eq: 'bright', compress: 0.85, loudness: -14, strength: 1 } },
  { id: 'natural', name: 'Natural', icon: '🍃', hint: 'Limpeza leve, preserva o ambiente', s: { denoise: 0.6, gate: 0.3, dereverb: 0.3, deess: 0.3, eq: 'natural', compress: 0.4, loudness: -16, strength: 0.75 } },
];

const SR = 48000;

// ------------------------------------------------------------------ FFT (radix-2, in place)
function fft(re: Float32Array, im: Float32Array, inverse: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

async function toMono48k(buf: AudioBuffer): Promise<Float32Array> {
  const OAC = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new OAC(1, Math.max(1, Math.ceil(buf.duration * SR)), SR);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
  const out = await ctx.startRendering();
  return out.getChannelData(0).slice();
}

// ------------------------------------------------------------------ 1. RNNoise
let rnnoiseP: Promise<{ frameSize: number; createDenoiseState(): { processFrame(f: Float32Array): number; destroy(): void } }> | null = null;
async function rnnoise() {
  if (!rnnoiseP) rnnoiseP = import('@shiguredo/rnnoise-wasm').then((m) => m.Rnnoise.load());
  return rnnoiseP;
}

async function stageRNNoise(x: Float32Array, amount: number, onP: (f: number) => void): Promise<{ y: Float32Array; vad: Float32Array }> {
  const rn = await rnnoise();
  const N = rn.frameSize; // 480 samples @ 48 kHz (10 ms)
  const st = rn.createDenoiseState();
  const frames = Math.ceil(x.length / N);
  const y = new Float32Array(x.length);
  const vad = new Float32Array(frames);
  const f = new Float32Array(N);
  // warm up the recurrent state on the first 300 ms so the beginning isn't left noisy
  for (let w = 0; w < Math.min(30, frames); w++) {
    for (let i = 0; i < N; i++) f[i] = (x[w * N + i] ?? 0) * 32768;
    st.processFrame(f);
  }
  for (let k = 0; k < frames; k++) {
    for (let i = 0; i < N; i++) f[i] = (x[k * N + i] ?? 0) * 32768;
    vad[k] = st.processFrame(f);
    for (let i = 0; i < N && k * N + i < x.length; i++) {
      const den = f[i] / 32768;
      y[k * N + i] = den * amount + x[k * N + i] * (1 - amount);
    }
    if (k % 2000 === 0) { onP(k / frames); await tick(); }
  }
  st.destroy();
  return { y, vad };
}

// ------------------------------------------------------------------ 2. spectral gate + de-reverb
async function stageSpectral(x: Float32Array, vad: Float32Array | null, gate: number, dereverb: number, onP: (f: number) => void): Promise<Float32Array> {
  if (gate <= 0.01 && dereverb <= 0.01) return x;
  const N = 1024, H = 256, bins = N / 2 + 1;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const frames = Math.max(1, Math.ceil((x.length + N) / H));
  // pass 1: magnitudes for noise profile (frames with low voice activity)
  const re = new Float32Array(N), im = new Float32Array(N);
  const quiet: Float32Array[] = [];
  const allMag: Float32Array[] = [];
  const step = Math.max(1, Math.floor(frames / 600));
  for (let k = 0; k < frames; k += step) {
    const off = k * H - N / 2;
    for (let i = 0; i < N; i++) { re[i] = (x[off + i] ?? 0) * win[i]; im[i] = 0; }
    fft(re, im, false);
    const m = new Float32Array(bins);
    for (let b = 0; b < bins; b++) m[b] = Math.hypot(re[b], im[b]);
    allMag.push(m);
    const v = vad ? vad[Math.min(vad.length - 1, Math.floor((k * H) / 480))] : 0;
    if (v < 0.3) quiet.push(m);
  }
  const pool = quiet.length >= 8 ? quiet : allMag;
  const noise = new Float32Array(bins);
  for (let b = 0; b < bins; b++) {
    const vals = pool.map((m) => m[b]).sort((a, c) => a - c);
    noise[b] = vals[Math.floor(vals.length * (quiet.length >= 8 ? 0.5 : 0.15))] ?? 0;
  }
  // pass 2: gains
  const y = new Float32Array(x.length + N);
  const norm = new Float32Array(x.length + N);
  const prevGain = new Float32Array(bins).fill(1);
  const D = Math.round(0.05 * SR / H); // late reverb starts ~50 ms after direct sound
  const hist: Float32Array[] = [];
  const decay = Math.exp((-6.9 * H * D) / (SR * 0.45)); // RT60 ≈ 0.45 s
  const alpha = 1 + gate * 2.5; // over-subtraction
  const floor = 0.06 + (1 - gate) * 0.3;
  const rvFloor = 0.15 + (1 - dereverb) * 0.5;
  for (let k = 0; k < frames; k++) {
    const off = k * H - N / 2;
    for (let i = 0; i < N; i++) { re[i] = (x[off + i] ?? 0) * win[i]; im[i] = 0; }
    fft(re, im, false);
    const mag = new Float32Array(bins);
    for (let b = 0; b < bins; b++) mag[b] = Math.hypot(re[b], im[b]) + 1e-9;
    const late = hist.length >= D ? hist[hist.length - D] : null;
    for (let b = 0; b < bins; b++) {
      let g = 1;
      if (gate > 0.01) g = Math.max(floor, 1 - (alpha * noise[b]) / mag[b]);
      if (dereverb > 0.01 && late) g *= Math.max(rvFloor, 1 - (dereverb * 1.2 * decay * late[b]) / mag[b]);
      // temporal smoothing avoids "musical noise"
      g = g > prevGain[b] ? prevGain[b] * 0.4 + g * 0.6 : prevGain[b] * 0.7 + g * 0.3;
      prevGain[b] = g;
      re[b] *= g; im[b] *= g;
      if (b > 0 && b < N / 2) { re[N - b] = re[b]; im[N - b] = -im[b]; }
    }
    hist.push(mag);
    if (hist.length > D + 1) hist.shift();
    fft(re, im, true);
    for (let i = 0; i < N; i++) {
      const p = off + i;
      if (p >= 0 && p < y.length) { y[p] += re[i] * win[i]; norm[p] += win[i] * win[i]; }
    }
    if (k % 1500 === 0) { onP(k / frames); await tick(); }
  }
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = norm[i] > 1e-6 ? y[i] / norm[i] : 0;
  return out;
}

// ------------------------------------------------------------------ 3/4. EQ, de-esser, compression (WebAudio offline)
async function stageTone(x: Float32Array, s: VoiceSettings): Promise<Float32Array> {
  // de-esser (split-band dynamic reduction above ~5.5 kHz)
  if (s.deess > 0.01) {
    const a = Math.exp((-2 * Math.PI * 5500) / SR);
    let lp = 0, env = 0, envAll = 0;
    const atk = Math.exp(-1 / (SR * 0.002)), rel = Math.exp(-1 / (SR * 0.06));
    for (let i = 0; i < x.length; i++) {
      lp = (1 - a) * x[i] + a * lp;
      const hi = x[i] - lp;
      const ah = Math.abs(hi), ax = Math.abs(x[i]);
      env = ah > env ? atk * env + (1 - atk) * ah : rel * env + (1 - rel) * ah;
      envAll = ax > envAll ? atk * envAll + (1 - atk) * ax : rel * envAll + (1 - rel) * ax;
      const ratio = env / (envAll + 1e-6);
      const thr = 0.55 - s.deess * 0.25;
      const g = ratio > thr ? Math.max(0.25, thr / ratio) : 1;
      x[i] = lp + hi * (1 - (1 - g) * s.deess);
    }
  }
  const OAC = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new OAC(1, x.length, SR);
  const b = ctx.createBuffer(1, x.length, SR);
  b.getChannelData(0).set(x);
  const src = ctx.createBufferSource(); src.buffer = b;
  let last: AudioNode = src;
  const bq = (type: BiquadFilterType, f: number, q: number, g = 0) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.gain.value = g; last.connect(n); last = n; };
  bq('highpass', 75, 0.7);
  const eq: Record<VoiceSettings['eq'], [number, number, number, number]> = {
    // [low-shelf 120Hz, mud 300Hz, presence 3.5kHz, air 11kHz] in dB
    natural: [0, -1.5, 1.5, 1.5], podcast: [2, -3, 3, 2.5], radio: [3, -4, 4, 1], warm: [3, -2.5, 2, 1], bright: [1, -3, 4, 4],
  };
  const [lo, mud, pres, air] = eq[s.eq];
  bq('lowshelf', 120, 0.7, lo);
  bq('peaking', 300, 1.1, mud);
  bq('peaking', 3500, 0.9, pres);
  bq('highshelf', 11000, 0.7, air);
  if (s.compress > 0.01) {
    const c1 = ctx.createDynamicsCompressor();
    c1.threshold.value = -18 - s.compress * 12; c1.ratio.value = 2 + s.compress * 2.5; c1.knee.value = 8; c1.attack.value = 0.008; c1.release.value = 0.18;
    last.connect(c1); last = c1;
    const c2 = ctx.createDynamicsCompressor();
    c2.threshold.value = -10; c2.ratio.value = 3; c2.knee.value = 4; c2.attack.value = 0.002; c2.release.value = 0.08;
    last.connect(c2); last = c2;
  }
  last.connect(ctx.destination);
  src.start();
  const out = await ctx.startRendering();
  return out.getChannelData(0).slice();
}

// ------------------------------------------------------------------ 5. loudness (BS.1770)
/** Integrated loudness (LUFS) of mono/stereo channels at sample rate sr */
export function measureLUFS(chans: Float32Array[], sr: number): number {
  // K-weighting: pre-filter (high shelf +4 dB @ ~1.5 kHz) and RLB high-pass (~38 Hz), biquad coefficients via bilinear transform
  const kw = (x: Float32Array) => {
    const y = new Float32Array(x.length);
    const biquad = (inp: Float32Array, out: Float32Array, b0: number, b1: number, b2: number, a1: number, a2: number) => {
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < inp.length; i++) { const v = b0 * inp[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = inp[i]; y2 = y1; y1 = v; out[i] = v; }
    };
    // stage 1 (shelf)
    const f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
    const K = Math.tan((Math.PI * f0) / sr), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
    const a0 = 1 + K / Q + K * K;
    const tmp = new Float32Array(x.length);
    biquad(x, tmp, (Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0);
    // stage 2 (high-pass)
    const f1 = 38.13547087602444, Q1 = 0.5003270373238773;
    const K1 = Math.tan((Math.PI * f1) / sr);
    const d = 1 + K1 / Q1 + K1 * K1;
    biquad(tmp, y, 1, -2, 1, (2 * (K1 * K1 - 1)) / d, (1 - K1 / Q1 + K1 * K1) / d);
    return y;
  };
  const w = chans.map(kw);
  const block = Math.round(0.4 * sr), hop = Math.round(0.1 * sr);
  const loud: number[] = [];
  for (let s0 = 0; s0 + block <= w[0].length; s0 += hop) {
    let sum = 0;
    for (const c of w) { let e = 0; for (let i = s0; i < s0 + block; i++) e += c[i] * c[i]; sum += e / block; }
    loud.push(-0.691 + 10 * Math.log10(sum + 1e-12));
  }
  if (!loud.length) return -70;
  const abs = loud.filter((l) => l > -70);
  if (!abs.length) return -70;
  const meanE = (arr: number[]) => 10 * Math.log10(arr.reduce((a, l) => a + Math.pow(10, (l + 0.691) / 10), 0) / arr.length) - 0.691;
  const rel = meanE(abs) - 10;
  const gated = abs.filter((l) => l > rel);
  return gated.length ? meanE(gated) : meanE(abs);
}

/** Look-ahead peak limiter (in place), ceiling in dBFS */
export function limit(chans: Float32Array[], sr: number, ceilingDb = -1) {
  const ceil = Math.pow(10, ceilingDb / 20);
  const la = Math.round(0.005 * sr);
  const n = chans[0].length;
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) { let p = 0; for (const c of chans) p = Math.max(p, Math.abs(c[i])); need[i] = p > ceil ? ceil / p : 1; }
  // min over look-ahead window, then smooth release
  let g = 1;
  const rel = Math.exp(-1 / (sr * 0.08));
  for (let i = 0; i < n; i++) {
    let m = 1;
    for (let k = 0; k <= la && i + k < n; k += 8) m = Math.min(m, need[i + k]);
    m = Math.min(m, need[Math.min(n - 1, i + la)]);
    g = m < g ? m : rel * g + (1 - rel) * m;
    for (const c of chans) c[i] *= Math.min(g, need[i]);
  }
}

// ------------------------------------------------------------------ main
export async function enhanceVoice(input: AudioBuffer, s: VoiceSettings, onProgress: (msg: string, f: number) => void): Promise<AudioBuffer> {
  onProgress('Preparando áudio…', 0);
  const dry = await toMono48k(input);
  let x = dry.slice();
  let vad: Float32Array | null = null;
  if (s.denoise > 0.01) {
    onProgress('IA removendo ruído (RNNoise)…', 0.05);
    try {
      const r = await stageRNNoise(x, s.denoise, (f) => onProgress('IA removendo ruído (RNNoise)…', 0.05 + f * 0.35));
      x = r.y; vad = r.vad;
    } catch (e) {
      console.warn('RNNoise indisponível, usando só redução espectral', e);
      s = { ...s, gate: Math.max(s.gate, 0.8) };
    }
  }
  onProgress('Limpando ruído residual e eco…', 0.4);
  x = await stageSpectral(x, vad, s.gate, s.dereverb, (f) => onProgress('Limpando ruído residual e eco…', 0.4 + f * 0.35));
  onProgress('Equalizando e comprimindo a voz…', 0.78);
  x = await stageTone(x, s);
  // strength mix (dry loudness-matched so the blend stays even)
  onProgress('Ajustando volume (LUFS)…', 0.9);
  const lx = measureLUFS([x], SR);
  const gain = lx > -69 ? Math.pow(10, (s.loudness - lx) / 20) : 1;
  for (let i = 0; i < x.length; i++) x[i] *= gain;
  if (s.strength < 0.999) {
    const ld = measureLUFS([dry], SR);
    const gd = ld > -69 ? Math.pow(10, (s.loudness - ld) / 20) : 1;
    for (let i = 0; i < x.length; i++) x[i] = x[i] * s.strength + dry[i] * gd * (1 - s.strength);
  }
  limit([x], SR, -1);
  const out = new AudioBuffer({ length: x.length, numberOfChannels: 2, sampleRate: SR });
  out.getChannelData(0).set(x);
  out.getChannelData(1).set(x);
  onProgress('Pronto', 1);
  return out;
}

/** Cut [from, to] (seconds) of a buffer */
export function sliceBuffer(buf: AudioBuffer, from: number, to: number): AudioBuffer {
  const s = Math.max(0, Math.floor(from * buf.sampleRate)), e = Math.min(buf.length, Math.ceil(to * buf.sampleRate));
  const out = new AudioBuffer({ length: Math.max(1, e - s), numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
  for (let c = 0; c < buf.numberOfChannels; c++) out.getChannelData(c).set(buf.getChannelData(c).subarray(s, e));
  return out;
}
