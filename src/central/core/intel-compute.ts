// Turns raw data into the intelligence payload. Runs in the browser (and in Claude's scripts), so the Worker
// stays inside the free plan's CPU limit: the server only stores and serves raw data.
import { allLifts, benchInsights, buildPerfs, evaluateExperiment, velocity, type BenchVideo, type Experiment, type Snapshot } from './analytics';
import type { IntelPayload, Playbook, StrategyReport } from './intel-types';
import type { MetricRow, Post } from './types';

export interface IntelRaw {
  posts: Post[];
  rows: MetricRow[];
  snapshots: Snapshot[];
  experiments: Experiment[];
  report: StrategyReport | null;
  playbook: Playbook | null;
  benchVideos: BenchVideo[];
  benchChannels: { channelId: string; title: string; handle?: string }[];
}

export function computeIntel(raw: IntelRaw, now = Date.now()): IntelPayload {
  const perfs = buildPerfs(raw.posts, raw.rows, now);
  const experiments = raw.experiments.map((e) => {
    if (e.status !== 'ativo') return e;
    const result = evaluateExperiment(e, perfs);
    return { ...e, result, status: result.state === 'coletando' ? e.status : ('concluido' as const) };
  });
  const velocityList = perfs.filter((p) => p.ageHours < 96).map((p) => {
    const v = velocity(raw.snapshots, p.postId, p.network);
    return v ? { postId: p.postId, network: p.network, title: p.title, ratio: v.ratio, views: v.views } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.ratio - a.ratio);
  return { perfs, lifts: allLifts(perfs), experiments, velocity: velocityList, report: raw.report, playbook: raw.playbook, bench: benchInsights(raw.benchVideos), benchChannels: raw.benchChannels };
}
