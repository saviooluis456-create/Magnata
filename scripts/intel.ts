// Computes the Central's intelligence from GET /api/intel/raw (saved to a file) and prints a summary for Claude.
// Usage: npm run -s intel -- raw.json
import fs from 'node:fs';
import { DIMENSIONS, MATURE_HOURS, pct } from '../src/central/core/analytics';
import { computeIntel, type IntelRaw } from '../src/central/core/intel-compute';

const file = process.argv[2];
if (!file) { console.error('Uso: npm run -s intel -- raw.json'); process.exit(1); }
const d = computeIntel(JSON.parse(fs.readFileSync(file, 'utf8')) as IntelRaw);
const mature = d.perfs.filter((p) => p.ageHours >= MATURE_HOURS);
const out = [`# Inteligência da Central (${new Date().toISOString().slice(0, 10)})`, '', `${d.perfs.length} medições, ${mature.length} maduras (48h+).`, ''];
out.push('## Índice Set', '', ...[...mature].sort((a, b) => b.index - a.index).map((p) => `- ${p.index} · ${p.network} · ${p.title} (${p.views} views, ${p.features.editoria ?? '-'}, ${p.features.hookType ?? '-'}, ${p.features.duration})`), '');
out.push('## O que funciona', '');
for (const dim of DIMENSIONS) {
  const ls = d.lifts.filter((l) => l.dimension === dim.key);
  if (ls.length) out.push(`- **${dim.label}:** ` + ls.map((l) => `${l.value} ${pct(l.lift)} (n=${l.n}, ${l.confidence}${l.confoundedWith ? `, misturado com ${l.confoundedWith.value}` : ''})`).join(' · '));
}
out.push('', '## Experimentos', '', ...d.experiments.map((e) => `- ${e.name} [${e.status}]: ${e.result?.note ?? 'sem resultado'}`));
out.push('', '## Decolando (24h)', '', ...d.velocity.slice(0, 5).map((v) => `- ${v.title} (${v.network}): ${v.ratio.toFixed(1)}×`));
if (d.bench.length) out.push('', '## Concorrentes', '', ...d.bench.map((b) => `- ${b.channel}: mediana ${b.medianViews} views; padrões: ${b.titlePatterns.slice(0, 3).map((t) => `${t.pattern} ${pct(t.liftVsChannel)}`).join(', ')}`));
console.log(out.join('\n'));
