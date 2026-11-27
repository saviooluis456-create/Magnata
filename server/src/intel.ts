// Intelligence module: metric history, experiments, versioned playbook, AI strategy reports, competitor benchmark.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import {
  allLifts, benchInsights, buildPerfs, evaluateExperiment, MATURE_HOURS, velocity,
  type BenchVideo, type Experiment, type Snapshot,
} from '../../src/central/core/analytics';
import { SEED_MIX, SEED_RULES, type IntelPayload, type Playbook, type StrategyReport } from '../../src/central/core/intel-types';
import { account } from './core';
import * as db from './db';
import type { Env } from './env';
import { api, HttpError, now, uid } from './util';

// ---------- storage ----------
async function snapshots(env: Env): Promise<Snapshot[]> {
  const { results } = await env.DB.prepare('SELECT post_id, network, age_hours, views FROM snapshots WHERE age_hours <= 72 AND post_id IS NOT NULL').all<{ post_id: string; network: string; age_hours: number; views: number }>();
  return results.map((r) => ({ postId: r.post_id, network: r.network as Snapshot['network'], ageHours: r.age_hours, views: r.views }));
}

export async function listExperiments(env: Env): Promise<Experiment[]> {
  const { results } = await env.DB.prepare('SELECT data FROM experiments').all<{ data: string }>();
  return results.map((r) => JSON.parse(r.data) as Experiment).sort((a, b) => b.createdAt - a.createdAt);
}
export async function saveExperiment(env: Env, e: Experiment) {
  await env.DB.prepare('INSERT INTO experiments (id, status, data) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET status = ?2, data = ?3')
    .bind(e.id, e.status, JSON.stringify(e)).run();
}

export async function latestPlaybook(env: Env): Promise<Playbook> {
  const r = await env.DB.prepare('SELECT version, created_at, data FROM playbook ORDER BY version DESC LIMIT 1').first<{ version: number; created_at: number; data: string }>();
  if (r) return { version: r.version, createdAt: r.created_at, ...JSON.parse(r.data) };
  return { version: 0, createdAt: 0, rules: SEED_RULES, mix: SEED_MIX };
}
async function savePlaybook(env: Env, p: Omit<Playbook, 'version' | 'createdAt'>) {
  await env.DB.prepare('INSERT INTO playbook (created_at, data) VALUES (?1, ?2)').bind(now(), JSON.stringify({ rules: p.rules, mix: p.mix })).run();
}

async function latestReport(env: Env): Promise<StrategyReport | null> {
  const r = await env.DB.prepare('SELECT data FROM reports ORDER BY created_at DESC LIMIT 1').first<{ data: string }>();
  return r ? JSON.parse(r.data) : null;
}

async function benchVideos(env: Env): Promise<BenchVideo[]> {
  const { results } = await env.DB.prepare('SELECT data FROM bench_videos').all<{ data: string }>();
  return results.map((r) => JSON.parse(r.data) as BenchVideo);
}
async function benchChannels(env: Env) {
  const { results } = await env.DB.prepare('SELECT channel_id, title, handle FROM bench_channels ORDER BY added_at').all<{ channel_id: string; title: string; handle: string | null }>();
  return results.map((r) => ({ channelId: r.channel_id, title: r.title, handle: r.handle ?? undefined }));
}

// ---------- dataset ----------
export async function intel(env: Env): Promise<IntelPayload> {
  const [posts, rows, exps, snaps, report, playbook, bv, bc] = await Promise.all([
    db.listPosts(env, 500), db.listMetrics(env), listExperiments(env), snapshots(env), latestReport(env), latestPlaybook(env), benchVideos(env), benchChannels(env),
  ]);
  const perfs = buildPerfs(posts, rows);
  // Re-evaluate active experiments on every read; conclude automatically when there's a verdict.
  for (const e of exps) {
    if (e.status !== 'ativo') continue;
    e.result = evaluateExperiment(e, perfs);
    if (e.result.state !== 'coletando') e.status = 'concluido';
    await saveExperiment(env, e);
  }
  const recent = perfs.filter((p) => p.ageHours < 96);
  const vel = recent.map((p) => {
    const v = velocity(snaps, p.postId, p.network);
    return v ? { postId: p.postId, network: p.network, title: p.title, ratio: v.ratio, views: v.views } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.ratio - a.ratio);
  return { perfs, lifts: allLifts(perfs), experiments: exps, velocity: vel, report, playbook, bench: benchInsights(bv), benchChannels: bc };
}

// ---------- AI strategist ----------
const ReportSchema = z.object({
  resumo: z.string(),
  diagnostico: z.array(z.object({ titulo: z.string(), evidencia: z.string(), impacto: z.enum(['alto', 'medio', 'baixo']) })),
  acoes: z.array(z.object({ acao: z.string(), porque: z.string(), como_medir: z.string() })),
  experimentos: z.array(z.object({ nome: z.string(), hipotese: z.string(), dimensao: z.string(), variantes: z.array(z.string()), min_por_variante: z.number() })),
  playbook: z.array(z.object({
    regra: z.string(), evidencia: z.string(),
    confianca: z.enum(['forte', 'media', 'fraca', 'hipotese']),
    origem: z.enum(['dados', 'experimento', 'concorrentes', 'pesquisa']),
    status: z.enum(['ativa', 'teste', 'aposentada']),
  })),
  mix: z.array(z.object({ editoria: z.string(), percentual: z.number(), motivo: z.string() })),
  alertas: z.array(z.string()),
});

const STRATEGIST = `Você é o estrategista-chefe de conteúdo do perfil "Luiz no Set" (filmes, séries, crimes reais ligados ao entretenimento, bastidores e notícias; Instagram Reels, TikTok, YouTube Shorts e vídeo longo; público brasileiro).

Você recebe um resumo estatístico já calculado:
- "Índice Set": 100 = vídeo típico daquela rede e formato no perfil (mistura alcance 50%, compartilhamentos+salvos 30%, retenção 20%).
- "lifts": efeito de cada característica (editoria, gancho, duração, horário, dia, legenda, hashtags) sobre o índice, já com encolhimento estatístico para amostras pequenas, intervalo de 90% e confiança (forte/média/fraca). Só vídeos com 48h+ entram.
- experimentos A/B com teste de permutação, velocidade nas primeiras 24h, concorrentes (vídeos públicos do YouTube) e o playbook atual.

Seu método:
1. Diferencie correlação de causa. Um lift com "misturado_com" não pode ser separado do outro fator: não vire regra, proponha um experimento que isole os dois. Confiança "fraca" vira hipótese a testar, nunca regra ativa. Regra "forte" exige confiança forte nos dados ou experimento vencido.
2. Para cada dúvida importante, proponha um experimento A/B simples (2 variantes, uma única diferença, mínimo 4 vídeos por variante). No máximo 3 novos experimentos, sem repetir os que já existem.
3. Reescreva o playbook completo: mantenha as regras confirmadas, promova as que os dados sustentam, aposente as que os dados contradizem (diga por quê), e mantenha as da pesquisa inicial como "teste" até haver dado. Entre 6 e 15 regras, concretas e acionáveis por quem escreve roteiros ("gancho com número nos 3 primeiros segundos", não "faça bons ganchos").
4. Proponha o mix de editorias da próxima semana (somando 100%).
5. Ações: até 5, específicas para a próxima semana, cada uma com como medir.
6. Se houver poucos dados, diga isso claramente no resumo e baseie-se em concorrentes e pesquisa, marcando confiança baixa.
7. Alertas: quedas fortes, conta com problema, experimento sem dados, rede sem métricas.

Escreva em português do Brasil, direto, sem enrolação. Cite números do resumo como evidência. Não invente dados que não estão no resumo.`;

export async function generateReport(env: Env): Promise<StrategyReport> {
  if (!env.ANTHROPIC_API_KEY) throw new HttpError(400, 'Configure ANTHROPIC_API_KEY no servidor para gerar a análise estratégica.');
  const d = await intel(env);
  const mature = d.perfs.filter((p) => p.ageHours >= MATURE_HOURS);
  const brief = {
    videos: d.perfs.length,
    maduros: mature.length,
    por_rede: Object.fromEntries(['instagram', 'tiktok', 'youtube'].map((n) => [n, d.perfs.filter((p) => p.network === n).length])),
    top: [...mature].sort((a, b) => b.index - a.index).slice(0, 6).map((p) => ({ titulo: p.title, rede: p.network, indice: p.index, views: p.views, share_rate: +p.shareRate.toFixed(4), retencao: p.retention, ...p.features })),
    piores: [...mature].sort((a, b) => a.index - b.index).slice(0, 4).map((p) => ({ titulo: p.title, rede: p.network, indice: p.index, views: p.views, ...p.features })),
    lifts: d.lifts.map((l) => ({ dimensao: l.dimension, valor: l.value, n: l.n, efeito: +(l.lift * 100).toFixed(0), ic90: l.ci.map((x) => +(x * 100).toFixed(0)), confianca: l.confidence, misturado_com: l.confoundedWith ? `${l.confoundedWith.dimension}=${l.confoundedWith.value}` : undefined })),
    experimentos: d.experiments.map((e) => ({ nome: e.name, hipotese: e.hypothesis, variantes: e.variants, status: e.status, resultado: e.result?.note })),
    velocidade_24h: d.velocity.slice(0, 5).map((v) => ({ titulo: v.title, rede: v.network, vezes_a_mediana: +v.ratio.toFixed(2) })),
    concorrentes: d.bench.map((b) => ({ canal: b.channel, mediana_views: b.medianViews, duracao_mediana_s: b.medianDuration, titulo_medio_chars: b.avgTitleLen, padroes_titulo: b.titlePatterns.slice(0, 4).map((t) => ({ padrao: t.pattern, uso: +(t.share * 100).toFixed(0), efeito: +(t.liftVsChannel * 100).toFixed(0) })), outliers: b.outliers.slice(0, 3).map((o) => ({ titulo: o.title, views: o.views })) })),
    playbook_atual: d.playbook?.rules,
    mix_atual: d.playbook?.mix,
    data: new Date().toISOString().slice(0, 10),
  };

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const res = await client.messages.parse({
    model: env.AI_MODEL || 'claude-opus-5-5',
    max_tokens: 16000,
    system: STRATEGIST,
    output_config: { effort: 'high', format: zodOutputFormat(ReportSchema) },
    messages: [{ role: 'user', content: `Resumo estatístico desta semana (JSON):\n${JSON.stringify(brief)}` }],
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) throw new HttpError(502, 'A IA não conseguiu gerar a análise desta vez. Tente de novo.');
  const out = res.parsed_output;

  const report: StrategyReport = {
    id: uid('rep_'), createdAt: now(),
    basedOn: { videos: d.perfs.length, maduros: mature.length, experimentos: d.experiments.length, concorrentes: d.bench.length },
    resumo: out.resumo, diagnostico: out.diagnostico, acoes: out.acoes, alertas: out.alertas,
  };
  await env.DB.prepare('INSERT INTO reports (id, created_at, data) VALUES (?1, ?2, ?3)').bind(report.id, report.createdAt, JSON.stringify(report)).run();
  if (out.playbook.length) await savePlaybook(env, { rules: out.playbook, mix: out.mix.length ? out.mix : d.playbook?.mix ?? SEED_MIX });

  const names = new Set(d.experiments.map((e) => e.name.toLowerCase()));
  for (const x of out.experimentos.slice(0, 3)) {
    if (names.has(x.nome.toLowerCase()) || x.variantes.length < 2) continue;
    await saveExperiment(env, {
      id: uid('exp_'), name: x.nome, hypothesis: x.hipotese, dimension: x.dimensao, variants: x.variantes.slice(0, 3),
      status: 'proposto', minPerVariant: Math.max(3, Math.min(10, Math.round(x.min_por_variante) || 4)), createdAt: now(), createdBy: 'ia',
    });
  }
  return report;
}

// ---------- competitor benchmark (public YouTube data) ----------
const YT = 'https://www.googleapis.com/youtube/v3';

function isoDuration(s: string): number {
  const m = s.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] ?? 0)) * 86400 + (+(m[2] ?? 0)) * 3600 + (+(m[3] ?? 0)) * 60 + (+(m[4] ?? 0));
}

export async function addBenchChannel(env: Env, input: string) {
  const acc = await account(env, 'youtube');
  const handle = input.trim().replace(/^https?:\/\/(www\.)?youtube\.com\//, '').replace(/^@?/, '@').split(/[/?]/)[0];
  const r = await api<{ items?: { id: string; snippet: { title: string; customUrl?: string } }[] }>(
    `${YT}/channels?part=snippet&forHandle=${encodeURIComponent(handle)}`, { headers: { Authorization: `Bearer ${acc.token.access}` } }, 'YouTube canal');
  const c = r.items?.[0];
  if (!c) throw new HttpError(404, `Canal ${handle} não encontrado.`);
  await env.DB.prepare('INSERT INTO bench_channels (channel_id, title, handle, added_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(channel_id) DO UPDATE SET title = ?2, handle = ?3')
    .bind(c.id, c.snippet.title, c.snippet.customUrl ?? handle, now()).run();
  await syncBench(env, [c.id]);
  return { channelId: c.id, title: c.snippet.title };
}

export async function removeBenchChannel(env: Env, id: string) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM bench_channels WHERE channel_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM bench_videos WHERE channel_id = ?1').bind(id),
  ]);
}

/** Last 50 uploads of each tracked channel with views, likes, comments and duration. ~3 quota units per channel. */
export async function syncBench(env: Env, only?: string[]): Promise<number> {
  const chans = only ?? (await benchChannels(env)).map((c) => c.channelId);
  if (!chans.length) return 0;
  const acc = await account(env, 'youtube');
  const h = { Authorization: `Bearer ${acc.token.access}` };
  let count = 0;
  for (const id of chans) {
    const ch = await api<{ items?: { snippet: { title: string }; contentDetails: { relatedPlaylists: { uploads: string } } }[] }>(`${YT}/channels?part=snippet,contentDetails&id=${id}`, { headers: h }, 'YouTube canal');
    const c = ch.items?.[0];
    if (!c) continue;
    const pl = await api<{ items: { contentDetails: { videoId: string } }[] }>(`${YT}/playlistItems?part=contentDetails&maxResults=50&playlistId=${c.contentDetails.relatedPlaylists.uploads}`, { headers: h }, 'YouTube uploads');
    const ids = pl.items.map((i) => i.contentDetails.videoId);
    if (!ids.length) continue;
    const vs = await api<{ items: { id: string; snippet: { title: string; publishedAt: string }; contentDetails: { duration: string }; statistics: Record<string, string> }[] }>(
      `${YT}/videos?part=snippet,contentDetails,statistics&id=${ids.join(',')}`, { headers: h }, 'YouTube vídeos');
    const stmts = vs.items.map((v) => {
      const bvid: BenchVideo = { channel: c.snippet.title, id: v.id, title: v.snippet.title, publishedAt: Date.parse(v.snippet.publishedAt), durationSec: isoDuration(v.contentDetails.duration), views: +(v.statistics.viewCount ?? 0), likes: +(v.statistics.likeCount ?? 0), comments: +(v.statistics.commentCount ?? 0) };
      return env.DB.prepare('INSERT INTO bench_videos (id, channel_id, updated_at, data) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(id) DO UPDATE SET updated_at = ?3, data = ?4').bind(v.id, id, now(), JSON.stringify(bvid));
    });
    if (stmts.length) await env.DB.batch(stmts);
    count += stmts.length;
  }
  return count;
}

/** Plain-text playbook, to paste into Claude when writing scripts (or for the repo's 08-playbook.md). */
export function playbookMarkdown(p: Playbook, r: StrategyReport | null): string {
  const lines = [`# Playbook dinâmico do Luiz no Set (v${p.version}, ${p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR') : 'inicial'})`, ''];
  for (const status of ['ativa', 'teste', 'aposentada'] as const) {
    const rs = p.rules.filter((x) => x.status === status);
    if (!rs.length) continue;
    lines.push(`## Regras ${status === 'ativa' ? 'ativas' : status === 'teste' ? 'em teste' : 'aposentadas'}`, '');
    for (const x of rs) lines.push(`- **${x.regra}** (confiança ${x.confianca}, ${x.origem}): ${x.evidencia}`);
    lines.push('');
  }
  lines.push('## Mix de editorias', '', ...p.mix.map((m) => `- ${m.editoria}: ${m.percentual}% (${m.motivo})`), '');
  if (r) lines.push('## Última análise', '', r.resumo, '', ...r.acoes.map((a) => `- ${a.acao} (${a.porque}; medir: ${a.como_medir})`));
  return lines.join('\n');
}
