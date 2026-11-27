// Content intelligence engine. Pure functions, shared by the app and the server.
//
// Core idea: raw views are meaningless across networks and account sizes, so every video gets an
// "Índice Set" — 100 = a typical video of that network on this profile. Everything else (what works,
// experiments, velocity) is computed on that index, in log space, with small-sample protection.
import type { Editoria, MetricRow, Network, Post } from './types';

// ---------- features ----------
export interface Features {
  editoria?: Editoria;
  hookType?: string;
  format: 'short' | 'long';
  duration: string; // bucket
  hour: string; // bucket, Brasília time
  weekday: string;
  captionSize: string;
  hashtags: string;
  experiment?: string;
  variant?: string;
}

export const DIMENSIONS: { key: keyof Features; label: string }[] = [
  { key: 'editoria', label: 'Editoria' },
  { key: 'hookType', label: 'Tipo de gancho' },
  { key: 'duration', label: 'Duração' },
  { key: 'hour', label: 'Horário' },
  { key: 'weekday', label: 'Dia da semana' },
  { key: 'captionSize', label: 'Tamanho da legenda' },
  { key: 'hashtags', label: 'Nº de hashtags' },
];

export function durationBucket(sec: number): string {
  if (sec < 30) return 'até 30s';
  if (sec < 45) return '30–45s';
  if (sec < 60) return '45–60s';
  if (sec < 90) return '60–90s';
  if (sec <= 180) return '90s–3min';
  if (sec < 600) return '3–10min';
  if (sec < 1200) return '10–20min';
  return '20min+';
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
/** Brasília has no daylight saving time since 2019: UTC−3. */
export function brt(ts: number): Date { return new Date(ts - 3 * 3600_000); }

export function hourBucket(ts: number): string {
  const h = brt(ts).getUTCHours();
  if (h < 6) return 'madrugada (0–6h)';
  if (h < 11) return 'manhã (6–11h)';
  if (h < 14) return 'almoço (11–14h)';
  if (h < 18) return 'tarde (14–18h)';
  if (h < 22) return 'noite (18–22h)';
  return 'tarde da noite (22–24h)';
}

export const weekday = (ts: number) => WEEKDAYS[brt(ts).getUTCDay()];

export function featuresOf(p: Post, network: Network, publishedAt: number): Features {
  const caption = network === 'youtube' ? p.captions.youtube.description : p.captions[network].caption;
  const tags = (caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
  const len = caption.replace(/#[\p{L}\p{N}_]+/gu, '').trim().length;
  return {
    editoria: p.editoria,
    hookType: p.hookType?.trim().toLowerCase() || undefined,
    format: p.format,
    duration: durationBucket(p.meta.duration),
    hour: hourBucket(publishedAt),
    weekday: weekday(publishedAt),
    captionSize: len < 120 ? 'curta (<120)' : len < 300 ? 'média (120–300)' : 'longa (300+)',
    hashtags: tags === 0 ? '0' : tags <= 3 ? '1–3' : '4–5',
    experiment: p.experiment?.id,
    variant: p.experiment?.variant,
  };
}

// ---------- index ----------
export interface Perf {
  postId: string;
  network: Network;
  title: string;
  publishedAt: number;
  ageHours: number;
  features: Features;
  views: number;
  engagementRate: number; // (likes+comments+shares+saves)/views
  shareRate: number; // (shares+saves)/views — strongest growth signal
  retention?: number; // avgViewPct (YouTube) or avg watch seconds / duration
  followersGained?: number;
  /** 100 = typical video of this network on this profile. */
  index: number;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Minimum age before a video enters comparisons: views are still climbing before that. */
export const MATURE_HOURS = 48;

export function buildPerfs(posts: Post[], rows: MetricRow[], now = Date.now()): Perf[] {
  const out: Omit<Perf, 'index'>[] = [];
  for (const r of rows) {
    const p = posts.find((x) => x.id === r.postId);
    if (!p) continue;
    const t = p.targets.find((x) => x.network === r.network);
    const publishedAt = t?.publishedAt ?? p.scheduledAt ?? p.createdAt;
    const views = Math.max(0, r.views);
    const inter = r.likes + r.comments + r.shares + (r.saves ?? 0);
    const retention = r.avgViewPct != null ? r.avgViewPct / 100 : r.avgWatchSec != null && p.meta.duration > 0 ? Math.min(1.5, r.avgWatchSec / p.meta.duration) : undefined;
    out.push({
      postId: p.id, network: r.network, title: p.captions.youtube.title, publishedAt,
      ageHours: (now - publishedAt) / 3600_000, features: featuresOf(p, r.network, publishedAt),
      views, engagementRate: views ? inter / views : 0, shareRate: views ? (r.shares + (r.saves ?? 0)) / views : 0,
      retention, followersGained: r.followersGained,
    });
  }
  // Baselines per network and format (a Short and a long video are different games).
  const groups = new Map<string, typeof out>();
  for (const x of out) { const k = `${x.network}:${x.features.format}`; groups.set(k, [...(groups.get(k) ?? []), x]); }
  const perfs: Perf[] = [];
  for (const g of groups.values()) {
    const base = g.filter((x) => x.ageHours >= MATURE_HOURS);
    const ref = base.length >= 3 ? base : g;
    const mViews = median(ref.map((x) => x.views)) || 1;
    const mShare = median(ref.map((x) => x.shareRate)) || 1e-4;
    const rets = ref.map((x) => x.retention).filter((x): x is number => x != null);
    const mRet = median(rets) || 0;
    for (const x of g) {
      const rel = (v: number, m: number) => Math.min(4, Math.max(0.05, v / m));
      // Weighted geometric mean: reach 50%, shares+saves 30%, retention 20% (or reach again when unknown).
      const r = mRet && x.retention != null ? rel(x.retention, mRet) : rel(x.views, mViews);
      const idx = Math.exp(0.5 * Math.log(rel(x.views, mViews)) + 0.3 * Math.log(rel(x.shareRate, mShare)) + 0.2 * Math.log(r));
      perfs.push({ ...x, index: Math.round(idx * 100) });
    }
  }
  return perfs.sort((a, b) => b.publishedAt - a.publishedAt);
}

// ---------- statistics ----------
/** Deterministic PRNG so analyses don't change between page loads. */
export function rng(seed = 42) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function bootstrapCI(xs: number[], iters = 500, seed = 7): [number, number] {
  if (xs.length < 2) return [-Infinity, Infinity];
  const r = rng(seed);
  const ms: number[] = [];
  for (let i = 0; i < iters; i++) { let s = 0; for (let j = 0; j < xs.length; j++) s += xs[Math.floor(r() * xs.length)]; ms.push(s / xs.length); }
  ms.sort((a, b) => a - b);
  return [ms[Math.floor(iters * 0.05)], ms[Math.floor(iters * 0.95)]]; // 90% interval
}

/** Two-sided permutation test on the difference of means. */
export function permutationP(a: number[], b: number[], iters = 2000, seed = 11): number {
  if (!a.length || !b.length) return 1;
  const obs = Math.abs(mean(a) - mean(b));
  const all = [...a, ...b];
  const r = rng(seed);
  let hits = 0;
  for (let i = 0; i < iters; i++) {
    for (let j = all.length - 1; j > 0; j--) { const k = Math.floor(r() * (j + 1)); [all[j], all[k]] = [all[k], all[j]]; }
    if (Math.abs(mean(all.slice(0, a.length)) - mean(all.slice(a.length))) >= obs - 1e-12) hits++;
  }
  return (hits + 1) / (iters + 1);
}

export type Confidence = 'forte' | 'média' | 'fraca';

export interface Lift {
  dimension: keyof Features;
  value: string;
  n: number;
  /** Shrunk effect vs the profile average, e.g. +0.35 = 35% above typical. */
  lift: number;
  ci: [number, number];
  confidence: Confidence;
  avgIndex: number;
  /** Another characteristic that almost always comes with this one: the effect may belong to it. */
  confoundedWith?: { dimension: keyof Features; value: string };
}

/** Shrinkage toward "no effect": a value needs evidence to move away from 0. k = pseudo-observations. */
const SHRINK_K = 3;

export function liftsBy(perfs: Perf[], dimension: keyof Features, minN = 2): Lift[] {
  const mature = perfs.filter((p) => p.ageHours >= MATURE_HOURS);
  const logs = mature.map((p) => Math.log(p.index / 100));
  const center = mean(logs); // profile-wide average in log space
  const byValue = new Map<string, number[]>();
  mature.forEach((p, i) => { const v = p.features[dimension]; if (v) byValue.set(String(v), [...(byValue.get(String(v)) ?? []), logs[i] - center]); });
  const out: Lift[] = [];
  for (const [value, xs] of byValue) {
    if (xs.length < minN) continue;
    const shrunk = (xs.length * mean(xs)) / (xs.length + SHRINK_K);
    const [lo, hi] = bootstrapCI(xs);
    const lift = Math.exp(shrunk) - 1;
    const excludesZero = lo > 0 || hi < 0;
    const confidence: Confidence = xs.length >= 8 && excludesZero && Math.abs(lift) >= 0.15 ? 'forte' : xs.length >= 4 && (excludesZero || Math.abs(lift) >= 0.25) ? 'média' : 'fraca';
    out.push({ dimension, value, n: xs.length, lift, ci: [Math.exp(lo) - 1, Math.exp(hi) - 1], confidence, avgIndex: Math.round(100 * Math.exp(mean(xs) + center)) });
  }
  return out.sort((a, b) => b.lift - a.lift);
}

export function allLifts(perfs: Perf[]): Lift[] {
  const lifts = DIMENSIONS.flatMap((d) => liftsBy(perfs, d.key));
  const mature = perfs.filter((p) => p.ageHours >= MATURE_HOURS);
  // Confounding check: if ≥80% of this group shares a value of another dimension that is not that common overall,
  // the two effects can't be separated with observational data. Point to the stronger one.
  for (const l of lifts) {
    const group = mature.filter((p) => String(p.features[l.dimension] ?? '') === l.value);
    let best: { dimension: keyof Features; value: string; share: number } | undefined;
    for (const d of DIMENSIONS) {
      if (d.key === l.dimension) continue;
      const counts = new Map<string, number>();
      for (const p of group) { const v = p.features[d.key]; if (v) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1); }
      for (const [v, c] of counts) {
        const share = c / group.length;
        const overall = mature.filter((p) => String(p.features[d.key] ?? '') === v).length / Math.max(1, mature.length);
        if (share >= 0.8 && overall <= 0.5 && (!best || share > best.share)) best = { dimension: d.key, value: v, share };
      }
    }
    if (best) {
      const other = lifts.find((x) => x.dimension === best!.dimension && x.value === best!.value);
      // Only flag the weaker (or equal) of the pair as "possibly borrowed".
      if (!other || Math.abs(other.lift) >= Math.abs(l.lift) - 1e-9) l.confoundedWith = { dimension: best.dimension, value: best.value };
    }
  }
  return lifts;
}

// ---------- experiments ----------
export interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  dimension: string; // what is being changed, e.g. "gancho", "duração", "horário"
  variants: string[]; // e.g. ["A: pergunta", "B: afirmação chocante"]
  status: 'proposto' | 'ativo' | 'concluido' | 'descartado';
  minPerVariant: number;
  createdAt: number;
  createdBy: 'ia' | 'voce';
  result?: ExperimentResult;
}

export interface ExperimentResult {
  state: 'coletando' | 'vencedor' | 'empate';
  perVariant: { variant: string; n: number; avgIndex: number }[];
  winner?: string;
  lift?: number;
  p?: number;
  note: string;
}

/**
 * Removes the editoria effect before comparing variants: a "caso real" video in variant A and a "notícia"
 * in variant B would otherwise swamp the difference being tested.
 */
function editoriaAdjuster(perfs: Perf[]): (p: Perf) => number {
  const mature = perfs.filter((p) => p.ageHours >= MATURE_HOURS);
  const center = mean(mature.map((p) => Math.log(p.index / 100)));
  const byEd = new Map<string, number[]>();
  for (const p of mature) if (p.features.editoria) byEd.set(p.features.editoria, [...(byEd.get(p.features.editoria) ?? []), Math.log(p.index / 100)]);
  const effect = new Map([...byEd].filter(([, xs]) => xs.length >= 3).map(([k, xs]) => [k, mean(xs) - center]));
  return (p) => Math.log(p.index / 100) - (p.features.editoria ? effect.get(p.features.editoria) ?? 0 : 0);
}

export function evaluateExperiment(exp: Experiment, perfs: Perf[]): ExperimentResult {
  const adj = editoriaAdjuster(perfs);
  const groups = exp.variants.map((v) => ({ v, xs: perfs.filter((p) => p.features.experiment === exp.id && p.features.variant === v && p.ageHours >= MATURE_HOURS).map(adj) }));
  const perVariant = groups.map((g) => ({ variant: g.v, n: g.xs.length, avgIndex: g.xs.length ? Math.round(100 * Math.exp(mean(g.xs))) : 0 }));
  const ready = groups.filter((g) => g.xs.length >= exp.minPerVariant);
  if (ready.length < 2) {
    const missing = groups.map((g) => `${g.v}: ${g.xs.length}/${exp.minPerVariant}`).join(' · ');
    return { state: 'coletando', perVariant, note: `Coletando dados (vídeos com 48h+): ${missing}` };
    // (perVariant shows the editoria-adjusted index)
  }
  const sorted = [...ready].sort((a, b) => mean(b.xs) - mean(a.xs));
  const [best, second] = sorted;
  const p = permutationP(best.xs, second.xs);
  const lift = Math.exp(mean(best.xs) - mean(second.xs)) - 1;
  if (p < 0.1 && lift > 0.1) {
    return { state: 'vencedor', perVariant, winner: best.v, lift, p, note: `"${best.v}" rende ${(lift * 100).toFixed(0)}% mais que "${second.v}" (p=${p.toFixed(3)}).` };
  }
  const total = groups.reduce((s, g) => s + g.xs.length, 0);
  return total >= exp.minPerVariant * exp.variants.length * 2
    ? { state: 'empate', perVariant, lift, p, note: `Sem diferença clara depois de ${total} vídeos (p=${p.toFixed(2)}). Use o que for mais fácil de produzir.` }
    : { state: 'coletando', perVariant, lift, p, note: `Tendência: "${best.v}" à frente (+${(lift * 100).toFixed(0)}%), mas ainda sem certeza (p=${p.toFixed(2)}). Continue alternando.` };
}

/** Which variant should the next post use? Alternates to keep groups balanced. */
export function nextVariant(exp: Experiment, perfs: Perf[]): string {
  const counts = exp.variants.map((v) => perfs.filter((p) => p.features.experiment === exp.id && p.features.variant === v).length);
  return exp.variants[counts.indexOf(Math.min(...counts))];
}

// ---------- velocity ----------
export interface Snapshot { postId: string; network: Network; ageHours: number; views: number }

/** Views at ~24h compared with the median of previous videos at the same age: early "hit" detector. */
export function velocity(snaps: Snapshot[], postId: string, network: Network, atHours = 24): { ratio: number; views: number; baseline: number } | null {
  const near = (s: Snapshot) => Math.abs(s.ageHours - atHours) <= atHours * 0.35;
  const mine = snaps.filter((s) => s.postId === postId && s.network === network && near(s)).sort((a, b) => Math.abs(a.ageHours - atHours) - Math.abs(b.ageHours - atHours))[0];
  if (!mine) return null;
  const others = new Map<string, Snapshot>();
  for (const s of snaps) {
    if (s.network !== network || s.postId === postId || !near(s)) continue;
    const prev = others.get(s.postId);
    if (!prev || Math.abs(s.ageHours - atHours) < Math.abs(prev.ageHours - atHours)) others.set(s.postId, s);
  }
  if (others.size < 3) return null;
  const baseline = median([...others.values()].map((s) => s.views)) || 1;
  return { ratio: mine.views / baseline, views: mine.views, baseline };
}

// ---------- benchmark (competitors) ----------
export interface BenchVideo { channel: string; id: string; title: string; publishedAt: number; durationSec: number; views: number; likes: number; comments: number }

export interface BenchInsight { channel: string; videos: number; medianViews: number; outliers: BenchVideo[]; medianDuration: number; avgTitleLen: number; titlePatterns: { pattern: string; share: number; liftVsChannel: number }[] }

const TITLE_PATTERNS: [string, RegExp][] = [
  ['número no título', /\d/],
  ['pergunta', /\?/],
  ['"explicado" / "entenda"', /explicad|entenda|explica/i],
  ['"verdade" / "real"', /verdade|real\b|história real|caso real/i],
  ['"final"', /\bfinal\b/i],
  ['"tudo" / "todos"', /\btud[oa]s?\b|\btodos?\b/i],
  ['CAIXA ALTA', /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{4,}\b/],
  ['nome de franquia + ":"', /^[^:]{2,30}:/],
];

export function benchInsights(videos: BenchVideo[]): BenchInsight[] {
  const byCh = new Map<string, BenchVideo[]>();
  for (const v of videos) byCh.set(v.channel, [...(byCh.get(v.channel) ?? []), v]);
  return [...byCh.entries()].map(([channel, vs]) => {
    const mv = median(vs.map((v) => v.views)) || 1;
    const lv = (xs: BenchVideo[]) => (xs.length ? Math.exp(mean(xs.map((v) => Math.log((v.views + 1) / mv)))) - 1 : 0);
    return {
      channel, videos: vs.length, medianViews: Math.round(mv),
      outliers: vs.filter((v) => v.views >= 2 * mv).sort((a, b) => b.views - a.views).slice(0, 5),
      medianDuration: median(vs.map((v) => v.durationSec)),
      avgTitleLen: Math.round(mean(vs.map((v) => v.title.length))),
      titlePatterns: TITLE_PATTERNS.map(([pattern, re]) => {
        const hit = vs.filter((v) => re.test(v.title));
        return { pattern, share: hit.length / vs.length, liftVsChannel: lv(hit) };
      }).filter((x) => x.share > 0).sort((a, b) => b.liftVsChannel - a.liftVsChannel),
    };
  });
}

export const pct = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;
