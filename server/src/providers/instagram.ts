// Instagram API with Instagram Login (professional account: Creator or Business).
// Docs: developers.facebook.com/docs/instagram-platform
import type { MetricRow } from '../../../src/central/core/types';
import { presignGet } from '../storage';
import { api, form, HttpError, now, sleep } from '../util';
import { callback, type Provider } from './types';

const V = 'v23.0';
const G = `https://graph.instagram.com/${V}`;
const SCOPES = ['instagram_business_basic', 'instagram_business_content_publish', 'instagram_business_manage_comments', 'instagram_business_manage_insights'];

export const instagram: Provider = {
  network: 'instagram',
  configured: (env) => !!(env.IG_APP_ID && env.IG_APP_SECRET),
  publicPosting: () => true,

  authUrl(env, state) {
    const u = new URL('https://www.instagram.com/oauth/authorize');
    u.search = form({ client_id: env.IG_APP_ID!, redirect_uri: callback(env, 'instagram'), response_type: 'code', scope: SCOPES.join(','), state });
    return u.toString();
  },

  async exchange(env, code) {
    const short = await api<{ access_token: string; user_id: number | string }>('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_id: env.IG_APP_ID!, client_secret: env.IG_APP_SECRET!, grant_type: 'authorization_code', redirect_uri: callback(env, 'instagram'), code: code.replace(/#_$/, '') }),
    }, 'Instagram login');
    // Exchange for a 60-day token.
    const long = await api<{ access_token: string; expires_in: number }>(
      `https://graph.instagram.com/access_token?${form({ grant_type: 'ig_exchange_token', client_secret: env.IG_APP_SECRET!, access_token: short.access_token })}`,
      {}, 'Instagram token longo');
    const me = await api<{ user_id: string; username: string; name?: string }>(`${G}/me?fields=user_id,username,name&access_token=${long.access_token}`, {}, 'Instagram perfil');
    return { token: { access: long.access_token, expiresAt: now() + long.expires_in * 1000 }, remoteId: String(me.user_id ?? short.user_id), name: me.name, handle: me.username };
  },

  async refresh(_env, token) {
    // Long-lived tokens last 60 days; refresh when fewer than 10 days remain.
    if (token.expiresAt && token.expiresAt - now() > 10 * 86400_000) return null;
    const r = await api<{ access_token: string; expires_in: number }>(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token.access}`, {}, 'Instagram renovar token');
    return { access: r.access_token, expiresAt: now() + r.expires_in * 1000 };
  },

  async profile(_env, acc) {
    const me = await api<{ username: string; name?: string; followers_count?: number }>(`${G}/me?fields=username,name,followers_count&access_token=${acc.token.access}`, {}, 'Instagram perfil');
    return { followers: me.followers_count, name: me.name, handle: me.username };
  },

  async publish(env, acc, post) {
    const videoUrl = await presignGet(env, post.objectKey);
    const params: Record<string, string> = {
      media_type: 'REELS',
      video_url: videoUrl,
      caption: post.captions.instagram.caption,
      share_to_feed: 'true',
      access_token: acc.token.access,
    };
    if (post.coverOffsetMs != null) params.thumb_offset = String(Math.round(post.coverOffsetMs));
    const container = await api<{ id: string }>(`${G}/${acc.remoteId}/media`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(params) }, 'Instagram criar Reel');

    // Instagram downloads and processes the video; wait until FINISHED (up to ~8 min, 1 request every 10 s).
    for (let i = 0; i < 48; i++) {
      await sleep(10_000);
      const st = await api<{ status_code: string; status?: string }>(`${G}/${container.id}?fields=status_code,status&access_token=${acc.token.access}`, {}, 'Instagram status');
      if (st.status_code === 'FINISHED') break;
      if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') throw new HttpError(502, `Instagram recusou o vídeo: ${st.status ?? st.status_code}`);
      if (i === 47) throw new HttpError(504, 'Instagram demorou demais para processar o vídeo. Tente de novo.');
    }
    const pub = await api<{ id: string }>(`${G}/${acc.remoteId}/media_publish`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ creation_id: container.id, access_token: acc.token.access }),
    }, 'Instagram publicar');
    const info = await api<{ permalink?: string }>(`${G}/${pub.id}?fields=permalink&access_token=${acc.token.access}`, {}, 'Instagram link').catch(() => ({ permalink: undefined }));
    return { status: 'publicado', remoteId: pub.id, url: info.permalink };
  },

  async comments(_env, acc) {
    const media = await api<{ data: { id: string; timestamp: string }[] }>(`${G}/${acc.remoteId}/media?fields=id,timestamp&limit=15&access_token=${acc.token.access}`, {}, 'Instagram mídias');
    const out = [];
    for (const m of media.data) {
      const c = await api<{ data: { id: string; text: string; username?: string; timestamp: string; from?: { id: string; username: string } }[] }>(
        `${G}/${m.id}/comments?fields=id,text,username,timestamp,from&limit=50&access_token=${acc.token.access}`, {}, 'Instagram comentários');
      for (const x of c.data) {
        if (x.from?.id === acc.remoteId || x.username === acc.handle) continue; // our own comments
        out.push({ id: `instagram:${x.id}`, network: 'instagram' as const, remoteId: x.id, mediaRemoteId: m.id, author: x.username ?? x.from?.username ?? '?', text: x.text, createdAt: Date.parse(x.timestamp) });
      }
    }
    return out;
  },

  async reply(_env, acc, c, text) {
    await api(`${G}/${c.remoteId}/replies`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ message: text, access_token: acc.token.access }) }, 'Instagram responder');
  },

  async metrics(_env, acc, items) {
    const out: MetricRow[] = [];
    for (const it of items) {
      const r = await api<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(
        `${G}/${it.remoteId}/insights?metric=views,reach,likes,comments,shares,saved,ig_reels_avg_watch_time&access_token=${acc.token.access}`, {}, 'Instagram métricas',
      ).catch(() => null);
      if (!r) continue;
      const v = (n: string) => { const m = r.data.find((d) => d.name === n); return m?.values?.[0]?.value ?? m?.total_value?.value ?? 0; };
      out.push({
        postId: it.postId, network: 'instagram', remoteId: it.remoteId,
        views: v('views'), reach: v('reach'), likes: v('likes'), comments: v('comments'), shares: v('shares'), saves: v('saved'),
        avgWatchSec: v('ig_reels_avg_watch_time') / 1000, updatedAt: now(),
      });
    }
    return out;
  },
};
