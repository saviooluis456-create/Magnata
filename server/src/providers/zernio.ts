// Quick connection through Zernio (formerly Late): a service whose apps are already approved by Instagram,
// TikTok and YouTube. The user only creates a Zernio account once, pastes its API key in the Central,
// and then each network is "tap Conectar → authorize". Docs: docs.zernio.com
import type { CommentItem, MetricRow, Network } from '../../../src/central/core/types';
import type { Account } from '../db';
import type { Env } from '../env';
import { stream } from '../storage';
import { HttpError, now, sleep } from '../util';
import type { Provider } from './types';

const Z_DEFAULT = 'https://zernio.com/api/v1';

async function z<T = any>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  if (!env.ZERNIO_API_KEY) throw new HttpError(400, 'Conexão rápida não configurada: cole a chave do Zernio na aba Contas.');
  const res = await fetch((env.ZERNIO_API_BASE || Z_DEFAULT) + path, { ...init, headers: { Authorization: `Bearer ${env.ZERNIO_API_KEY}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = body?.error?.message ?? body?.message ?? body?.error ?? res.statusText;
    if (res.status === 402) throw new HttpError(402, `Zernio: este recurso precisa de um plano ou complemento pago (${typeof msg === 'string' ? msg : 'pagamento necessário'}).`);
    throw new HttpError(res.status, `Zernio: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
  return body as T;
}

/** Validates the key and makes sure the "Luiz no Set" profile exists. Returns its id. */
export async function ensureProfile(env: Env): Promise<string> {
  const cached = await env.DB.prepare("SELECT value FROM settings WHERE key = 'zernio_profile'").first<{ value: string }>().catch(() => null);
  if (cached) return JSON.parse(cached.value) as string;
  const id = await findOrCreateProfile(env);
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('zernio_profile', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1").bind(JSON.stringify(id)).run();
  return id;
}

async function findOrCreateProfile(env: Env): Promise<string> {
  const list = await z<{ profiles?: { _id: string; name?: string; externalId?: string }[] }>(env, '/profiles?externalId=central-do-set').catch(() => null);
  const found = list?.profiles?.find((p) => p.externalId === 'central-do-set') ?? list?.profiles?.[0];
  if (found?._id) return found._id;
  const created = await z<{ profile: { _id: string } }>(env, '/profiles', { method: 'POST', body: JSON.stringify({ name: 'Luiz no Set', externalId: 'central-do-set' }) });
  return created.profile._id;
}

/** Accounts already connected in the Zernio dashboard (so they can be linked without connecting again). */
export async function listZernioAccounts(env: Env): Promise<{ id: string; network: Network; username?: string }[]> {
  const r = await z<{ accounts?: Record<string, any>[] }>(env, '/accounts?status=connected&limit=100').catch(() => null);
  const out: { id: string; network: Network; username?: string }[] = [];
  for (const a of r?.accounts ?? []) {
    const id = a._id ?? a.accountId ?? a.id;
    const platform = String(a.platform ?? '');
    if (!id || !['tiktok', 'youtube', 'instagram'].includes(platform)) continue;
    out.push({ id: String(id), network: platform as Network, username: a.username ?? a.displayName ?? a.name });
  }
  return out;
}

export async function connectUrl(env: Env, network: Network, redirect: string): Promise<string> {
  const profileId = await ensureProfile(env);
  const q = new URLSearchParams({ profileId, redirect_url: redirect });
  const r = await z<{ authUrl: string }>(env, `/connect/${network}?${q}`);
  if (!r.authUrl) throw new HttpError(502, 'Zernio não devolveu o link de conexão.');
  return r.authUrl;
}

// Upload once per video even when it goes to 3 networks in the same request.
const uploaded = new Map<string, { url: string; at: number }>();
async function publicMediaUrl(env: Env, objectKey: string): Promise<string> {
  const hit = uploaded.get(objectKey);
  if (hit && now() - hit.at < 50 * 60_000) return hit.url;
  const obj = await env.VIDEOS.head(objectKey);
  if (!obj) throw new HttpError(404, 'Vídeo não encontrado no armazenamento.');
  const type = obj.httpMetadata?.contentType ?? 'video/mp4';
  const pre = await z<{ uploadUrl: string; publicUrl: string }>(env, '/media/presign', {
    method: 'POST', body: JSON.stringify({ filename: objectKey.split('/').pop(), contentType: type, size: obj.size }),
  });
  const { body, size } = await stream(env, objectKey);
  const put = await fetch(pre.uploadUrl, { method: 'PUT', headers: { 'Content-Type': type, 'Content-Length': String(size) }, body });
  if (!put.ok) throw new HttpError(502, `Falha ao enviar o vídeo para o Zernio (${put.status}).`);
  uploaded.set(objectKey, { url: pre.publicUrl, at: now() });
  return pre.publicUrl;
}

interface ZPlatform { platform: string; status?: string; accountId?: string; platformPostId?: string; platformPostUrl?: string; errorMessage?: string }
const platformsOf = (r: any): ZPlatform[] => r?.post?.platforms ?? r?.platforms ?? [];

export function zernio(network: Network): Provider {
  return {
    network,
    configured: (env) => !!env.ZERNIO_API_KEY,
    publicPosting: () => true,
    authUrl() { throw new HttpError(400, 'Use a conexão rápida.'); },
    async exchange() { throw new HttpError(400, 'Use a conexão rápida.'); },
    async refresh() { return null; }, // Zernio keeps the platform tokens fresh

    async profile(env, acc) {
      const r = await z<{ accounts?: { _id: string; username?: string; currentFollowers?: number }[] }>(env, `/accounts/follower-stats?accountIds=${acc.remoteId}`).catch(() => null);
      const a = r?.accounts?.find((x) => x._id === acc.remoteId);
      return { followers: a?.currentFollowers, handle: a?.username ?? acc.handle, name: acc.name };
    },

    async publish(env, acc, post) {
      const url = await publicMediaUrl(env, post.objectKey);
      const scheduled = post.scheduledAt && post.scheduledAt > now() + 5 * 60_000;
      const target: Record<string, unknown> = { platform: network, accountId: acc.remoteId };
      const body: Record<string, unknown> = {
        mediaItems: [{ url, type: 'video' }],
        platforms: [target],
        ...(scheduled ? { scheduledFor: new Date(post.scheduledAt!).toISOString() } : { publishNow: true }),
      };
      if (network === 'instagram') body.content = post.captions.instagram.caption;
      if (network === 'tiktok') {
        body.content = post.captions.tiktok.caption;
        // The user confirms content and consent by pressing "Publicar" in the Central (TikTok's posting rules).
        body.tiktokSettings = { privacy_level: 'PUBLIC_TO_EVERYONE', allow_comment: true, allow_duet: true, allow_stitch: true, content_preview_confirmed: true, express_consent_given: true, ...(post.coverOffsetMs != null ? { video_cover_timestamp_ms: Math.round(post.coverOffsetMs) } : {}) };
      }
      if (network === 'youtube') {
        body.content = post.captions.youtube.description;
        body.tags = post.captions.youtube.tags;
        target.platformSpecificData = { title: post.captions.youtube.title, visibility: 'public', categoryId: '24', madeForKids: false };
      }
      const created = await z<any>(env, '/posts', { method: 'POST', headers: { 'Idempotency-Key': `${post.id}-${network}` }, body: JSON.stringify(body) });
      const id: string | undefined = created?.post?._id;
      if (scheduled) return { status: 'publicado', providerPostId: id, note: `Agendado no Zernio para ${new Date(post.scheduledAt!).toLocaleString('pt-BR')}.` };
      // Wait for the network to finish (Instagram/YouTube process the video), up to ~5 min.
      let p = platformsOf(created).find((x) => x.platform === network);
      for (let i = 0; i < 30 && id && !(p?.platformPostId || /published|failed|error/.test(p?.status ?? '')); i++) {
        await sleep(10_000);
        p = platformsOf(await z(env, `/posts/${id}`)).find((x) => x.platform === network);
      }
      if (p?.status && /failed|error/.test(p.status)) throw new HttpError(502, p.errorMessage ?? `${network} recusou a publicação.`);
      return { status: 'publicado', remoteId: p?.platformPostId, providerPostId: id, url: p?.platformPostUrl, note: p?.platformPostId ? undefined : 'Enviado; a rede ainda está processando. O link aparece na fila em alguns minutos.' };
    },

    async comments(env, acc) {
      const posts = await z<{ data?: { id: string; commentCount?: number }[] }>(env, `/inbox/comments?accountId=${acc.remoteId}&platform=${network}&limit=15&sortBy=date&minComments=1`).catch(() => null);
      const out: Omit<CommentItem, 'status'>[] = [];
      for (const p of posts?.data ?? []) {
        if (!p.commentCount) continue;
        const r = await z<{ comments?: { id: string; message?: string; createdTime?: string; from?: { name?: string; username?: string; isOwner?: boolean } }[] }>(env, `/inbox/comments/${encodeURIComponent(p.id)}?accountId=${acc.remoteId}&limit=50`).catch(() => null);
        for (const c of r?.comments ?? []) {
          if (c.from?.isOwner || !c.message) continue;
          out.push({ id: `${network}:${c.id}`, network, remoteId: c.id, mediaRemoteId: p.id, author: c.from?.username ?? c.from?.name ?? '?', text: c.message, createdAt: c.createdTime ? Date.parse(c.createdTime) : now() });
        }
      }
      return out;
    },

    async reply(env, acc: Account, c: CommentItem, text: string) {
      await z(env, `/inbox/comments/${encodeURIComponent(c.mediaRemoteId)}`, {
        method: 'POST', headers: { 'Idempotency-Key': `reply-${c.id}` },
        body: JSON.stringify({ accountId: acc.remoteId, message: text, commentId: c.remoteId }),
      });
    },

    async metrics(env, acc, items) {
      const r = await z<{ posts?: any[] }>(env, `/analytics?accountId=${acc.remoteId}&platform=${network}&limit=100`);
      const out: MetricRow[] = [];
      for (const it of items) {
        const p = r.posts?.find((x) => x.postId === it.providerPostId || x.latePostId === it.providerPostId ||
          (x.platformAnalytics ?? []).some((pa: any) => it.remoteId && pa.platformPostUrl?.includes(it.remoteId)));
        if (!p) continue;
        const a = p.analytics ?? {};
        const watch = Number(a.igReelsAvgWatchTime ?? 0);
        out.push({
          postId: it.postId, network, remoteId: it.remoteId || it.providerPostId || '',
          views: Number(a.views ?? a.totalViews ?? 0), likes: Number(a.likes ?? 0), comments: Number(a.comments ?? 0),
          shares: Number(a.shares ?? 0), saves: a.saves != null ? Number(a.saves) : undefined, reach: a.reach != null ? Number(a.reach) : undefined,
          // Instagram reports average watch time in milliseconds.
          avgWatchSec: watch ? (watch > 600 ? watch / 1000 : watch) : undefined,
          avgViewPct: a.completionRate != null ? Number(a.completionRate) * (Number(a.completionRate) <= 1 ? 100 : 1) : undefined,
          updatedAt: now(),
        });
      }
      return out;
    },
  };
}

export const ZERNIO: Record<Network, Provider> = { instagram: zernio('instagram'), tiktok: zernio('tiktok'), youtube: zernio('youtube') };
