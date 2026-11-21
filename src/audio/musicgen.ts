/**
 * Procedural music composer: genre templates (drums/bass/chords/melody), energy-driven arrangement,
 * hit points (cuts) with crashes/impacts, fills and risers. Renders offline to an AudioBuffer.
 */
import { Rng, bass, clap, crash, hat, impact, kick, lead, makeReverb, pad, piano, pluckString, riser, rim, shaker, snare, tom, vinyl } from './synth';

type Scale = 'major' | 'minor' | 'dorian' | 'phrygian' | 'harmonicMinor' | 'mixolydian';
const SCALES: Record<Scale, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10], harmonicMinor: [0, 2, 3, 5, 7, 8, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

export interface Genre {
  id: string; name: string; emoji: string; moods: string[]; bpm: [number, number]; scale: Scale[];
  prog: number[][]; swing: number; sevenths: boolean;
  kick: string; snare: string; hat: string; clap?: string; perc?: string; open?: string;
  kickKind: 'punch' | '808' | 'soft' | 'acoustic'; snareKind: 'tight' | 'fat' | 'lofi' | 'acoustic';
  bassKind: 'sub' | '808' | 'pluck' | 'saw' | 'finger' | 'reese'; bassPat: string;
  chords: 'pad' | 'piano' | 'epiano' | 'guitar' | 'strings' | 'pluck' | 'organ' | 'stab' | 'bell' | 'dark';
  chordPat: string; lead: 'square' | 'saw' | 'flute' | 'pluck' | 'whistle' | 'piano' | 'guitar' | 'bell' | 'epiano' | null;
  vinyl?: boolean; drumless?: boolean; halfTime?: boolean;
}

// 16-step patterns per bar. x=hit X=accent g=ghost. Bass: x=root o=octave f=fifth 3=third -=hold
export const GENRES: Genre[] = [
  { id: 'lofi', name: 'Lo-fi', emoji: '☕', moods: ['calmo', 'nostálgico', 'estudo'], bpm: [72, 88], scale: ['dorian', 'minor'], prog: [[1, 4, 0, 5], [0, 5, 3, 4], [1, 4, 2, 5]], swing: 0.22, sevenths: true,
    kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xg', kickKind: 'soft', snareKind: 'lofi', bassKind: 'finger', bassPat: 'x-----x---f-----', chords: 'epiano', chordPat: 'x-------x-------', lead: 'epiano', vinyl: true },
  { id: 'trap', name: 'Trap', emoji: '💎', moods: ['confiante', 'urbano', 'intenso'], bpm: [130, 150], scale: ['minor', 'harmonicMinor', 'phrygian'], prog: [[0, 5, 3, 4], [0, 0, 5, 6], [0, 3, 5, 4]], swing: 0, sevenths: false,
    kick: 'x.....x...x.....', snare: '........x.......', hat: 'xxxxxxxxxxxxxxxx', clap: '........x.......', open: '..............x.', kickKind: '808', snareKind: 'tight', bassKind: '808', bassPat: 'x-----x---x-----', chords: 'bell', chordPat: 'x-------x-------', lead: 'bell', halfTime: true },
  { id: 'house', name: 'House', emoji: '🪩', moods: ['festa', 'dançante', 'energético'], bpm: [120, 126], scale: ['minor', 'dorian'], prog: [[0, 5, 3, 4], [0, 3, 4, 3], [5, 3, 0, 4]], swing: 0.05, sevenths: true,
    kick: 'x...x...x...x...', snare: '', clap: '....x.......x...', hat: '..x...x...x...x.', open: '..x...x...x...x.', perc: '.....x.......x..', kickKind: 'punch', snareKind: 'tight', bassKind: 'saw', bassPat: '..x...x...x...x.', chords: 'stab', chordPat: '..x..x....x..x..', lead: 'pluck' },
  { id: 'edm', name: 'EDM / Future', emoji: '⚡', moods: ['épico', 'eufórico', 'energético'], bpm: [124, 150], scale: ['major', 'minor'], prog: [[5, 3, 0, 4], [0, 4, 5, 3], [3, 4, 5, 5]], swing: 0, sevenths: true,
    kick: 'x...x...x...x...', snare: '........x.......', clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', open: '..x...x...x...x.', kickKind: 'punch', snareKind: 'fat', bassKind: 'reese', bassPat: 'x.x.x.x.x.x.x.x.', chords: 'pad', chordPat: 'x.xx.x.xx.x.x.x.', lead: 'saw' },
  { id: 'cinematic', name: 'Cinematográfico épico', emoji: '🎬', moods: ['épico', 'grandioso', 'tenso'], bpm: [80, 100], scale: ['minor', 'harmonicMinor'], prog: [[0, 5, 2, 6], [0, 3, 5, 4], [5, 3, 0, 4]], swing: 0, sevenths: false,
    kick: 'x.......x.x.....', snare: '', hat: '', perc: 'x..x..x...x.x...', kickKind: 'acoustic', snareKind: 'fat', bassKind: 'sub', bassPat: 'x---------------', chords: 'strings', chordPat: 'x---------------', lead: 'piano', drumless: false },
  { id: 'emotional', name: 'Emocionante (piano)', emoji: '🎹', moods: ['emocionante', 'romântico', 'inspirador'], bpm: [66, 84], scale: ['major'], prog: [[0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 3, 4]], swing: 0, sevenths: false,
    kick: '', snare: '', hat: '', kickKind: 'soft', snareKind: 'acoustic', bassKind: 'sub', bassPat: 'x-------x-------', chords: 'piano', chordPat: 'x.x.x.x.x.x.x.x.', lead: 'piano', drumless: true },
  { id: 'corporate', name: 'Corporativo motivacional', emoji: '💼', moods: ['inspirador', 'positivo', 'negócios'], bpm: [100, 118], scale: ['major'], prog: [[0, 4, 5, 3], [0, 5, 3, 4], [3, 0, 4, 5]], swing: 0, sevenths: false,
    kick: 'x...x...x...x...', snare: '', clap: '....x.......x...', hat: '..x...x...x...x.', perc: 'x.x.x.x.x.x.x.x.', kickKind: 'soft', snareKind: 'tight', bassKind: 'pluck', bassPat: 'x.x.x.x.x.x.x.x.', chords: 'piano', chordPat: 'x.x.x.x.x.x.x.x.', lead: 'pluck' },
  { id: 'acoustic', name: 'Acústico (violão)', emoji: '🎸', moods: ['leve', 'feliz', 'viagem'], bpm: [90, 112], scale: ['major'], prog: [[0, 4, 5, 3], [0, 3, 4, 4], [0, 5, 3, 4]], swing: 0.08, sevenths: false,
    kick: 'x.......x.......', snare: '....x.......x...', hat: '', perc: 'x.x.x.x.x.x.x.x.', kickKind: 'acoustic', snareKind: 'acoustic', bassKind: 'finger', bassPat: 'x-------f-------', chords: 'guitar', chordPat: 'x.x.xx.xx.x.xx.x', lead: 'whistle' },
  { id: 'ukulele', name: 'Alegre (ukulele)', emoji: '🌞', moods: ['feliz', 'divertido', 'infantil'], bpm: [110, 128], scale: ['major'], prog: [[0, 4, 5, 3], [0, 3, 0, 4]], swing: 0.12, sevenths: false,
    kick: 'x.......x.......', snare: '....x.......x...', clap: '', hat: 'x.x.x.x.x.x.x.x.', kickKind: 'soft', snareKind: 'acoustic', bassKind: 'finger', bassPat: 'x---f---x---f---', chords: 'pluck', chordPat: 'x.xx.xx.x.xx.xx.', lead: 'whistle' },
  { id: 'ambient', name: 'Ambiente', emoji: '🌌', moods: ['calmo', 'contemplativo', 'natureza'], bpm: [60, 80], scale: ['major', 'mixolydian'], prog: [[0, 3, 5, 4], [0, 5, 3, 3]], swing: 0, sevenths: true,
    kick: '', snare: '', hat: '', kickKind: 'soft', snareKind: 'lofi', bassKind: 'sub', bassPat: 'x---------------', chords: 'pad', chordPat: 'x---------------', lead: 'bell', drumless: true },
  { id: 'phonk', name: 'Phonk', emoji: '🚗', moods: ['agressivo', 'treino', 'drift'], bpm: [130, 145], scale: ['phrygian', 'minor'], prog: [[0, 1, 0, 6], [0, 5, 6, 0]], swing: 0, sevenths: false,
    kick: 'x..x..x...x..x..', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', clap: '....x.......x...', kickKind: '808', snareKind: 'tight', bassKind: '808', bassPat: 'x..x..x...x..x..', chords: 'bell', chordPat: 'x.x.x.x.x.x.x.x.', lead: 'bell' },
  { id: 'funk', name: 'Funk brasileiro', emoji: '🇧🇷', moods: ['festa', 'dançante', 'baile'], bpm: [128, 150], scale: ['minor'], prog: [[0, 0, 5, 4]], swing: 0, sevenths: false,
    kick: 'x..x..x...x.....', snare: '...x..x...x..x..', clap: '....x..x....x...', hat: 'x.x.x.x.x.x.x.x.', perc: '..x...x...x...x.', kickKind: '808', snareKind: 'tight', bassKind: '808', bassPat: 'x..x..x...x.....', chords: 'stab', chordPat: 'x......x........', lead: 'whistle' },
  { id: 'synthwave', name: 'Synthwave', emoji: '🌆', moods: ['retrô', 'noturno', 'nostálgico'], bpm: [96, 112], scale: ['minor'], prog: [[0, 5, 3, 4], [0, 6, 5, 6]], swing: 0, sevenths: false,
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', kickKind: 'punch', snareKind: 'fat', bassKind: 'saw', bassPat: 'xoxoxoxoxoxoxoxo', chords: 'pad', chordPat: 'x---------------', lead: 'square' },
  { id: 'boombap', name: 'Hip-hop boom bap', emoji: '🎤', moods: ['urbano', 'confiante', 'storytelling'], bpm: [85, 96], scale: ['minor', 'dorian'], prog: [[0, 3, 5, 4], [0, 5, 0, 5]], swing: 0.18, sevenths: true,
    kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', kickKind: 'punch', snareKind: 'fat', bassKind: 'finger', bassPat: 'x.....x...x.....', chords: 'piano', chordPat: 'x.......x.......', lead: 'flute', vinyl: true },
  { id: 'rock', name: 'Rock energético', emoji: '🤘', moods: ['energético', 'esporte', 'rebelde'], bpm: [120, 150], scale: ['minor', 'mixolydian'], prog: [[0, 5, 6, 0], [0, 3, 4, 3]], swing: 0, sevenths: false,
    kick: 'x.x.....x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', kickKind: 'acoustic', snareKind: 'fat', bassKind: 'saw', bassPat: 'xxxxxxxxxxxxxxxx', chords: 'dark', chordPat: 'x.x.x.x.x.x.x.x.', lead: 'saw' },
  { id: 'reggaeton', name: 'Reggaeton / Dembow', emoji: '🌴', moods: ['dançante', 'verão', 'festa'], bpm: [90, 100], scale: ['minor'], prog: [[0, 5, 3, 4]], swing: 0, sevenths: false,
    kick: 'x...x...x...x...', snare: '...x..x....x..x.', hat: 'x.x.x.x.x.x.x.x.', kickKind: 'punch', snareKind: 'tight', bassKind: 'sub', bassPat: 'x...x...x...x...', chords: 'pluck', chordPat: 'x..x..x.x..x..x.', lead: 'pluck' },
  { id: 'horror', name: 'Suspense / Terror', emoji: '👻', moods: ['tenso', 'medo', 'mistério'], bpm: [60, 80], scale: ['harmonicMinor', 'phrygian'], prog: [[0, 1, 0, 1], [0, 5, 1, 0]], swing: 0, sevenths: false,
    kick: 'x...............', snare: '', hat: '', kickKind: 'acoustic', snareKind: 'fat', bassKind: 'reese', bassPat: 'x---------------', chords: 'dark', chordPat: 'x---------------', lead: 'bell', drumless: false },
  { id: 'jazz', name: 'Jazz lounge', emoji: '🎷', moods: ['elegante', 'jantar', 'calmo'], bpm: [90, 120], scale: ['dorian', 'major'], prog: [[1, 4, 0, 0], [1, 4, 0, 5], [0, 5, 1, 4]], swing: 0.3, sevenths: true,
    kick: 'x.......x.......', snare: '', hat: 'x..x.xx..x.xx..x', perc: '....x.......x...', kickKind: 'soft', snareKind: 'acoustic', bassKind: 'finger', bassPat: 'x...3...f...o...', chords: 'epiano', chordPat: '..x.....x..x....', lead: 'flute' },
];

export const GENRE_MAP = new Map(GENRES.map((g) => [g.id, g]));

export interface MusicPlan {
  genre: string;
  bpm: number;
  root: number; // midi note of the tonic (around 45-57)
  scale?: Scale;
  seed: number;
  duration: number;
  /** energy per bar 0..1 (resampled if lengths differ) */
  energy: number[];
  /** times (s) of video cuts / hits */
  hits: number[];
  volume?: number;
}

const KEY_NAMES = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];
export const keyName = (root: number, scale: string) => `${KEY_NAMES[root % 12]} ${['major', 'mixolydian'].includes(scale) ? 'maior' : 'menor'}`;

export function energyShape(shape: 'build' | 'steady' | 'wave' | 'calm' | 'drop' | 'arc', bars: number): number[] {
  return Array.from({ length: bars }, (_, i) => {
    const x = bars <= 1 ? 1 : i / (bars - 1);
    switch (shape) {
      case 'build': return 0.2 + 0.8 * x;
      case 'steady': return i < 1 ? 0.45 : 0.8;
      case 'wave': return 0.5 + 0.35 * Math.sin(x * Math.PI * 3);
      case 'calm': return 0.3 + 0.1 * Math.sin(x * Math.PI * 2);
      case 'drop': return x < 0.35 ? 0.35 : x < 0.45 ? 0.55 : 0.95;
      case 'arc': return 0.3 + 0.65 * Math.sin(x * Math.PI);
    }
  });
}

function chordNotes(root: number, scale: number[], degree: number, sevenths: boolean, oct = 0): number[] {
  const idx = [0, 2, 4, ...(sevenths ? [6] : [])];
  return idx.map((k) => {
    const d = degree + k;
    return root + 12 + oct * 12 + scale[d % 7] + 12 * Math.floor(d / 7);
  });
}

/** Schedules the whole song into ctx (any BaseAudioContext). */
export function compose(ctx: BaseAudioContext, dest: AudioNode, plan: MusicPlan) {
  const g = GENRE_MAP.get(plan.genre) ?? GENRES[0];
  const rng = new Rng(plan.seed);
  const scaleName: Scale = plan.scale ?? g.scale[Math.floor(rng.next() * g.scale.length)];
  const scale = SCALES[scaleName];
  const prog = g.prog[Math.floor(rng.next() * g.prog.length)];
  const beat = 60 / plan.bpm;
  const step = beat / 4;
  const barDur = beat * 4;
  const bars = Math.max(1, Math.ceil(plan.duration / barDur));
  const energyAt = (b: number) => { const e = plan.energy; if (!e.length) return 0.7; const i = Math.min(e.length - 1, Math.floor((b / bars) * e.length)); return Math.max(0, Math.min(1, e[i])); };

  // buses
  const master = ctx.createGain(); master.gain.value = plan.volume ?? 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
  const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -4; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.08;
  master.connect(comp); comp.connect(limiter); limiter.connect(dest);
  const rev = makeReverb(ctx, g.id === 'ambient' || g.id === 'cinematic' || g.id === 'horror' ? 4 : 2.2);
  const revGain = ctx.createGain(); revGain.gain.value = g.id === 'ambient' || g.id === 'cinematic' ? 0.45 : 0.22;
  rev.connect(revGain); revGain.connect(master);
  const drums = ctx.createGain(); drums.gain.value = 0.85; drums.connect(master);
  const bassBus = ctx.createGain(); bassBus.gain.value = 0.8; bassBus.connect(master);
  const music = ctx.createGain(); music.gain.value = 0.8; music.connect(master); music.connect(rev);
  const leadBus = ctx.createGain(); leadBus.gain.value = 0.7; leadBus.connect(master); leadBus.connect(rev);
  const fx = ctx.createGain(); fx.gain.value = 0.7; fx.connect(master); fx.connect(rev);
  // lofi warmth
  if (g.vinyl) vinyl(ctx, 0, plan.duration + 1, master, 0.035);

  const hit = (p: string, i: number) => p.length > 0 && (p[i % p.length] === 'x' || p[i % p.length] === 'X' || p[i % p.length] === 'g');
  const velOf = (p: string, i: number) => (p[i % p.length] === 'X' ? 1.15 : p[i % p.length] === 'g' ? 0.45 : 1);

  // melody motif (2 bars, 16th grid)
  const motif: { s: number; len: number; deg: number }[] = [];
  for (let s = 0; s < 32;) {
    if (rng.next() < 0.62) {
      const len = rng.pick([2, 2, 3, 4, 4, 6]);
      motif.push({ s, len, deg: Math.floor(rng.next() * 7) });
      s += len;
    } else s += 2;
  }

  const cutBars = new Set(plan.hits.map((h) => Math.floor(h / barDur)));

  for (let b = 0; b < bars; b++) {
    const t0 = b * barDur;
    const e = energyAt(b);
    const eNext = energyAt(b + 1);
    const degree = prog[b % prog.length];
    const ch = chordNotes(plan.root, scale, degree, g.sevenths);
    const last = b === bars - 1;

    // chords
    const chVel = 0.55 + 0.45 * e;
    for (let i = 0; i < 16; i++) {
      const c = g.chordPat[i] ?? '.';
      if (c !== 'x') continue;
      let len = 1; while (g.chordPat[i + len] === '-' && i + len < 16) len++;
      const sw = i % 2 === 1 ? g.swing * step : 0;
      const t = t0 + i * step + sw;
      const dur = Math.max(step * len, g.chordPat.includes('-') ? step * len : step * 1.6);
      switch (g.chords) {
        case 'pad': case 'dark': pad(ctx, t, ch, dur, music, chVel, g.chords === 'dark' ? 'dark' : 'warm'); break;
        case 'strings': pad(ctx, t, ch, dur, music, chVel * 1.2, 'strings'); pad(ctx, t, [ch[0] - 12], dur, music, chVel * 0.8, 'strings'); break;
        case 'piano': ch.forEach((n, k) => piano(ctx, t + k * 0.008, n, dur * 1.2, music, chVel * 0.9)); break;
        case 'epiano': ch.forEach((n) => piano(ctx, t, n, dur * 1.5, music, chVel, 'epiano')); break;
        case 'organ': ch.forEach((n) => piano(ctx, t, n, dur, music, chVel, 'organ')); break;
        case 'bell': if (i === 0 || e > 0.5) ch.forEach((n, k) => piano(ctx, t + k * 0.03, n + 12, dur, music, chVel * 0.7, 'bell')); break;
        case 'guitar': { const down = (i / 2) % 2 === 0; const order = down ? ch : [...ch].reverse(); [ch[0] - 12, ...order].forEach((n, k) => pluckString(ctx, t + k * 0.012, n, dur * 1.4, music, chVel * (down ? 1 : 0.7), 0.55)); break; }
        case 'pluck': ch.forEach((n, k) => pluckString(ctx, t + k * 0.01, n + 12, dur, music, chVel * 0.9, 0.8)); break;
        case 'stab': ch.forEach((n) => lead(ctx, t, n, step * 1.5, music, chVel * 0.9, 'pluck')); break;
      }
    }
    if (g.chords === 'stab' || g.chords === 'bell' || g.chords === 'pluck') { if (e < 0.6 || g.id === 'house' || g.id === 'edm') pad(ctx, t0, ch, barDur, music, 0.35 + e * 0.3, 'airy'); }

    // bass
    if ((e >= 0.28 || g.drumless) && !last) {
      for (let i = 0; i < 16; i++) {
        const c = g.bassPat[i] ?? '.';
        if (c === '.' || c === '-') continue;
        let len = 1; while (g.bassPat[i + len] === '-' && i + len < 16) len++;
        const n = plan.root - 12 + scale[degree % 7] + (c === 'o' ? 12 : c === 'f' ? 7 : c === '3' ? scale[(degree + 2) % 7] - scale[degree % 7] : 0);
        const sw = i % 2 === 1 ? g.swing * step : 0;
        bass(ctx, t0 + i * step + sw, n, Math.max(step * len * 0.95, step * 0.9), bassBus, g.bassKind, 0.8 + 0.2 * e);
      }
    }

    // drums
    if (!g.drumless && !last) {
      const full = e >= 0.5, peak = e >= 0.78, intro = e < 0.3;
      for (let i = 0; i < 16; i++) {
        const sw = i % 2 === 1 ? g.swing * step : 0;
        const t = t0 + i * step + sw;
        if (!intro && hit(g.kick, i)) kick(ctx, t, drums, velOf(g.kick, i) * (0.7 + 0.3 * e), g.kickKind);
        if (full && hit(g.snare, i)) snare(ctx, t, drums, velOf(g.snare, i), g.snareKind);
        if (full && g.clap && hit(g.clap, i)) clap(ctx, t, drums, 0.9);
        if ((full || (e > 0.35 && i % 4 === 2)) && hit(g.hat, i)) hat(ctx, t, drums, velOf(g.hat, i) * (0.6 + 0.4 * e) * (i % 4 === 0 ? 1 : 0.75));
        if (peak && g.open && hit(g.open, i)) hat(ctx, t, drums, 0.8, true);
        if (peak && g.perc && hit(g.perc, i)) { if (g.id === 'cinematic') tom(ctx, t, drums, 0.7 + (i % 3) * 0.15, 0.9); else if (g.id === 'house' || g.id === 'funk') rim(ctx, t, drums, 0.8); else shaker(ctx, t, drums, 0.9); }
      }
      // trap/phonk hat rolls
      if ((g.id === 'trap' || g.id === 'phonk') && peak && b % 2 === 1) for (let k = 0; k < 6; k++) hat(ctx, t0 + 12 * step + k * (step * 4 / 6), drums, 0.6);
      // fill before an energy jump
      if (eNext - e > 0.2 || (b + 1) % 8 === 0 && full) {
        for (let k = 0; k < 4; k++) snare(ctx, t0 + (12 + k) * step, drums, 0.4 + k * 0.15, g.snareKind);
      }
    }
    // risers into bigger sections
    if (eNext - e > 0.22 && !last) riser(ctx, t0, barDur, fx, 0.18 + 0.15 * eNext);
    // melody / lead
    if (g.lead && e >= 0.72 && !last) {
      const motifBar = (b % 2) * 16;
      for (const n of motif) {
        if (n.s < motifBar || n.s >= motifBar + 16) continue;
        const strong = n.s % 4 === 0;
        const deg = strong ? [0, 2, 4][n.deg % 3] + degree : n.deg + (b % 4 === 3 ? 1 : 0);
        const midi = plan.root + 24 + scale[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
        const t = t0 + (n.s - motifBar) * step;
        const dur = n.len * step * 0.95;
        if (g.lead === 'piano') piano(ctx, t, midi, dur * 1.5, leadBus, 0.9);
        else if (g.lead === 'guitar') pluckString(ctx, t, midi, dur, leadBus, 1, 0.7);
        else if (g.lead === 'bell') piano(ctx, t, midi + 12, dur * 2, leadBus, 0.6, 'bell');
        else if (g.lead === 'epiano') piano(ctx, t, midi, dur * 1.5, leadBus, 0.7, 'epiano');
        else lead(ctx, t, midi, dur, leadBus, 0.9, g.lead as 'square' | 'saw' | 'flute' | 'pluck' | 'whistle');
      }
    }
    // video cut accents
    if (cutBars.has(b)) {
      for (const h of plan.hits) {
        if (Math.floor(h / barDur) !== b) continue;
        // snap to nearest 8th
        const q = Math.round(h / (step * 2)) * step * 2;
        if (e > 0.45 && !g.drumless) crash(ctx, q, drums, 0.55);
        else if (g.id === 'cinematic' || g.id === 'horror') impact(ctx, q, fx, 0.6);
      }
    }
    // ending
    if (last) {
      const fin = chordNotes(plan.root, scale, 0, g.sevenths);
      if (g.chords === 'guitar' || g.chords === 'pluck') fin.forEach((n, k) => pluckString(ctx, t0 + k * 0.03, n, 3, music, 0.9, 0.5));
      else if (g.chords === 'piano' || g.chords === 'epiano') fin.forEach((n) => piano(ctx, t0, n, 3, music, 0.9, g.chords === 'epiano' ? 'epiano' : 'piano'));
      else pad(ctx, t0, fin, Math.min(barDur, 3), music, 0.8, g.chords === 'strings' ? 'strings' : 'warm');
      bass(ctx, t0, plan.root - 12, Math.min(barDur, 2.5), bassBus, g.bassKind === '808' ? '808' : 'sub', 0.9);
      if (!g.drumless) { kick(ctx, t0, drums, 1, g.kickKind); crash(ctx, t0, drums, 0.6); }
    }
  }
  // master fade-out at the very end
  const endT = plan.duration;
  master.gain.setValueAtTime(plan.volume ?? 0.9, Math.max(0, endT - 1.5));
  master.gain.linearRampToValueAtTime(0.0001, endT);
  return { scale: scaleName, bars };
}

export async function renderMusic(plan: MusicPlan, sampleRate = 44100): Promise<AudioBuffer> {
  const len = Math.max(1, Math.floor(plan.duration * sampleRate));
  const OAC = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new OAC(2, len, sampleRate);
  compose(ctx, ctx.destination, plan);
  const buf = await ctx.startRendering();
  // true-peak safety: normalize to -0.4 dBFS
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; } }
  const target = 0.95;
  if (peak > 0) { const k = Math.min(peak > target ? target / peak : 1.6, target / peak); for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } }
  return buf;
}
