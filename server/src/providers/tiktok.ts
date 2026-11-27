// TikTok Content Posting API + Display API. Uploads the original file in chunks (FILE_UPLOAD, no URL verification).
// Until TikTok approves the app (audit), posts can only be SELF_ONLY: the video arrives private and you make it
// public in the app. TikTok offers no public API for comments, so comment replies for TikTok go through Windsor.ai.
import type { MetricRow } from '../../../src/central/core/types';
import { head, stream } from '../storage';
import { api, form, HttpError, now, sleep } from '../util';
import { callback, type Provider } from './types';

const T = 'https://open.tiktokapis.com/v2';
const SCOPES = ['user.info.basic', 'user.info.stats', 'video.publish', 'video.list'];
const MB = 1024 * 1024;
const auth = (t: string) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json; charset=UTF-8' });

/** TikTok rules: chunks of 5–64 MB, the last one absorbs the remainder (up to 128 MB); under 5 MB = one chunk. */
export function chunkPlan(size: number): { chunkSize: number; count: number } {
  if (size <= 64 * MB) return { chunkSize: size, count: 1 };
  const chunkSize = 64 * MB;
  return { chunkSize, count: Math.floor(size / chunkSize) };
}

export const tiktok: Provider = {
  network: 'tiktok',
  configured: (env) => !!(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET),
  publicPosting: (env) => env.TIKTOK_PUBLIC === 'true',

  authUrl(env, state) {
    const u = new URL('https://www.tiktok.com/v2/auth/authorize/');
    u.search = form({ client_key: env.TIKTOK_CLIENT_KEY!, scope: SCOPES.join(','), response_type: 'code', redirect_uri: callback(env, 'tiktok'), state });
    return u.toString();
  },

  async exchange(env, code) {
    const t = await api<{ access_token: string; refresh_token: string; open_id: string; expires_in: number; refresh_expires_in: number }>(`${T}/oauth/token/`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_key: env.TIKTOK_CLIENT_KEY!, client_secret: env.TIKTOK_CLIENT_SECRET!, code, grant_type: 'authorization_code', redirect_uri: callback(env, 'tiktok') }),
    }, 'TikTok login');
    const u = await api<{ data: { user: { display_name?: string; username?: string } } }>(`${T}/user/info/?fields=open_id,display_name,username`, { headers: auth(t.access_token) }, 'TikTok perfil');
    return {
      token: { access: t.access_token, refresh: t.refresh_token, expiresAt: now() + t.expires_in * 1000, refreshExpiresAt: now() + t.refresh_expires_in * 1000 },
      remoteId: t.open_id, name: u.data.user.display_name, handle: u.data.user.username,
    };
  },

  async refresh(env, token) {
    if (token.expiresAt && token.expiresAt - now() > 10 * 60_000) return null;
    const t = await api<{ access_token: string; refresh_token: string; expires_in: number; refresh_expires_in: number }>(`${T}/oauth/token/`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_key: env.TIKTOK_CLIENT_KEY!, client_secret: env.TIKTOK_CLIENT_SECRET!, grant_type: 'refresh_token', refresh_token: token.refresh! }),
    }, 'TikTok renovar token');
    return { access: t.access_token, refresh: t.refresh_token, expiresAt: now() + t.expires_in * 1000, refreshExpiresAt: now() + t.refresh_expires_in * 1000 };
  },

  async profile(_env, acc) {
    const u = await api<{ data: { user: { display_name?: string; username?: string; follower_count?: number } } }>(
      `${T}/user/info/?fields=display_name,username,follower_count`, { headers: auth(acc.token.access) }, 'TikTok perfil');
    return { followers: u.data.user.follower_count, name: u.data.user.display_name, handle: u.data.user.username };
  },

  async publish(env, acc, post) {
    const info = await api<{ data: { privacy_level_options: string[]; max_video_post_duration_sec: number } }>(
      `${T}/post/publish/creator_info/query/`, { method: 'POST', headers: auth(acc.token.access), body: '{}' }, 'TikTok criador');
    if (post.meta.duration > info.data.max_video_post_duration_sec) {
      throw new HttpError(400, `Esta conta do TikTok aceita vídeos de até ${info.data.max_video_post_duration_sec}s pela API.`);
    }
    const wantPublic = env.TIKTOK_PUBLIC === 'true' && info.data.privacy_level_options.includes('PUBLIC_TO_EVERYONE');
    const privacy = wantPublic ? 'PUBLIC_TO_EVERYONE' : 'SELF_ONLY';

    const obj = await head(env, post.objectKey);
    const plan = chunkPlan(obj.size);
    const init = await api<{ data: { publish_id: string; upload_url: string } }>(`${T}/post/publish/video/init/`, {
      method: 'POST', headers: auth(acc.token.access),
      body: JSON.stringify({
        post_info: {
          title: post.captions.tiktok.caption, privacy_level: privacy,
          disable_comment: false, disable_duet: false, disable_stitch: false,
          ...(post.coverOffsetMs != null ? { video_cover_timestamp_ms: Math.round(post.coverOffsetMs) } : {}),
        },
        source_info: { source: 'FILE_UPLOAD', video_size: obj.size, chunk_size: plan.chunkSize, total_chunk_count: plan.count },
      }),
    }, 'TikTok iniciar envio');

    for (let i = 0; i < plan.count; i++) {
      const start = i * plan.chunkSize;
      const end = i === plan.count - 1 ? obj.size - 1 : start + plan.chunkSize - 1;
      const { body, size } = await stream(env, post.objectKey, { offset: start, length: end - start + 1 });
      const r = await fetch(init.data.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': obj.httpMetadata?.contentType ?? 'video/mp4', 'Content-Length': String(size), 'Content-Range': `bytes ${start}-${end}/${obj.size}` },
        body,
      });
      if (!r.ok) throw new HttpError(502, `TikTok falhou no envio da parte ${i + 1}/${plan.count}: ${(await r.text()).slice(0, 200)}`);
    }

    for (let i = 0; i < 45; i++) {
      await sleep(10_000);
      const st = await api<{ data: { status: string; fail_reason?: string; publicaly_available_post_id?: (string | number)[] } }>(`${T}/post/publish/status/fetch/`, {
        method: 'POST', headers: auth(acc.token.access), body: JSON.stringify({ publish_id: init.data.publish_id }),
      }, 'TikTok status');
      if (st.data.status === 'FAILED') throw new HttpError(502, `TikTok recusou: ${st.data.fail_reason ?? 'motivo não informado'}`);
      if (st.data.status === 'PUBLISH_COMPLETE') {
        const id = st.data.publicaly_available_post_id?.[0];
        const url = id && acc.handle ? `https://www.tiktok.com/@${acc.handle}/video/${id}` : undefined;
        return privacy === 'SELF_ONLY'
          ? { status: 'privado', remoteId: id ? String(id) : undefined, url, note: 'Publicado como privado (app sem auditoria do TikTok). Abra o TikTok e mude para "Todos".' }
          : { status: 'publicado', remoteId: id ? String(id) : undefined, url };
      }
    }
    throw new HttpError(504, 'TikTok ainda está processando. Confira no app em alguns minutos.');
  },

  async comments() { return []; },
  async reply() { throw new HttpError(501, 'O TikTok não oferece API pública de comentários. Responda pelo Windsor.ai (peça ao Claude: "responder comentários do TikTok").'); },

  async metrics(_env, acc, items) {
    const ids = items.map((i) => i.remoteId).filter(Boolean);
    if (!ids.length) return [];
    const out: MetricRow[] = [];
    for (let i = 0; i < ids.length; i += 20) {
      const r = await api<{ data: { videos: { id: string; view_count: number; like_count: number; comment_count: number; share_count: number }[] } }>(
        `${T}/video/query/?fields=id,view_count,like_count,comment_count,share_count`,
        { method: 'POST', headers: auth(acc.token.access), body: JSON.stringify({ filters: { video_ids: ids.slice(i, i + 20) } }) }, 'TikTok métricas');
      for (const v of r.data.videos) {
        out.push({ postId: items.find((x) => x.remoteId === v.id)?.postId ?? '', network: 'tiktok', remoteId: v.id, views: v.view_count, likes: v.like_count, comments: v.comment_count, shares: v.share_count, updatedAt: now() });
      }
    }
    return out;
  },
};
