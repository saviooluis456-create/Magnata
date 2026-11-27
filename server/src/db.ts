import type { CommentItem, MetricRow, Network, Post, Settings } from '../../src/central/core/types';
import type { Env } from './env';
import { decrypt, encrypt, now } from './util';

export interface Token { access: string; refresh?: string; expiresAt?: number; refreshExpiresAt?: number }
export interface Account { network: Network; remoteId: string; name?: string; handle?: string; token: Token }

// ---------- accounts ----------
export async function saveAccount(env: Env, a: Account): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO accounts (network, remote_id, name, handle, token_enc, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(network) DO UPDATE SET remote_id=?2, name=?3, handle=?4, token_enc=?5, updated_at=?6`,
  ).bind(a.network, a.remoteId, a.name ?? null, a.handle ?? null, await encrypt(env, a.token), now()).run();
}

export async function getAccount(env: Env, network: Network): Promise<Account | null> {
  const r = await env.DB.prepare('SELECT * FROM accounts WHERE network = ?1').bind(network).first<Record<string, string>>();
  if (!r) return null;
  return { network, remoteId: r.remote_id, name: r.name ?? undefined, handle: r.handle ?? undefined, token: await decrypt<Token>(env, r.token_enc) };
}

export async function deleteAccount(env: Env, network: Network) {
  await env.DB.prepare('DELETE FROM accounts WHERE network = ?1').bind(network).run();
}

// ---------- oauth state ----------
export async function saveState(env: Env, state: string, network: Network) {
  await env.DB.prepare('INSERT INTO oauth_states (state, network, created_at) VALUES (?1, ?2, ?3)').bind(state, network, now()).run();
  await env.DB.prepare('DELETE FROM oauth_states WHERE created_at < ?1').bind(now() - 15 * 60_000).run();
}

export async function takeState(env: Env, state: string, network: Network): Promise<boolean> {
  const r = await env.DB.prepare('DELETE FROM oauth_states WHERE state = ?1 AND network = ?2 AND created_at > ?3 RETURNING state')
    .bind(state, network, now() - 15 * 60_000).first();
  return !!r;
}

// ---------- posts ----------
export function postStatus(p: Post): string {
  const s = p.targets.map((t) => t.status);
  if (s.some((x) => x === 'enviando')) return 'processando';
  if (s.every((x) => x === 'publicado' || x === 'privado')) return 'concluido';
  if (s.some((x) => x === 'erro') && !s.some((x) => x === 'pendente' || x === 'agendado')) return 'erro';
  if (p.scheduledAt && p.scheduledAt > now()) return 'agendado';
  return 'pendente';
}

export async function savePost(env: Env, p: Post) {
  await env.DB.prepare(
    `INSERT INTO posts (id, created_at, scheduled_at, status, data) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(id) DO UPDATE SET scheduled_at=?3, status=?4, data=?5`,
  ).bind(p.id, p.createdAt, p.scheduledAt ?? null, postStatus(p), JSON.stringify(p)).run();
}

export async function getPost(env: Env, id: string): Promise<Post | null> {
  const r = await env.DB.prepare('SELECT data FROM posts WHERE id = ?1').bind(id).first<{ data: string }>();
  return r ? (JSON.parse(r.data) as Post) : null;
}

export async function listPosts(env: Env, limit = 100): Promise<Post[]> {
  const { results } = await env.DB.prepare('SELECT data FROM posts ORDER BY created_at DESC LIMIT ?1').bind(limit).all<{ data: string }>();
  return results.map((r) => JSON.parse(r.data) as Post);
}

export async function duePosts(env: Env): Promise<Post[]> {
  const { results } = await env.DB.prepare(
    "SELECT data FROM posts WHERE status IN ('agendado','pendente') AND (scheduled_at IS NULL OR scheduled_at <= ?1) ORDER BY scheduled_at LIMIT 5",
  ).bind(now()).all<{ data: string }>();
  return results.map((r) => JSON.parse(r.data) as Post);
}

export async function deletePost(env: Env, id: string) {
  await env.DB.prepare('DELETE FROM posts WHERE id = ?1').bind(id).run();
}

// ---------- comments ----------
export async function upsertComment(env: Env, c: CommentItem, keepExisting = true): Promise<boolean> {
  if (keepExisting) {
    const exists = await env.DB.prepare('SELECT 1 FROM comments WHERE id = ?1').bind(c.id).first();
    if (exists) return false;
  }
  await env.DB.prepare(
    `INSERT INTO comments (id, network, status, created_at, data) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(id) DO UPDATE SET status=?3, data=?5`,
  ).bind(c.id, c.network, c.status, c.createdAt, JSON.stringify(c)).run();
  return true;
}

export async function listComments(env: Env, status?: string, limit = 200): Promise<CommentItem[]> {
  const q = status
    ? env.DB.prepare('SELECT data FROM comments WHERE status = ?1 ORDER BY created_at DESC LIMIT ?2').bind(status, limit)
    : env.DB.prepare('SELECT data FROM comments ORDER BY created_at DESC LIMIT ?1').bind(limit);
  const { results } = await q.all<{ data: string }>();
  return results.map((r) => JSON.parse(r.data) as CommentItem);
}

export async function getComment(env: Env, id: string): Promise<CommentItem | null> {
  const r = await env.DB.prepare('SELECT data FROM comments WHERE id = ?1').bind(id).first<{ data: string }>();
  return r ? (JSON.parse(r.data) as CommentItem) : null;
}

// ---------- metrics ----------
export async function saveMetric(env: Env, m: MetricRow) {
  await env.DB.prepare(
    `INSERT INTO metrics (network, remote_id, post_id, updated_at, data) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(network, remote_id) DO UPDATE SET post_id=?3, updated_at=?4, data=?5`,
  ).bind(m.network, m.remoteId, m.postId || null, m.updatedAt, JSON.stringify(m)).run();
}

export async function listMetrics(env: Env): Promise<MetricRow[]> {
  const { results } = await env.DB.prepare('SELECT data FROM metrics ORDER BY updated_at DESC LIMIT 500').all<{ data: string }>();
  return results.map((r) => JSON.parse(r.data) as MetricRow);
}

// ---------- settings ----------
const DEFAULT_SETTINGS: Settings = { replyMode: 'aprovacao', extraBlockedHashtags: [], signature: '' };

export async function getSettings(env: Env): Promise<Settings> {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'settings'").first<{ value: string }>();
  return r ? { ...DEFAULT_SETTINGS, ...JSON.parse(r.value) } : DEFAULT_SETTINGS;
}

export async function saveSettings(env: Env, s: Settings) {
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('settings', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1")
    .bind(JSON.stringify(s)).run();
}

// ---------- metric history (growth curves, 24h velocity) ----------
export async function saveSnapshot(env: Env, m: MetricRow, publishedAt: number | undefined) {
  if (!publishedAt) return;
  const age = (now() - publishedAt) / 3600_000;
  if (age > 24 * 30) return; // the first month is what matters for curves
  await env.DB.prepare('INSERT OR IGNORE INTO snapshots (network, remote_id, post_id, age_hours, views, captured_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(m.network, m.remoteId, m.postId || null, age, m.views, now()).run();
}

