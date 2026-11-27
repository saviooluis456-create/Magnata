import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allLifts, benchInsights, buildPerfs, durationBucket, evaluateExperiment, hourBucket, liftsBy, nextVariant, permutationP, velocity, type Experiment } from '../../src/central/core/analytics';
import type { MetricRow, Post } from '../../src/central/core/types';

const DAY = 86400_000;
const NOW = Date.UTC(2026, 11, 20, 15);
function post(i: number, o: Partial<Post> & { views: number; shares?: number; ageDays?: number }): [Post, MetricRow] {
  const publishedAt = NOW - (o.ageDays ?? 5) * DAY;
  const p: Post = {
    id: `p${i}`, createdAt: publishedAt, format: 'short', editoria: o.editoria, hookType: o.hookType, experiment: o.experiment,
    objectKey: 'videos/x.mp4', meta: { width: 1080, height: 1920, duration: o.meta?.duration ?? 45, sizeBytes: 1 },
    captions: { instagram: { caption: 'texto #a #b' }, tiktok: { caption: 'texto' }, youtube: { title: `v${i}`, description: '', tags: [] } },
    targets: [{ network: 'instagram', status: 'publicado', remoteId: `r${i}`, publishedAt }],
  };
  const m: MetricRow = { postId: p.id, network: 'instagram', remoteId: `r${i}`, views: o.views, likes: o.views * 0.05, comments: 2, shares: o.shares ?? o.views * 0.01, saves: 0, updatedAt: NOW };
  return [p, m];
}
function build(specs: Parameters<typeof post>[1][]) {
  const pairs = specs.map((s, i) => post(i, s));
  return buildPerfs(pairs.map((x) => x[0]), pairs.map((x) => x[1]), NOW);
}

test('index: typical video ≈ 100, hit far above', () => {
  const perfs = build([{ views: 1000 }, { views: 1100 }, { views: 900 }, { views: 1000 }, { views: 10000, shares: 400 }]);
  const hit = perfs.find((p) => p.views === 10000)!;
  const typical = perfs.find((p) => p.views === 1000)!;
  assert.ok(typical.index > 85 && typical.index < 115, String(typical.index));
  assert.ok(hit.index > 250, String(hit.index));
});

test('lifts: crime editoria beats news, with shrinkage on small samples', () => {
  const specs = [
    ...Array.from({ length: 8 }, () => ({ views: 3000, shares: 90, editoria: 'crime' as const })),
    ...Array.from({ length: 8 }, () => ({ views: 1000, shares: 10, editoria: 'noticia' as const })),
    { views: 9000, shares: 300, editoria: 'teoria' as const }, { views: 9000, shares: 300, editoria: 'teoria' as const },
  ];
  const lifts = liftsBy(build(specs), 'editoria');
  const crime = lifts.find((l) => l.value === 'crime')!;
  const news = lifts.find((l) => l.value === 'noticia')!;
  const teoria = lifts.find((l) => l.value === 'teoria')!;
  assert.ok(crime.lift > 0.2 && news.lift < -0.2, JSON.stringify(lifts));
  assert.equal(crime.confidence, 'forte');
  assert.equal(teoria.confidence, 'fraca'); // only 2 videos: huge raw effect but low confidence
  assert.ok(teoria.lift < Math.exp(Math.log(9)) - 1, 'shrunk toward zero');
});

test('young videos are excluded from comparisons', () => {
  const lifts = liftsBy(build([{ views: 100, ageDays: 0.5, editoria: 'crime' }, { views: 100, ageDays: 0.5, editoria: 'crime' }, { views: 1000 }, { views: 1000 }]), 'editoria');
  assert.equal(lifts.length, 0);
});

test('experiment: winner with clear difference, collecting when small', () => {
  const exp: Experiment = { id: 'e1', name: 'gancho', hypothesis: '', dimension: 'gancho', variants: ['A', 'B'], status: 'ativo', minPerVariant: 4, createdAt: 0, createdBy: 'ia' };
  const mk = (v: string, views: number, n: number) => Array.from({ length: n }, (_, i) => ({ views: views + i * 37, experiment: { id: 'e1', variant: v } }));
  const clear = build([...mk('A', 4000, 6), ...mk('B', 1000, 6)]);
  const r = evaluateExperiment(exp, clear);
  assert.equal(r.state, 'vencedor');
  assert.equal(r.winner, 'A');
  const small = build([...mk('A', 4000, 2), ...mk('B', 1000, 1)]);
  assert.equal(evaluateExperiment(exp, small).state, 'coletando');
  assert.equal(nextVariant(exp, small), 'B');
});

test('permutation test: identical groups are not significant', () => {
  assert.ok(permutationP([1, 2, 3, 4], [1, 2, 3, 4]) > 0.5);
  assert.ok(permutationP([10, 11, 12, 13, 14], [1, 2, 3, 2, 1]) < 0.05);
});

test('buckets and Brasília time', () => {
  assert.equal(durationBucket(52), '45–60s');
  assert.equal(durationBucket(900), '10–20min');
  assert.equal(hourBucket(Date.UTC(2026, 0, 1, 22)), 'noite (18–22h)'); // 19h BRT
});

test('velocity flags a fast start', () => {
  const snaps = [
    { postId: 'a', network: 'tiktok' as const, ageHours: 24, views: 500 },
    { postId: 'b', network: 'tiktok' as const, ageHours: 23, views: 600 },
    { postId: 'c', network: 'tiktok' as const, ageHours: 25, views: 400 },
    { postId: 'x', network: 'tiktok' as const, ageHours: 24, views: 3000 },
  ];
  assert.equal(velocity(snaps, 'x', 'tiktok')!.ratio, 6);
});

test('benchmark finds outliers and title patterns', () => {
  const vids = Array.from({ length: 10 }, (_, i) => ({ channel: 'c', id: String(i), title: i < 3 ? `Duna: o FINAL explicado ${i}` : `vlog ${i}`, publishedAt: 0, durationSec: 600, views: i < 3 ? 50000 : 10000, likes: 0, comments: 0 }));
  const [b] = benchInsights(vids);
  assert.equal(b.outliers.length, 3);
  assert.equal(b.titlePatterns[0].liftVsChannel > 1, true);
});

test('confounding: duration that always comes with crime is flagged', () => {
  const specs = [
    ...Array.from({ length: 6 }, (_, i) => ({ views: 3000 + i * 50, shares: 90, editoria: 'crime' as const, meta: { width: 1080, height: 1920, duration: 25, sizeBytes: 1 } })),
    ...Array.from({ length: 6 }, (_, i) => ({ views: 1000 + i * 50, shares: 10, editoria: 'noticia' as const, meta: { width: 1080, height: 1920, duration: 50, sizeBytes: 1 } })),
    ...Array.from({ length: 6 }, (_, i) => ({ views: 1200 + i * 50, shares: 12, editoria: 'estreia' as const, meta: { width: 1080, height: 1920, duration: 75, sizeBytes: 1 } })),
  ];
  const lifts = allLifts(build(specs as Parameters<typeof post>[1][]));
  const short = lifts.find((l) => l.dimension === 'duration' && l.value === 'até 30s')!;
  const crime = lifts.find((l) => l.dimension === 'editoria' && l.value === 'crime')!;
  assert.ok(short.confoundedWith || crime.confoundedWith, 'one of the pair is flagged');
});
