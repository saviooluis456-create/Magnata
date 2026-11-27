// Runs the same intelligence engine as the Central do Set on data pulled in the chat (Windsor.ai).
// Usage: npm run analisar -- dados.json > relatorio.md
//
// dados.json: array of
// { id, title, network: "instagram"|"tiktok"|"youtube", publishedAt (ISO or ms), durationSec, format?: "short"|"long",
//   views, likes, comments, shares, saves?, avgWatchSec?, avgViewPct?, followersGained?,
//   editoria?, hookType?, caption?, experiment?: { id, variant } }
// optional second file experiments.json: [{ id, name, variants: [...], minPerVariant }]
import fs from 'node:fs';
import { allLifts, buildPerfs, DIMENSIONS, evaluateExperiment, MATURE_HOURS, pct, type Experiment } from '../src/central/core/analytics';
import type { MetricRow, Network, Post } from '../src/central/core/types';

interface Row {
  id: string; title: string; network: Network; publishedAt: string | number; durationSec: number; format?: 'short' | 'long';
  views: number; likes: number; comments: number; shares: number; saves?: number; avgWatchSec?: number; avgViewPct?: number; followersGained?: number;
  editoria?: Post['editoria']; hookType?: string; caption?: string; experiment?: { id: string; variant: string };
}

const [file, expFile] = process.argv.slice(2);
if (!file) { console.error('Uso: npm run analisar -- dados.json [experimentos.json]'); process.exit(1); }
const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as Row[];
const experiments = expFile ? (JSON.parse(fs.readFileSync(expFile, 'utf8')) as Experiment[]) : [];

const posts: Post[] = [];
const metrics: MetricRow[] = [];
for (const r of rows) {
  const ts = typeof r.publishedAt === 'number' ? r.publishedAt : Date.parse(r.publishedAt);
  const id = `${r.network}:${r.id}`;
  const caption = r.caption ?? '';
  posts.push({
    id, createdAt: ts, format: r.format ?? (r.durationSec <= 180 ? 'short' : 'long'), editoria: r.editoria, hookType: r.hookType, experiment: r.experiment,
    objectKey: '', meta: { width: 1080, height: 1920, duration: r.durationSec, sizeBytes: 0 },
    captions: { instagram: { caption }, tiktok: { caption }, youtube: { title: r.title, description: caption, tags: [] } },
    targets: [{ network: r.network, status: 'publicado', remoteId: r.id, publishedAt: ts }],
  });
  metrics.push({ postId: id, network: r.network, remoteId: r.id, views: r.views, likes: r.likes, comments: r.comments, shares: r.shares, saves: r.saves, avgWatchSec: r.avgWatchSec, avgViewPct: r.avgViewPct, followersGained: r.followersGained, updatedAt: Date.now() });
}

const perfs = buildPerfs(posts, metrics);
const mature = perfs.filter((p) => p.ageHours >= MATURE_HOURS);
const lifts = allLifts(perfs);
const out: string[] = [];
out.push(`# Análise de dados (${new Date().toISOString().slice(0, 10)})`, '', `${perfs.length} vídeos-rede, ${mature.length} com 48h+ (entram nas comparações).`, '');

out.push('## Índice Set (100 = vídeo típico daquela rede e formato)', '', '| Índice | Rede | Vídeo | Views | Compart.+salvos/view | Retenção |', '|---|---|---|---|---|---|');
for (const p of [...mature].sort((a, b) => b.index - a.index)) {
  out.push(`| ${p.index} | ${p.network} | ${p.title.replace(/\|/g, '/')} | ${p.views} | ${(p.shareRate * 100).toFixed(2)}% | ${p.retention != null ? (p.retention * 100).toFixed(0) + '%' : '–'} |`);
}
out.push('');

out.push('## O que funciona (efeito sobre o índice, com encolhimento para amostras pequenas)', '');
for (const d of DIMENSIONS) {
  const ls = lifts.filter((l) => l.dimension === d.key);
  if (!ls.length) continue;
  out.push(`### ${d.label}`, '', '| Valor | n | Efeito | IC 90% | Confiança | Atenção |', '|---|---|---|---|---|---|');
  for (const l of ls) out.push(`| ${l.value} | ${l.n} | ${pct(l.lift)} | ${pct(l.ci[0])} a ${pct(l.ci[1])} | ${l.confidence} | ${l.confoundedWith ? `misturado com ${l.confoundedWith.dimension}="${l.confoundedWith.value}"` : ''} |`);
  out.push('');
}

if (experiments.length) {
  out.push('## Experimentos', '');
  for (const e of experiments) {
    const r = evaluateExperiment({ ...e, status: 'ativo', hypothesis: e.hypothesis ?? '', dimension: e.dimension ?? '', createdAt: 0, createdBy: 'voce', minPerVariant: e.minPerVariant ?? 4 }, perfs);
    out.push(`- **${e.name}**: ${r.note} (${r.perVariant.map((v) => `${v.variant}: ${v.avgIndex} em ${v.n}`).join('; ')})`);
  }
  out.push('');
}
console.log(out.join('\n'));
