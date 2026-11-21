/**
 * Procedural sound effects for transitions (no external assets). Each is synthesized into an AudioBuffer once and cached.
 * Buffers are rendered for the transition's duration, centered on the cut.
 */
export interface SfxDef { id: string; name: string; icon: string; cat: string; dur?: number }

export const SFX_CATEGORIES = [
  { id: 'transicao', name: 'Transições' }, { id: 'impacto', name: 'Impactos' }, { id: 'interface', name: 'Interface' },
  { id: 'desenho', name: 'Desenho' }, { id: 'comedia', name: 'Comédia' }, { id: 'natureza', name: 'Natureza' },
  { id: 'game', name: 'Game' }, { id: 'terror', name: 'Terror' }, { id: 'musical', name: 'Musical' },
];

export const SFX: SfxDef[] = [
  { id: 'whoosh', name: 'Whoosh', icon: '💨', cat: 'transicao' },
  { id: 'whoosh-low', name: 'Whoosh grave', icon: '🌪', cat: 'transicao' },
  { id: 'whoosh-soft', name: 'Whoosh suave', icon: '🍃', cat: 'transicao' },
  { id: 'swoosh', name: 'Swoosh', icon: '🌀', cat: 'transicao' },
  { id: 'swish', name: 'Swish', icon: '〰', cat: 'transicao' },
  { id: 'swipe', name: 'Swipe', icon: '👆', cat: 'transicao' },
  { id: 'reverse', name: 'Reverso', icon: '⏪', cat: 'transicao' },
  { id: 'riser', name: 'Riser', icon: '📈', cat: 'transicao', dur: 2 },
  { id: 'downlifter', name: 'Downlifter', icon: '📉', cat: 'transicao', dur: 1.5 },
  { id: 'flip', name: 'Virada', icon: '📄', cat: 'transicao' },
  { id: 'tape', name: 'Fita', icon: '📼', cat: 'transicao' },
  { id: 'tv', name: 'TV', icon: '📡', cat: 'transicao' },
  { id: 'glitch', name: 'Glitch', icon: '📺', cat: 'transicao' },
  { id: 'digital', name: 'Digital', icon: '👾', cat: 'transicao' },
  { id: 'impact', name: 'Impacto', icon: '💥', cat: 'impacto' },
  { id: 'boom', name: 'Boom cinema', icon: '🎬', cat: 'impacto', dur: 2.5 },
  { id: 'bass-drop', name: 'Bass drop', icon: '🔊', cat: 'impacto', dur: 2 },
  { id: 'punch', name: 'Soco', icon: '🥊', cat: 'impacto', dur: 0.5 },
  { id: 'slam', name: 'Batida porta', icon: '🚪', cat: 'impacto', dur: 0.8 },
  { id: 'glass', name: 'Vidro quebrando', icon: '🍷', cat: 'impacto', dur: 1.5 },
  { id: 'metal', name: 'Metal', icon: '🔩', cat: 'impacto', dur: 1.5 },
  { id: 'thud', name: 'Queda', icon: '📦', cat: 'impacto', dur: 0.6 },
  { id: 'pop', name: 'Pop', icon: '🫧', cat: 'interface', dur: 0.4 },
  { id: 'click', name: 'Clique', icon: '🖱', cat: 'interface', dur: 0.3 },
  { id: 'tick', name: 'Tic-tac', icon: '⏱', cat: 'interface', dur: 1.5 },
  { id: 'shutter', name: 'Câmera', icon: '📸', cat: 'interface', dur: 0.5 },
  { id: 'notification', name: 'Notificação', icon: '🔔', cat: 'interface', dur: 0.8 },
  { id: 'message', name: 'Mensagem', icon: '💬', cat: 'interface', dur: 0.5 },
  { id: 'success', name: 'Sucesso', icon: '✅', cat: 'interface', dur: 1 },
  { id: 'error', name: 'Erro', icon: '❌', cat: 'interface', dur: 0.6 },
  { id: 'typing', name: 'Digitando', icon: '⌨️', cat: 'interface', dur: 2 },
  { id: 'cash', name: 'Caixa registradora', icon: '💰', cat: 'interface', dur: 1.2 },
  { id: 'toggle', name: 'Interruptor', icon: '🔘', cat: 'interface', dur: 0.3 },
  { id: 'ding', name: 'Ding', icon: '🛎', cat: 'interface', dur: 1.2 },
  { id: 'boing', name: 'Boing', icon: '🪀', cat: 'desenho', dur: 0.8 },
  { id: 'slide-up', name: 'Apito subindo', icon: '⤴️', cat: 'desenho', dur: 0.8 },
  { id: 'slide-down', name: 'Apito descendo', icon: '⤵️', cat: 'desenho', dur: 0.8 },
  { id: 'spring', name: 'Mola', icon: '🌀', cat: 'desenho', dur: 0.8 },
  { id: 'squeak', name: 'Apertão', icon: '🐭', cat: 'desenho', dur: 0.4 },
  { id: 'bubble', name: 'Bolhas', icon: '🫧', cat: 'desenho', dur: 1 },
  { id: 'zip', name: 'Zip rápido', icon: '⚡', cat: 'desenho', dur: 0.4 },
  { id: 'rimshot', name: 'Ba-dum-tss', icon: '🥁', cat: 'comedia', dur: 1.5 },
  { id: 'sad-trombone', name: 'Trombone triste', icon: '🎺', cat: 'comedia', dur: 2.4 },
  { id: 'crickets', name: 'Grilos', icon: '🦗', cat: 'comedia', dur: 3 },
  { id: 'drumroll', name: 'Rufar', icon: '🥁', cat: 'comedia', dur: 2.5 },
  { id: 'applause', name: 'Aplausos', icon: '👏', cat: 'comedia', dur: 3 },
  { id: 'tada', name: 'Tcharam', icon: '🎉', cat: 'comedia', dur: 1.5 },
  { id: 'record-scratch', name: 'Scratch', icon: '💿', cat: 'comedia' },
  { id: 'rain', name: 'Chuva', icon: '🌧', cat: 'natureza', dur: 4 },
  { id: 'wind', name: 'Vento', icon: '🌬', cat: 'natureza', dur: 4 },
  { id: 'ocean', name: 'Ondas do mar', icon: '🌊', cat: 'natureza', dur: 5 },
  { id: 'thunder', name: 'Trovão', icon: '⛈', cat: 'natureza', dur: 3.5 },
  { id: 'birds', name: 'Pássaros', icon: '🐦', cat: 'natureza', dur: 4 },
  { id: 'fire', name: 'Fogo', icon: '🔥', cat: 'natureza', dur: 3 },
  { id: 'water', name: 'Água', icon: '💧', cat: 'natureza' },
  { id: 'coin', name: 'Moeda', icon: '🪙', cat: 'game', dur: 0.5 },
  { id: 'jump', name: 'Pulo', icon: '🦘', cat: 'game', dur: 0.4 },
  { id: 'powerup', name: 'Power-up', icon: '🍄', cat: 'game', dur: 1 },
  { id: 'levelup', name: 'Subiu de nível', icon: '⭐', cat: 'game', dur: 1.2 },
  { id: 'gameover', name: 'Game over', icon: '💀', cat: 'game', dur: 1.8 },
  { id: 'explosion8', name: 'Explosão 8-bit', icon: '💣', cat: 'game', dur: 1 },
  { id: 'laser', name: 'Laser', icon: '🔫', cat: 'game' },
  { id: 'drone', name: 'Drone sombrio', icon: '🌑', cat: 'terror', dur: 4 },
  { id: 'stinger', name: 'Susto', icon: '😱', cat: 'terror', dur: 1.5 },
  { id: 'heartbeat', name: 'Coração', icon: '💓', cat: 'terror', dur: 1.6 },
  { id: 'creak', name: 'Rangido', icon: '🚪', cat: 'terror', dur: 1.5 },
  { id: 'whisper-fx', name: 'Sussurros', icon: '👻', cat: 'terror', dur: 2.5 },
  { id: 'shimmer', name: 'Brilho', icon: '✨', cat: 'musical' },
  { id: 'magic', name: 'Mágica', icon: '🪄', cat: 'musical', dur: 1.2 },
  { id: 'harp', name: 'Harpa', icon: '🪕', cat: 'musical', dur: 1.8 },
  { id: 'chime', name: 'Sinos', icon: '🎐', cat: 'musical', dur: 2 },
  { id: 'piano-hit', name: 'Piano dramático', icon: '🎹', cat: 'musical', dur: 2.5 },
  { id: 'orchestra-hit', name: 'Orquestra hit', icon: '🎻', cat: 'musical', dur: 1.5 },
];

export const SFX_MAP = new Map(SFX.map((s) => [s.id, s]));

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

    case 'downlifter': {
      const nz = noise(n, 37);
      const bp = bandpass(nz, (i) => 6000 * Math.pow(1 - i / n, 2) + 200, 2);
      let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / n; ph += (2 * Math.PI * (600 * (1 - t) + 50)) / SR; d[i] = (bp[i] * 0.6 + Math.sin(ph) * 0.4) * Math.pow(1 - t, 1.5); }
      break;
    }
    case 'punch': case 'thud': case 'slam': {
      const nz = noise(n, 41);
      const lp = lowpass(nz, (i) => (id === 'slam' ? 3000 : 1500) * Math.exp(-i / (SR * 0.03)) + 120);
      for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sin(2 * Math.PI * (id === 'thud' ? 70 : 95) * t * (1 - t * 2)) * 0.9 + lp[i] * 0.8) * Math.exp(-t * (id === 'slam' ? 9 : 14)); }
      break;
    }
    case 'glass': {
      const nz = noise(n, 43);
      const hp = bandpass(nz, () => 6000, 0.7);
      for (let i = 0; i < n; i++) { const t = i / SR; d[i] = hp[i] * Math.exp(-t * 5) * 0.7; }
      for (let k = 0; k < 14; k++) {
        const off = Math.floor(Math.abs(Math.sin(k * 3.7)) * n * 0.6), f = 2500 + Math.abs(Math.sin(k * 1.3)) * 5000;
        for (let i = 0; i < SR * 0.25 && off + i < n; i++) d[off + i] += Math.sin((2 * Math.PI * f * i) / SR) * Math.exp(-i / (SR * 0.04)) * 0.4;
      }
      break;
    }
    case 'metal': {
      const partials = [1, 2.4, 3.9, 5.3, 6.8];
      for (let i = 0; i < n; i++) { const t = i / SR; let v = 0; partials.forEach((p, k) => (v += Math.sin(2 * Math.PI * 320 * p * t) * Math.exp(-t * (2 + k * 1.5)) / (k + 1))); d[i] = v; }
      break;
    }
    case 'notification': case 'message': case 'success': case 'error': case 'tada': case 'levelup': case 'gameover': case 'coin': case 'powerup': {
      const seqs: Record<string, [number, number][]> = {
        notification: [[880, 0], [1320, 0.12]], message: [[1046, 0], [1568, 0.07]], success: [[523, 0], [659, 0.1], [784, 0.2], [1046, 0.3]],
        error: [[220, 0], [196, 0.18]], tada: [[523, 0], [659, 0.08], [784, 0.16], [1046, 0.28]], levelup: [[523, 0], [659, 0.1], [784, 0.2], [1046, 0.3], [1318, 0.4], [1568, 0.5]],
        gameover: [[392, 0], [370, 0.3], [349, 0.6], [330, 0.9]], coin: [[988, 0], [1318, 0.07]], powerup: [[392, 0], [523, 0.08], [659, 0.16], [784, 0.24], [1046, 0.32], [1318, 0.4]],
      };
      const square = ['coin', 'powerup', 'levelup', 'gameover', 'error'].includes(id);
      for (const [f, st] of seqs[id]) {
        const off = Math.floor(st * SR);
        const len = Math.min(n - off, Math.floor(SR * (id === 'gameover' ? 0.32 : id === 'tada' && f === 1046 ? 1.1 : 0.35)));
        for (let i = 0; i < len; i++) { const t = i / SR; const w = square ? Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.5 : Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t); d[off + i] += w * Math.exp(-t * (square ? 6 : 7)); }
      }
      break;
    }
    case 'typing': {
      let t = 0.02;
      let k = 0;
      while (t < dur - 0.05) {
        const off = Math.floor(t * SR);
        for (let i = 0; i < SR * 0.03 && off + i < n; i++) d[off + i] += (noise(1, off + i)[0] * 0.6 + Math.sin(2 * Math.PI * (1800 + (k % 3) * 300) * i / SR) * 0.3) * Math.exp(-i / (SR * 0.004));
        t += 0.07 + Math.abs(Math.sin(k * 7.1)) * 0.12; k++;
      }
      break;
    }
    case 'cash': {
      for (let i = 0; i < SR * 0.15 && i < n; i++) d[i] += noise(1, i)[0] * Math.exp(-i / (SR * 0.03)) * 0.6;
      const off = Math.floor(SR * 0.15);
      for (let i = 0; off + i < n; i++) { const t = i / SR; d[off + i] += (Math.sin(2 * Math.PI * 2093 * t) + 0.6 * Math.sin(2 * Math.PI * 2637 * t) + 0.4 * Math.sin(2 * Math.PI * 4186 * t)) * Math.exp(-t * 3); }
      break;
    }
    case 'toggle': for (let i = 0; i < Math.min(n, SR * 0.05); i++) d[i] = noise(1, i)[0] * Math.exp(-i / (SR * 0.003)) + Math.sin(2 * Math.PI * 3000 * i / SR) * Math.exp(-i / (SR * 0.006)); break;
    case 'boing': case 'spring': {
      let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / SR; const f = id === 'boing' ? 180 + 120 * Math.sin(t * 40) * Math.exp(-t * 3) + 200 * t : 300 + 200 * Math.sin(t * 60); ph += (2 * Math.PI * f) / SR; d[i] = Math.sin(ph) * Math.exp(-t * 3.5); }
      break;
    }
    case 'slide-up': case 'slide-down': case 'zip': {
      let ph = 0;
      for (let i = 0; i < n; i++) { const x = i / n; const f = id === 'slide-down' ? 1800 - 1400 * x : id === 'zip' ? 400 + 3000 * x : 400 + 1400 * x; ph += (2 * Math.PI * f) / SR; d[i] = Math.sin(ph + 0.4 * Math.sin(i / 300)) * Math.sin(Math.PI * x); }
      break;
    }
    case 'squeak': { let ph = 0; for (let i = 0; i < n; i++) { const x = i / n; ph += (2 * Math.PI * (1400 + 900 * Math.sin(x * Math.PI))) / SR; d[i] = Math.sign(Math.sin(ph)) * 0.4 * Math.sin(Math.PI * x); } break; }
    case 'bubble': {
      for (let k = 0; k < 9; k++) {
        const off = Math.floor((k / 9) * n * 0.9); let ph = 0;
        for (let i = 0; i < SR * 0.06 && off + i < n; i++) { ph += (2 * Math.PI * (500 + k * 60 + i * 0.4)) / SR; d[off + i] += Math.sin(ph) * Math.sin(Math.PI * i / (SR * 0.06)); }
      }
      break;
    }
    case 'rimshot': {
      const hitAt = (t0: number, f: number, dec: number, nz: number) => { const off = Math.floor(t0 * SR); for (let i = 0; off + i < n && i < SR * 1.2; i++) { const t = i / SR; d[off + i] += (Math.sin(2 * Math.PI * f * t) * 0.7 + noise(1, off + i)[0] * nz) * Math.exp(-t * dec); } };
      hitAt(0, 200, 18, 0.5); hitAt(0.18, 120, 12, 0.3); hitAt(0.42, 60, 10, 0.2);
      for (let i = Math.floor(0.42 * SR); i < n; i++) d[i] += noise(1, i)[0] * 0.35 * Math.exp(-(i / SR - 0.42) * 2.5);
      break;
    }
    case 'sad-trombone': {
      const notes = [[293, 0, 0.4], [277, 0.45, 0.4], [261, 0.9, 0.4], [247, 1.35, 1.0]];
      for (const [f, st, len] of notes) { const off = Math.floor(st * SR); let ph = 0; for (let i = 0; i < len * SR && off + i < n; i++) { const t = i / SR; ph += (2 * Math.PI * f * (1 + (len > 0.5 ? 0.02 * Math.sin(t * 30) : 0))) / SR; const w = Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph); d[off + i] += w * Math.min(1, t * 20) * Math.min(1, (len - t) * 8); } }
      break;
    }
    case 'crickets': {
      for (let i = 0; i < n; i++) { const t = i / SR; const chirp = (Math.sin(t * 2 * Math.PI * 3) > 0.6 ? 1 : 0) * (Math.sin(t * 2 * Math.PI * 30) > 0 ? 1 : 0); d[i] = Math.sin(2 * Math.PI * 4500 * t) * chirp * 0.4; }
      break;
    }
    case 'drumroll': {
      for (let k = 0, t = 0; t < dur - 0.3; k++, t += 0.045) { const off = Math.floor(t * SR); const v = 0.3 + 0.7 * (t / dur); for (let i = 0; i < SR * 0.05 && off + i < n; i++) d[off + i] += noise(1, off + i + k)[0] * v * Math.exp(-i / (SR * 0.02)); }
      const end = Math.floor((dur - 0.3) * SR); for (let i = 0; end + i < n; i++) d[end + i] += noise(1, i)[0] * Math.exp(-i / (SR * 0.15));
      break;
    }
    case 'applause': {
      for (let k = 0; k < dur * 160; k++) {
        const off = Math.floor(Math.abs(Math.sin(k * 12.9898) * 43758.5453 % 1) * n);
        const v = Math.sin(Math.PI * off / n);
        for (let i = 0; i < SR * 0.012 && off + i < n; i++) d[off + i] += noise(1, k * 31 + i)[0] * v * Math.exp(-i / (SR * 0.003));
      }
      const bp = bandpass(d, () => 2500, 0.6); d.set(bp);
      break;
    }
    case 'rain': case 'wind': case 'ocean': {
      const nz = noise(n, 47);
      const f = id === 'rain' ? bandpass(nz, () => 5000, 0.4) : lowpass(nz, (i) => id === 'wind' ? 400 + 500 * (0.5 + 0.5 * Math.sin(i / SR * 0.9)) : 800);
      for (let i = 0; i < n; i++) {
        const t = i / SR, x = i / n;
        const edge = Math.min(1, x * 6, (1 - x) * 6);
        const mod = id === 'ocean' ? 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 4.5 - 1.5), 2) : id === 'wind' ? 0.6 + 0.4 * Math.sin(t * 1.3) : 1;
        d[i] = f[i] * mod * edge;
        if (id === 'rain' && Math.random() > 0.9993) for (let k = 0; k < 200 && i + k < n; k++) d[i + k] += Math.sin(k * 0.6) * Math.exp(-k / 40) * 0.5;
      }
      break;
    }
    case 'thunder': {
      const nz = noise(n, 53);
      const lp = lowpass(nz, (i) => 900 * Math.exp(-i / (SR * 0.6)) + 80);
      for (let i = 0; i < n; i++) { const t = i / SR; d[i] = lp[i] * (t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 1.2)) * (1 + 0.5 * Math.sin(t * 9)); }
      break;
    }
    case 'birds': {
      for (let k = 0; k < dur * 3; k++) {
        const off = Math.floor(((k * 0.37) % 1) * n * 0.95); const base = 2500 + (k % 4) * 600; let ph = 0;
        for (let i = 0; i < SR * 0.12 && off + i < n; i++) { const x = i / (SR * 0.12); ph += (2 * Math.PI * (base + 1500 * Math.sin(x * Math.PI * 3))) / SR; d[off + i] += Math.sin(ph) * Math.sin(Math.PI * x) * 0.5; }
      }
      break;
    }
    case 'explosion8': {
      let held = 0; const step = 40;
      for (let i = 0; i < n; i++) { if (i % step === 0) held = noise(1, i)[0]; d[i] = Math.round(held * 4) / 4 * Math.exp(-(i / SR) * 3.5); }
      break;
    }
    case 'jump': { let ph = 0; for (let i = 0; i < n; i++) { const x = i / n; ph += (2 * Math.PI * (300 + 700 * x)) / SR; d[i] = Math.sign(Math.sin(ph)) * 0.4 * (1 - x); } break; }
    case 'drone': {
      for (let i = 0; i < n; i++) { const t = i / SR, x = i / n; d[i] = (Math.sin(2 * Math.PI * 55 * t) + 0.6 * Math.sin(2 * Math.PI * 58.3 * t) + 0.3 * Math.sin(2 * Math.PI * 110.7 * t)) * Math.min(1, x * 4, (1 - x) * 4) * (0.7 + 0.3 * Math.sin(t * 0.7)); }
      const nzd = lowpass(noise(n, 59), () => 300); for (let i = 0; i < n; i++) d[i] += nzd[i] * 0.5;
      break;
    }
    case 'stinger': {
      for (let i = 0; i < n; i++) { const t = i / SR; let v = 0; [311, 329, 349, 370, 466].forEach((f) => (v += Math.sin(2 * Math.PI * f * t + Math.sin(t * 40) * 2))); d[i] = v * (t < 0.01 ? t / 0.01 : Math.exp(-t * 2.2)); }
      break;
    }
    case 'creak': {
      let ph = 0;
      for (let i = 0; i < n; i++) { const x = i / n; const f = 180 + 120 * Math.sin(x * 7) + 60 * Math.sin(x * 23); ph += (2 * Math.PI * f) / SR; const pulse = Math.pow(Math.max(0, Math.sin(ph)), 12); d[i] = pulse * Math.sin(Math.PI * x); }
      break;
    }
    case 'whisper-fx': {
      const nz = noise(n, 61);
      const bp = bandpass(nz, (i) => 2500 + 1500 * Math.sin(i / SR * 6), 3);
      for (let i = 0; i < n; i++) { const t = i / SR; d[i] = bp[i] * (0.5 + 0.5 * Math.sin(t * 11)) * Math.sin(Math.PI * i / n); }
      break;
    }
    case 'harp': case 'chime': {
      const notes = id === 'harp' ? [523, 587, 659, 784, 880, 1046, 1175, 1318] : [1568, 2093, 1760, 2349, 1976];
      notes.forEach((f, k) => { const off = Math.floor(k * (id === 'harp' ? 0.07 : 0.18) * SR); for (let i = 0; off + i < n; i++) { const t = i / SR; d[off + i] += (Math.sin(2 * Math.PI * f * t) + (id === 'chime' ? 0.4 * Math.sin(2 * Math.PI * f * 2.76 * t) : 0.2 * Math.sin(4 * Math.PI * f * t))) * Math.exp(-t * (id === 'harp' ? 2.2 : 1.5)) * 0.5; } });
      break;
    }
    case 'piano-hit': case 'orchestra-hit': {
      const chord = id === 'piano-hit' ? [55, 110, 130.8, 164.8, 220] : [130.8, 196, 261.6, 311, 392, 523];
      for (let i = 0; i < n; i++) { const t = i / SR; let v = 0; chord.forEach((f, k) => { const ph = 2 * Math.PI * f * t; v += (id === 'orchestra-hit' ? (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.33 * Math.sin(3 * ph)) : Math.sin(ph) + 0.3 * Math.sin(2 * ph)) / (k + 1.5); }); d[i] = v * (t < 0.005 ? t / 0.005 : Math.exp(-t * (id === 'orchestra-hit' ? 3 : 1.4))); }
      break;
    }
    default:
      break;
  }
  return normalize(d, 0.85);
}

/** Natural duration of an effect when used standalone (library). */
export const sfxDuration = (id: string) => SFX_MAP.get(id)?.dur ?? 1;

/** Synthesizes the sfx; buffer length = dur seconds; created for the given context's sample rate via resampling */
export function sfxBuffer(ctx: BaseAudioContext, id: string, dur: number): AudioBuffer {
  const d = Math.max(0.15, Math.min(6, Math.round(dur * 20) / 20));
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
