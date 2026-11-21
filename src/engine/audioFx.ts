import type { AudioOpts, VoiceFx } from '../model/types';

export const VOICE_FX: { id: VoiceFx; name: string; icon: string }[] = [
  { id: 'none', name: 'Nenhum', icon: '🚫' },
  { id: 'robot', name: 'Robô', icon: '🤖' },
  { id: 'monster', name: 'Monstro', icon: '👹' },
  { id: 'telephone', name: 'Telefone', icon: '☎️' },
  { id: 'radio', name: 'Rádio', icon: '📻' },
  { id: 'megaphone', name: 'Megafone', icon: '📢' },
  { id: 'echo', name: 'Eco', icon: '🏔' },
  { id: 'reverb', name: 'Reverb', icon: '⛪' },
  { id: 'stadium', name: 'Estádio', icon: '🏟' },
  { id: 'underwater', name: 'Subaquático', icon: '🌊' },
  { id: 'whisper', name: 'Sussurro', icon: '🤫' },
];

const irCache = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>();
function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  let m = irCache.get(ctx);
  if (!m) { m = new Map(); irCache.set(ctx, m); }
  const hit = m.get(seconds);
  if (hit) return hit;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let s = 7 + c;
    for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = ((s / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 2.5); }
  }
  m.set(seconds, buf);
  return buf;
}

function distortion(ctx: BaseAudioContext, amount: number) {
  const ws = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x)); }
  ws.curve = curve;
  ws.oversample = '2x';
  return ws;
}

function biquad(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7, gain = 0) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.gain.value = gain;
  return f;
}

export interface FxChain { input: AudioNode; output: AudioNode; oscillators: OscillatorNode[] }

/** Builds an audio processing chain for a clip's audio options (EQ, AI enhance, denoise, voice fx). */
export function buildChain(ctx: BaseAudioContext, a: AudioOpts): FxChain {
  const input = ctx.createGain();
  let last: AudioNode = input;
  const oscillators: OscillatorNode[] = [];
  const connect = (n: AudioNode) => { last.connect(n); last = n; };

  if (a.eqLow || a.eqMid || a.eqHigh) {
    connect(biquad(ctx, 'lowshelf', 200, 0.7, a.eqLow));
    connect(biquad(ctx, 'peaking', 1500, 0.9, a.eqMid));
    connect(biquad(ctx, 'highshelf', 5000, 0.7, a.eqHigh));
  }
  if (a.denoise) {
    connect(biquad(ctx, 'highpass', 110, 0.7));
    connect(biquad(ctx, 'lowpass', 9500, 0.7));
    connect(biquad(ctx, 'notch', 60, 8));
  }
  if (a.enhance) {
    connect(biquad(ctx, 'highpass', 80, 0.7));
    connect(biquad(ctx, 'peaking', 250, 1, -2));
    connect(biquad(ctx, 'peaking', 3200, 1, 4));
    connect(biquad(ctx, 'highshelf', 9000, 0.7, 2));
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.15;
    connect(comp);
    const makeup = ctx.createGain(); makeup.gain.value = 1.6;
    connect(makeup);
  }

  const fx = a.voiceFx;
  if (fx === 'robot' || fx === 'monster') {
    if (fx === 'monster') { connect(biquad(ctx, 'lowpass', 1200, 1)); connect(distortion(ctx, 40)); }
    const ring = ctx.createGain();
    ring.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.frequency.value = fx === 'robot' ? 55 : 28;
    osc.type = fx === 'robot' ? 'square' : 'sine';
    osc.connect(ring.gain);
    oscillators.push(osc);
    connect(ring);
    const boost = ctx.createGain(); boost.gain.value = 1.8; connect(boost);
  } else if (fx === 'telephone') {
    connect(biquad(ctx, 'highpass', 450, 0.9)); connect(biquad(ctx, 'lowpass', 3000, 0.9)); connect(distortion(ctx, 8));
  } else if (fx === 'radio') {
    connect(biquad(ctx, 'bandpass', 1600, 0.6)); connect(distortion(ctx, 25)); const g = ctx.createGain(); g.gain.value = 1.4; connect(g);
  } else if (fx === 'megaphone') {
    connect(biquad(ctx, 'highpass', 700, 1)); connect(biquad(ctx, 'lowpass', 4000, 1)); connect(distortion(ctx, 80)); const g = ctx.createGain(); g.gain.value = 0.8; connect(g);
  } else if (fx === 'underwater') {
    connect(biquad(ctx, 'lowpass', 450, 2));
  } else if (fx === 'whisper') {
    connect(biquad(ctx, 'highpass', 1400, 0.7)); const g = ctx.createGain(); g.gain.value = 1.8; connect(g);
  } else if (fx === 'echo' || fx === 'reverb' || fx === 'stadium') {
    const dry = ctx.createGain(); dry.gain.value = 0.8;
    const wet = ctx.createGain(); wet.gain.value = fx === 'stadium' ? 0.7 : 0.5;
    const merge = ctx.createGain();
    last.connect(dry); dry.connect(merge);
    if (fx === 'echo') {
      const delay = ctx.createDelay(2); delay.delayTime.value = 0.32;
      const fb = ctx.createGain(); fb.gain.value = 0.42;
      last.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet);
    } else {
      const conv = ctx.createConvolver();
      conv.buffer = impulse(ctx, fx === 'stadium' ? 4 : 2.2);
      last.connect(conv); conv.connect(wet);
      if (fx === 'stadium') { const d = ctx.createDelay(1); d.delayTime.value = 0.12; last.connect(d); d.connect(wet); }
    }
    wet.connect(merge);
    last = merge;
  }
  return { input, output: last, oscillators };
}

export const chainKey = (a: AudioOpts) => `${a.voiceFx}|${a.enhance}|${a.denoise}|${a.eqLow}|${a.eqMid}|${a.eqHigh}`;
