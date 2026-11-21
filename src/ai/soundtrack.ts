/**
 * Video understanding → automatic soundtrack.
 * Analyzes cuts, motion, brightness/color, speech and caption keywords; chooses genre, tempo, key and an energy
 * curve; composes music synced to the cuts (crashes/impacts on cuts, risers before peaks), ducks it under speech,
 * and creates a sound-effects track (whooshes on cuts, pops on texts, impacts on motion peaks).
 */
import { GENRES, GENRE_MAP, keyName, renderMusic, type MusicPlan } from '../audio/musicgen';
import { renderMix } from '../engine/audioMix';
import { ensureUrl, loadImage } from '../engine/media';
import { sfxBuffer } from '../engine/sfx';
import { clipEnd, mainClips, mediaById, projectDuration } from '../model/timeline';
import type { Project } from '../model/types';

export interface VideoInsight {
  duration: number;
  cuts: number[];
  /** cuts without a transition sound (get an automatic whoosh) */
  silentCuts: number[];
  cutRate: number; // cuts per minute
  motion: number[]; // per 0.5s window (0..1)
  brightness: number; // 0..1
  saturation: number;
  warmth: number; // -1..1
  speechRatio: number; // 0..1 portion of time with speech
  speechEnv: number[]; // per 0.1s, 0..1
  keywords: string[];
  texts: number[]; // start times of text clips
}

export interface SoundtrackPlan {
  music: MusicPlan;
  reasons: string[];
  mood: string;
  sfx: { t: number; id: string; vol: number; dur: number }[];
  duck: boolean;
}

const MOOD_WORDS: [RegExp, string, string][] = [
  [/dinheiro|neg[oó]cio|empresa|vend|lucro|sucesso|cliente|marketing|business/i, 'corporate', 'negócios/motivacional'],
  [/amor|cora[cç][aã]o|casamento|saudade|fam[ií]lia|beb[eê]/i, 'emotional', 'emocional'],
  [/medo|terror|mist[eé]rio|crime|assassin|morte|caso|sombr/i, 'horror', 'suspense'],
  [/festa|balada|dan[cç]|bail|show|night/i, 'house', 'festa'],
  [/treino|academia|for[cç]a|foco|disciplina|carro|drift|gym/i, 'phonk', 'treino/intenso'],
  [/viagem|praia|estrada|natureza|ver[aã]o|trilha|aventura/i, 'acoustic', 'viagem/leve'],
  [/receita|comida|cozinh|caf[eé]|estud|rotina|organiza/i, 'lofi', 'rotina/aconchego'],
  [/jogo|game|gamer|minecraft|fortnite|stream/i, 'synthwave', 'gamer/retrô'],
  [/crian[cç]a|divertid|engra[cç]ad|brincadeira|pet|cachorro|gato/i, 'ukulele', 'divertido'],
  [/hist[oó]ria|guerra|her[oó]i|conquista|imp[eé]rio|[eé]pico/i, 'cinematic', 'épico'],
];

async function sampleVisuals(p: Project, onProgress?: (f: number) => void) {
  const dur = projectDuration(p);
  const step = Math.max(0.5, dur / 90); // at most ~90 samples
  const times: number[] = [];
  for (let t = step / 2; t < dur; t += step) times.push(t);
  const c = document.createElement('canvas'); c.width = 48; c.height = 48;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const els = new Map<string, HTMLVideoElement>();
  const motion: number[] = [];
  let prev: Uint8ClampedArray | null = null, prevClip = '';
  let sb = 0, ss = 0, sw = 0, n = 0;
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    const clip = mainClips(p).find((x) => t >= x.start && t < clipEnd(x));
    onProgress?.(i / times.length);
    if (!clip || !clip.mediaId) { motion.push(0); continue; }
    const m = mediaById(p, clip.mediaId);
    if (!m || m.kind === 'audio') { motion.push(0); continue; }
    try {
      if (m.kind === 'video') {
        let v = els.get(m.id);
        if (!v) {
          v = document.createElement('video'); v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous';
          v.src = (await ensureUrl(m.id)) ?? '';
          await new Promise<void>((res) => { v!.onloadeddata = () => res(); v!.onerror = () => res(); setTimeout(res, 5000); });
          els.set(m.id, v);
        }
        const st = clip.in + (t - clip.start) * clip.speed;
        await new Promise<void>((res) => { const h = setTimeout(res, 1500); v!.onseeked = () => { clearTimeout(h); res(); }; v!.currentTime = Math.min(st, (v!.duration || st) - 0.05); });
        ctx.drawImage(v, 0, 0, 48, 48);
      } else {
        ctx.drawImage((await loadImage(m.id)) as CanvasImageSource, 0, 0, 48, 48);
      }
      const d = ctx.getImageData(0, 0, 48, 48).data;
      let diff = 0;
      for (let k = 0; k < d.length; k += 4) {
        const r = d[k] / 255, g = d[k + 1] / 255, b = d[k + 2] / 255;
        sb += 0.2126 * r + 0.7152 * g + 0.0722 * b; ss += Math.max(r, g, b) - Math.min(r, g, b); sw += r - b; n++;
        if (prev && prevClip === clip.id) diff += Math.abs(d[k] - prev[k]) + Math.abs(d[k + 1] - prev[k + 1]) + Math.abs(d[k + 2] - prev[k + 2]);
      }
      motion.push(prev && prevClip === clip.id ? Math.min(1, diff / (48 * 48 * 3 * 255) * 6 / Math.max(0.5, step)) : motion[motion.length - 1] ?? 0.3);
      prev = d; prevClip = clip.id;
    } catch { motion.push(0.3); }
  }
  els.forEach((v) => { v.removeAttribute('src'); v.load(); });
  return { motion, step, brightness: n ? sb / n : 0.5, saturation: n ? ss / n : 0.3, warmth: n ? sw / n : 0 };
}

export async function analyzeVideo(p: Project, onProgress?: (msg: string, f?: number) => void): Promise<VideoInsight> {
  const duration = projectDuration(p);
  if (duration <= 0) throw new Error('Adicione vídeos à linha do tempo primeiro');
  onProgress?.('Assistindo ao vídeo…', 0);
  const vis = await sampleVisuals(p, (f) => onProgress?.('Assistindo ao vídeo…', f * 0.8));
  // cuts: main clip boundaries + overlay starts
  const cuts = mainClips(p).slice(1).map((c) => c.start);
  const silentCuts = mainClips(p).slice(1).filter((c) => !c.transition?.sound).map((c) => c.start);
  // speech detection on the existing audio (excluding music tracks)
  onProgress?.('Ouvindo as falas…', 0.85);
  const speechEnv: number[] = [];
  let speechRatio = 0;
  try {
    const voiceOnly: Project = { ...p, clips: p.clips.filter((c) => c.kind === 'video') };
    const buf = await renderMix(voiceOnly, 0, duration, 8000);
    if (buf) {
      const d = buf.getChannelData(0), win = 800;
      let max = 1e-4;
      for (let i = 0; i < d.length; i += win) { let s = 0; for (let k = i; k < Math.min(d.length, i + win); k++) s += d[k] * d[k]; const r = Math.sqrt(s / win); speechEnv.push(r); max = Math.max(max, r); }
      for (let i = 0; i < speechEnv.length; i++) speechEnv[i] = Math.min(1, speechEnv[i] / (max * 0.5));
      speechRatio = speechEnv.filter((v) => v > 0.25).length / Math.max(1, speechEnv.length);
    }
  } catch { /* no audio */ }
  const words = p.captions.words.map((w) => w.text).join(' ') + ' ' + p.clips.filter((c) => c.text).map((c) => c.text!.text).join(' ') + ' ' + p.name;
  const keywords = MOOD_WORDS.filter(([re]) => re.test(words)).map(([, g]) => g);
  const texts = p.clips.filter((c) => c.kind === 'text').map((c) => c.start);
  return {
    duration, cuts, silentCuts, cutRate: (cuts.length / duration) * 60, motion: resample(vis.motion, Math.ceil(duration / 0.5)),
    brightness: vis.brightness, saturation: vis.saturation, warmth: vis.warmth, speechRatio, speechEnv, keywords, texts,
  };
}

function resample(a: number[], n: number) {
  if (!a.length) return Array(n).fill(0.3);
  return Array.from({ length: n }, (_, i) => a[Math.min(a.length - 1, Math.floor((i / n) * a.length))]);
}

/** Chooses genre/tempo/energy from the insight. `override` forces a genre. */
export function planSoundtrack(ins: VideoInsight, opts: { genre?: string; seed?: number; sfx?: boolean; textPops?: boolean; duck?: boolean; energy?: number } = {}): SoundtrackPlan {
  const reasons: string[] = [];
  const avgMotion = ins.motion.reduce((a, b) => a + b, 0) / Math.max(1, ins.motion.length);
  const energetic = Math.min(1, avgMotion * 2.2 + Math.min(1, ins.cutRate / 40) * 0.6 + ins.saturation * 0.4);
  reasons.push(`${ins.cuts.length} cortes (${ins.cutRate.toFixed(0)}/min) · movimento ${avgMotion > 0.25 ? 'alto' : avgMotion > 0.1 ? 'médio' : 'baixo'}`);
  reasons.push(`Imagem ${ins.brightness > 0.55 ? 'clara' : ins.brightness < 0.3 ? 'escura' : 'equilibrada'}, ${ins.warmth > 0.04 ? 'cores quentes' : ins.warmth < -0.04 ? 'cores frias' : 'cores neutras'}, saturação ${ins.saturation > 0.3 ? 'alta' : 'moderada'}`);
  if (ins.speechRatio > 0.15) reasons.push(`Fala em ${Math.round(ins.speechRatio * 100)}% do vídeo → música abaixa sob a voz`);

  // score genres
  const score = new Map<string, number>();
  const add = (g: string, v: number) => score.set(g, (score.get(g) ?? 0) + v);
  GENRES.forEach((g) => add(g.id, 0));
  if (energetic > 0.65) { add('edm', 2); add('house', 1.5); add('phonk', 1.5); add('trap', 1.5); add('rock', 1.2); add('funk', 1); }
  else if (energetic > 0.4) { add('corporate', 1.5); add('house', 1); add('acoustic', 1); add('synthwave', 1); add('reggaeton', 0.8); add('boombap', 0.8); }
  else { add('lofi', 1.5); add('ambient', 1.5); add('emotional', 1.3); add('jazz', 0.8); add('acoustic', 0.6); }
  if (ins.brightness < 0.3) { add('horror', 1.2); add('cinematic', 1.2); add('trap', 0.8); add('synthwave', 0.6); add('ukulele', -2); }
  if (ins.brightness > 0.55 && ins.warmth > 0.03) { add('acoustic', 1.2); add('ukulele', 1); add('reggaeton', 0.8); add('horror', -2); }
  if (ins.warmth < -0.05) { add('synthwave', 0.8); add('ambient', 0.6); add('cinematic', 0.5); }
  if (ins.speechRatio > 0.4) { add('lofi', 1); add('corporate', 1); add('ambient', 0.6); add('rock', -1); add('edm', -0.6); }
  ins.keywords.forEach((g) => add(g, 3));
  if (ins.keywords.length) reasons.push(`Tema detectado: ${ins.keywords.map((g) => MOOD_WORDS.find((m) => m[1] === g)?.[2]).join(', ')}`);
  let genreId = opts.genre ?? [...score.entries()].sort((a, b) => b[1] - a[1])[0][0];
  if (!GENRE_MAP.has(genreId)) genreId = 'corporate';
  const g = GENRE_MAP.get(genreId)!;

  // tempo: align beats to the median cut interval when possible
  let bpm = Math.round((g.bpm[0] + g.bpm[1]) / 2);
  if (ins.cuts.length >= 2) {
    const iv = ins.cuts.map((c, i) => c - (ins.cuts[i - 1] ?? 0)).filter((x) => x > 0.2).sort((a, b) => a - b);
    const med = iv[Math.floor(iv.length / 2)];
    let best = bpm, bestErr = 1e9;
    for (let b = g.bpm[0]; b <= g.bpm[1]; b++) {
      const beat = 60 / b;
      const err = iv.reduce((a, x) => { const k = x / beat; return a + Math.abs(k - Math.round(k)); }, 0) + Math.abs(med / beat - Math.round(med / beat)) * 2;
      if (err < bestErr) { bestErr = err; best = b; }
    }
    bpm = best;
    reasons.push(`Andamento ${bpm} BPM escolhido para as batidas caírem nos cortes`);
  }
  const seed = opts.seed ?? Math.floor(Math.random() * 1e6);
  const minorish = ins.brightness < 0.45 || ['horror', 'cinematic', 'trap', 'phonk', 'synthwave'].includes(genreId);
  const root = 45 + Math.floor((seed % 7));
  const scale = g.scale.includes(minorish ? 'minor' : 'major') ? (minorish ? 'minor' : 'major') : g.scale[0];

  // energy per bar from motion + cut density, shaped into an arc with an intro
  const barDur = (60 / bpm) * 4;
  const bars = Math.max(1, Math.ceil(ins.duration / barDur));
  const energy: number[] = [];
  for (let b = 0; b < bars; b++) {
    const t0 = b * barDur, t1 = t0 + barDur;
    const m = ins.motion.slice(Math.floor(t0 / 0.5), Math.ceil(t1 / 0.5));
    const mot = m.length ? m.reduce((a, x) => a + x, 0) / m.length : avgMotion;
    const cutsIn = ins.cuts.filter((c) => c >= t0 && c < t1).length;
    const x = bars > 1 ? b / (bars - 1) : 1;
    const arc = 0.55 + 0.35 * Math.sin(Math.min(1, x * 1.15) * Math.PI * 0.9);
    let e = arc * 0.55 + Math.min(1, mot * 2.5) * 0.3 + Math.min(1, cutsIn / 3) * 0.25 + (opts.energy ?? 0) * 0.3;
    if (b === 0 && bars > 3) e = Math.min(e, 0.35);
    energy.push(Math.max(0.15, Math.min(1, e * (0.6 + energetic * 0.5))));
  }
  // smooth
  for (let i = 1; i < energy.length - 1; i++) energy[i] = (energy[i - 1] + energy[i] * 2 + energy[i + 1]) / 4;

  const sfx: SoundtrackPlan['sfx'] = [];
  if (opts.sfx !== false) {
    for (const c of ins.silentCuts) sfx.push({ t: Math.max(0, c - 0.25), id: energetic > 0.5 ? 'whoosh' : 'whoosh-soft', vol: 0.5, dur: 0.5 });
    // impacts on the 2 strongest motion peaks (at least 3s apart)
    const peaks = ins.motion.map((v, i) => ({ v, t: i * 0.5 })).sort((a, b) => b.v - a.v);
    const chosen: number[] = [];
    for (const pk of peaks) { if (chosen.length >= 2 || pk.v < 0.35) break; if (chosen.every((x) => Math.abs(x - pk.t) > 3)) chosen.push(pk.t); }
    chosen.forEach((t) => { sfx.push({ t: Math.max(0, t - 1.5), id: 'riser', vol: 0.35, dur: 1.5 }); sfx.push({ t, id: genreId === 'horror' || genreId === 'cinematic' ? 'boom' : 'impact', vol: 0.55, dur: 1.2 }); });
  }
  if (opts.textPops !== false) for (const t of ins.texts) sfx.push({ t, id: 'pop', vol: 0.45, dur: 0.3 });

  return {
    music: { genre: genreId, bpm, root, scale: scale as MusicPlan['scale'], seed, duration: ins.duration, energy, hits: ins.cuts, volume: 0.9 },
    reasons, mood: `${g.emoji} ${g.name} · ${bpm} BPM · ${keyName(root, scale)}`, sfx, duck: opts.duck !== false && ins.speechRatio > 0.1,
  };
}

/** Renders the planned music (with speech ducking) and sfx into two AudioBuffers. */
export async function renderSoundtrack(plan: SoundtrackPlan, ins: VideoInsight) {
  const music = await renderMusic(plan.music);
  if (plan.duck && ins.speechEnv.length) {
    // apply ducking envelope (smooth, -12 dB under speech)
    const sr = music.sampleRate;
    const env = ins.speechEnv;
    const gainAt = (i: number) => { const k = (i / sr) / 0.1; const a = env[Math.floor(k)] ?? 0, b = env[Math.floor(k) + 1] ?? a; const v = a + (b - a) * (k % 1); return v > 0.2 ? 0.28 : 1; };
    let g = 1;
    const coefDown = 1 - Math.exp(-1 / (sr * 0.08)), coefUp = 1 - Math.exp(-1 / (sr * 0.4));
    for (let ch = 0; ch < music.numberOfChannels; ch++) {
      const d = music.getChannelData(ch); g = 1;
      for (let i = 0; i < d.length; i++) { const target = gainAt(i); g += (target - g) * (target < g ? coefDown : coefUp); d[i] *= g; }
    }
  }
  let sfxBuf: AudioBuffer | null = null;
  if (plan.sfx.length) {
    const sr = 44100;
    const OAC = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    const ctx = new OAC(2, Math.max(1, Math.floor(ins.duration * sr)), sr);
    for (const s of plan.sfx) {
      const src = ctx.createBufferSource();
      src.buffer = sfxBuffer(ctx, s.id, s.dur);
      const gn = ctx.createGain(); gn.gain.value = s.vol;
      src.connect(gn); gn.connect(ctx.destination);
      src.start(Math.max(0, s.t));
    }
    sfxBuf = await ctx.startRendering();
  }
  return { music, sfx: sfxBuf };
}
