/**
 * Procedural sound effects for transitions (no external assets). Each is synthesized into an AudioBuffer once and cached.
 * Buffers are rendered for the transition's duration, centered on the cut.
 */
export interface SfxDef { id: string; name: string; icon: string }

export const SFX: SfxDef[] = [
  { id: 'whoosh', name: 'Whoosh', icon: '💨' },
  { id: 'whoosh-low', name: 'Whoosh grave', icon: '🌪' },
  { id: 'whoosh-soft', name: 'Whoosh suave', icon: '🍃' },
  { id: 'swoosh', name: 'Swoosh', icon: '🌀' },
  { id: 'swish', name: 'Swish', icon: '〰' },
  { id: 'swipe', name: 'Swipe', icon: '👆' },
  { id: 'impact', name: 'Impacto', icon: '💥' },
  { id: 'boom', name: 'Boom cinema', icon: '🎬' },
  { id: 'riser', name: 'Riser', icon: '📈' },
  { id: 'reverse', name: 'Reverso', icon: '⏪' },
  { id: 'glitch', name: 'Glitch', icon: '📺' },
  { id: 'digital', name: 'Digital', icon: '👾' },
  { id: 'pop', name: 'Pop', icon: '🫧' },
  { id: 'click', name: 'Clique', icon: '🖱' },
  { id: 'tick', name: 'Tic-tac', icon: '⏱' },
  { id: 'shutter', name: 'Câmera', icon: '📸' },
  { id: 'shimmer', name: 'Brilho', icon: '✨' },
  { id: 'magic', name: 'Mágica', icon: '🪄' },
  { id: 'laser', name: 'Laser', icon: '🔫' },
  { id: 'flip', name: 'Virada', icon: '📄' },
  { id: 'water', name: 'Água', icon: '💧' },
  { id: 'fire', name: 'Fogo', icon: '🔥' },
  { id: 'tape', name: 'Fita', icon: '📼' },
  { id: 'tv', name: 'TV', icon: '📡' },
  { id: 'bass-drop', name: 'Bass drop', icon: '🔊' },
  { id: 'heartbeat', name: 'Coração', icon: '💓' },
  { id: 'ding', name: 'Ding', icon: '🔔' },
  { id: 'record-scratch', name: 'Scratch', icon: '💿' },
];

const SR = 44100;
const cache = new Map<string, AudioBuffer>();

function noise(n: number, seed = 1) {
  const out = new Float32Array(n);
  let s = seed * 9301 + 49297;
  for (let i = 0; i < n; i++) { s = (s * 9301 + 49297) % 233280; out[i] = (s / 233280) * 2 - 1; }
  return out;
}

/** simple state-variable bandpass filter with time-varying cutoff */
function bandpass(input: Float32Array, cutoff: (i: number) => number, q = 1.2) {
  const out = new Float32Array(input.length);
  let low = 0, band = 0;
  for (let i = 0; i < input.length; i++) {
    const f = Math.min(0.99, 2 * Math.sin((Math.PI * Math.min(cutoff(i), SR * 0.45)) / SR));
    low += f * band;
    const high = input[i] - low - band / q;
    band += f * high;
    out[i] = band;
  }
  return out;
}

function lowpass(input: Float32Array, cutoff: (i: number) => number) {
  const out = new Float32Array(input.length);
  let y = 0;
  for (let i = 0; i < input.length; i++) {
    const a = 1 - Math.exp((-2 * Math.PI * cutoff(i)) / SR);
    y += a * (input[i] - y);
    out[i] = y;
  }
  return out;
}

const env = (i: number, n: number, attack: number, curve = 2) => {
  const t = i / n;
  return t < attack ? t / attack : Math.pow(1 - (t - attack) / (1 - attack), curve);
};

function normalize(d: Float32Array, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  if (m > 0) for (let i = 0; i < d.length; i++) d[i] = (d[i] / m) * peak;
  return d;
}

function synth(id: string, dur: number): Float32Array {
  const n = Math.max(1, Math.floor(SR * dur));
  const d = new Float32Array(n);
  const sine = (f: number, i: number) => Math.sin((2 * Math.PI * f * i) / SR);
  switch (id) {
    case 'whoosh': case 'whoosh-low': case 'whoosh-soft': case 'swoosh': {
      const base = id === 'whoosh-low' ? 300 : id === 'whoosh-soft' ? 600 : id === 'swoosh' ? 900 : 700;
      const top = id === 'whoosh-low' ? 1400 : id === 'whoosh-soft' ? 2000 : id === 'swoosh' ? 5000 : 4000;
      const nz = noise(n, 3);
      const bp = bandpass(nz, (i) => { const t = i / n; return base + (top - base) * Math.sin(Math.PI * t); }, 1.5);
      for (let i = 0; i < n; i++) d[i] = bp[i] * Math.pow(Math.sin((Math.PI * i) / n), 1.6);
      if (id === 'whoosh-low') for (let i = 0; i < n; i++) d[i] += 0.3 * sine(60 + 40 * (i / n), i) * Math.sin((Math.PI * i) / n);
      break;
    }
    case 'swish': case 'swipe': {
      const len = Math.min(n, Math.floor(SR * (id === 'swipe' ? 0.25 : 0.35)));
      const off = Math.floor((n - len) / 2);
      const nz = noise(len, 5);
      const bp = bandpass(nz, (i) => 2000 + 6000 * (i / len), 2);
      for (let i = 0; i < len; i++) d[off + i] = bp[i] * env(i, len, 0.4, 2);
      break;
    }
    case 'impact': case 'boom': case 'bass-drop': {
      const off = Math.floor(n / 2);
      const len = n - off;
      const nz = noise(len, 7);
      const lp = lowpass(nz, (i) => 2000 * Math.exp(-i / (SR * 0.05)) + 100);
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        const f = id === 'bass-drop' ? 120 * Math.exp(-t * 3) + 35 : 110 * Math.exp(-t * 18) + 45;
        ph += (2 * Math.PI * f) / SR;
        const decay = Math.exp(-t * (id === 'boom' ? 2.5 : id === 'bass-drop' ? 1.8 : 7));
        d[off + i] = (Math.sin(ph) * 0.9 + lp[i] * (id === 'boom' ? 0.6 : 0.5)) * decay;
      }
      if (id === 'boom' || id === 'bass-drop') {
        // pre-rise
        for (let i = 0; i < off; i++) d[i] += noise(1, i)[0] * 0.05 * Math.pow(i / off, 3);
      }
      break;
    }
    case 'riser': {
      const nz = noise(n, 11);
      const bp = bandpass(nz, (i) => 300 + 6000 * Math.pow(i / n, 2), 3);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        ph += (2 * Math.PI * (200 + 1200 * t * t)) / SR;
        d[i] = (bp[i] * 0.7 + Math.sin(ph) * 0.3) * Math.pow(t, 2) * (t > 0.97 ? (1 - t) / 0.03 : 1);
      }
      break;
    }
    case 'reverse': {
      const nz = noise(n, 13);
      const bp = bandpass(nz, () => 5000, 0.8);
      for (let i = 0; i < n; i++) { const t = i / n; d[i] = bp[i] * Math.pow(t, 4) * (t > 0.96 ? (1 - t) / 0.04 : 1); }
      break;
    }
    case 'glitch': case 'digital': {
      const step = Math.floor(SR * 0.03);
      for (let i = 0; i < n; i++) {
        const blk = Math.floor(i / step);
        const r = Math.abs(Math.sin(blk * 12.9898) * 43758.5453) % 1;
        const f = id === 'digital' ? 400 + Math.floor(r * 8) * 220 : 80 + r * 3000;
        const sq = Math.sign(sine(f, i));
        const crush = Math.round(sq * 4) / 4;
        d[i] = (r > 0.3 ? crush : noise(1, i)[0]) * 0.6 * Math.sin((Math.PI * i) / n);
      }
      break;
    }
    case 'pop': case 'click': case 'ding': {
      const off = Math.floor(n / 2) - Math.floor(SR * 0.01);
      const len = Math.min(n - Math.max(0, off), Math.floor(SR * (id === 'ding' ? 1.2 : 0.15)));
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        const f = id === 'pop' ? 900 * Math.exp(-t * 40) + 250 : id === 'click' ? 2500 : 1320;
        ph += (2 * Math.PI * f) / SR;
        const dec = Math.exp(-t * (id === 'click' ? 120 : id === 'ding' ? 4 : 30));
        d[Math.max(0, off) + i] = (Math.sin(ph) + (id === 'ding' ? 0.4 * Math.sin(ph * 2.76) : 0)) * dec;
      }
      break;
    }
    case 'tick': {
      const ticks = Math.max(2, Math.round(dur / 0.12));
      for (let k = 0; k < ticks; k++) {
        const off = Math.floor((k / ticks) * n);
        for (let i = 0; i < SR * 0.02 && off + i < n; i++) d[off + i] += sine(k % 2 ? 2400 : 1800, i) * Math.exp(-i / (SR * 0.004));
      }
      break;
    }
    case 'shutter': {
      const off = Math.floor(n / 2) - Math.floor(SR * 0.03);
      const nz = noise(Math.floor(SR * 0.12), 17);
      const bp = bandpass(nz, () => 3500, 1.5);
      for (let i = 0; i < bp.length && off + i < n; i++) {
        const t = i / SR;
        const e = Math.exp(-t * 60) + (t > 0.05 ? Math.exp(-(t - 0.05) * 70) * 0.8 : 0);
        d[Math.max(0, off) + i] = bp[i] * e;
      }
      break;
    }
    case 'shimmer': case 'magic': {
      const notes = id === 'magic' ? [1046, 1318, 1568, 2093, 2637] : [1760, 2217, 2637, 3520];
      for (let i = 0; i < n; i++) {
        let v = 0;
        notes.forEach((f, k) => {
          const start = (k / notes.length) * n * 0.6;
          if (i >= start) { const t = (i - start) / SR; v += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 3) * (0.5 + 0.5 * Math.sin(t * 40)); }
        });
        d[i] = v * Math.sin((Math.PI * i) / n);
      }
      break;
    }
    case 'laser': {
      let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / n; ph += (2 * Math.PI * (2500 * Math.exp(-t * 4) + 200)) / SR; d[i] = Math.sign(Math.sin(ph)) * 0.5 * (1 - t); }
      break;
    }
    case 'flip': {
      const nz = noise(n, 19);
      const bp = bandpass(nz, (i) => 1200 + 2500 * Math.sin((Math.PI * i) / n), 4);
      for (let i = 0; i < n; i++) d[i] = bp[i] * Math.pow(Math.sin((Math.PI * i) / n), 3) * (1 + 0.5 * Math.sin(i / 200));
      break;
    }
    case 'water': {
      for (let k = 0; k < 6; k++) {
        const off = Math.floor((0.2 + 0.6 * ((k * 0.37) % 1)) * n);
        let ph = 0;
        for (let i = 0; i < SR * 0.08 && off + i < n; i++) { const t = i / SR; ph += (2 * Math.PI * (600 + 1800 * t * 12)) / SR; d[off + i] += Math.sin(ph) * Math.exp(-t * 50); }
      }
      break;
    }
    case 'fire': {
      const nz = noise(n, 23);
      const lp = lowpass(nz, () => 1800);
      for (let i = 0; i < n; i++) d[i] = (lp[i] + (Math.random() > 0.9985 ? (Math.random() - 0.5) * 3 : 0)) * Math.sin((Math.PI * i) / n);
      break;
    }
    case 'tape': {
      let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / n; ph += (2 * Math.PI * (300 * (1 - t) + 40)) / SR; d[i] = (Math.sin(ph) * 0.6 + noise(1, i)[0] * 0.15) * (1 - t); }
      break;
    }
    case 'tv': {
      const nz = noise(n, 29);
      for (let i = 0; i < n; i++) { const t = i / n; d[i] = t < 0.5 ? nz[i] * 0.4 * (1 - t * 2) + Math.sin((2 * Math.PI * 15000 * i) / SR) * 0.1 * (1 - t * 2) : 0; }
      break;
    }
    case 'heartbeat': {
      [0.3, 0.45].forEach((p) => {
        const off = Math.floor(p * n);
        for (let i = 0; i < SR * 0.15 && off + i < n; i++) { const t = i / SR; d[off + i] += Math.sin(2 * Math.PI * (60 - t * 100) * t) * Math.exp(-t * 25); }
      });
      break;
    }
    case 'record-scratch': {
      let ph = 0;
      const nz = noise(n, 31);
      for (let i = 0; i < n; i++) { const t = i / n; const sp = Math.sin(t * Math.PI * 4) * 800 + 900; ph += (2 * Math.PI * sp) / SR; d[i] = (Math.sin(ph) * 0.3 + nz[i] * 0.5) * Math.sin(t * Math.PI); }
      const bp = bandpass(d, () => 1500, 1);
      d.set(bp);
      break;
    }
    default:
      break;
  }
  return normalize(d, 0.85);
}

/** Synthesizes the sfx; buffer length = dur seconds; created for the given context's sample rate via resampling */
export function sfxBuffer(ctx: BaseAudioContext, id: string, dur: number): AudioBuffer {
  const d = Math.max(0.15, Math.min(3, Math.round(dur * 20) / 20));
  const key = `${id}|${d}|${ctx.sampleRate}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const raw = synth(id, d);
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(d * ctx.sampleRate)), ctx.sampleRate);
  const out = buf.getChannelData(0);
  const ratio = SR / ctx.sampleRate;
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x), f = x - i0;
    out[i] = (raw[i0] ?? 0) * (1 - f) + (raw[i0 + 1] ?? 0) * f;
  }
  if (cache.size > 80) cache.clear();
  cache.set(key, buf);
  return buf;
}
