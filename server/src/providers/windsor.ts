// Instagram through Windsor.ai. Windsor's REST API (connectors.windsor.ai) is read-only: account, media and
// metrics. Publishing and comment replies on Windsor only exist as MCP actions, which Claude runs in the chat.
// So posts for Instagram-via-Windsor wait as "aguardando"; Claude publishes them and reports back to the Central.
import type { MetricRow } from '../../../src/central/core/types';
import type { Env } from '../env';
import { HttpError, now } from '../util';
import type { Provider } from './types';

const W_DEFAULT = 'https://connectors.windsor.ai';
const BASE_FIELDS = ['date', 'account_id', 'user_name', 'followers_count', 'media_id', 'media_type', 'media_comments_count', 'media_like_count', 'media_reach', 'media_impressions'];
// Extra metrics, requested when the connector accepts them (names vary by Windsor version).
const EXTRA_FIELDS = ['media_views', 'media_saved', 'media_shares', 'media_reel_avg_watch_time'];

type Row = Record<string, string | number | null>;

export async function windsorRows(env: Env, fields: string[], preset = 'last_90d', key = env.WINDSOR_API_KEY): Promise<Row[]> {
  if (!key) throw new HttpError(400, 'Windsor não configurado: cole a chave da API do Windsor na aba Contas.');
  const q = new URLSearchParams({ api_key: key, fields: fields.join(','), date_preset: preset });
  const res = await fetch(`${env.WINDSOR_API_BASE || W_DEFAULT}/instagram?${q}`);
  const text = await res.text();
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* */ }
  if (!res.ok) throw new HttpError(res.status === 401 || res.status === 403 ? 401 : 502, `Windsor: ${(body as { error?: string })?.error ?? text.slice(0, 200)}`);
  const rows = Array.isArray(body) ? body : (body as { data?: Row[] })?.data;
  if (!Array.isArray(rows)) throw new HttpError(502, 'Windsor respondeu num formato inesperado.');
  return rows as Row[];
}

async function rowsWithExtras(env: Env, preset: string): Promise<Row[]> {
  try { return await windsorRows(env, [...BASE_FIELDS, ...EXTRA_FIELDS], preset); }
  catch (e) { if ((e as HttpError).status === 401) throw e; return windsorRows(env, BASE_FIELDS, preset); }
}

/** Instagram accounts visible to the key (for connecting). */
export async function windsorAccounts(env: Env, key: string): Promise<{ id: string; username: string; followers?: number }[]> {
  const rows = await windsorRows(env, ['date', 'account_id', 'user_name', 'followers_count'], 'last_7d', key);
  const out = new Map<string, { id: string; username: string; followers?: number }>();
  for (const r of rows) if (r.account_id) out.set(String(r.account_id), { id: String(r.account_id), username: String(r.user_name ?? ''), followers: r.followers_count != null ? Number(r.followers_count) : out.get(String(r.account_id))?.followers });
  return [...out.values()];
}

const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v) || 0);

export const windsorInstagram: Provider = {
  network: 'instagram',
  configured: (env) => !!env.WINDSOR_API_KEY,
  publicPosting: () => true,
  authUrl() { throw new HttpError(400, 'Instagram via Windsor: conecte colando a chave do Windsor.'); },
  async exchange() { throw new HttpError(400, 'Instagram via Windsor: conecte colando a chave do Windsor.'); },
  async refresh() { return null; },

  async profile(env, acc) {
    const list = await windsorAccounts(env, env.WINDSOR_API_KEY!).catch(() => []);
    const a = list.find((x) => x.id === acc.remoteId);
    return { followers: a?.followers, handle: a?.username || acc.handle, name: acc.name };
  },

  async publish() {
    return { status: 'aguardando', note: 'Instagram pelo Windsor: no chat, peça ao Claude "publicar pendentes" e ele publica e marca aqui.' };
  },

  async comments() { return []; }, // read and answered by Claude through Windsor in the chat
  async reply() { throw new HttpError(501, 'Instagram pelo Windsor: as respostas são enviadas pelo Claude no chat ("responder comentários do Instagram").'); },

  async metrics(env, acc, items) {
    const rows = (await rowsWithExtras(env, 'last_90d')).filter((r) => String(r.account_id ?? acc.remoteId) === acc.remoteId);
    // Windsor returns one row per media per day: keep the latest cumulative values per media.
    const latest = new Map<string, Row>();
    for (const r of rows) {
      const id = r.media_id ? String(r.media_id) : '';
      if (!id) continue;
      const prev = latest.get(id);
      if (!prev || String(r.date ?? '') >= String(prev.date ?? '')) latest.set(id, r);
    }
    const out: MetricRow[] = [];
    for (const it of items) {
      const r = latest.get(it.remoteId);
      if (!r) continue;
      const views = num(r.media_views) || num(r.media_impressions);
      const watch = num(r.media_reel_avg_watch_time);
      out.push({
        postId: it.postId, network: 'instagram', remoteId: it.remoteId,
        views, likes: num(r.media_like_count), comments: num(r.media_comments_count), shares: num(r.media_shares),
        saves: r.media_saved != null ? num(r.media_saved) : undefined, reach: num(r.media_reach) || undefined,
        avgWatchSec: watch ? (watch > 600 ? watch / 1000 : watch) : undefined, updatedAt: now(),
      });
    }
    return out;
  },
};
