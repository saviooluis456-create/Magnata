// YouTube Data API v3 + YouTube Analytics API. Uploads stream the original file from R2 (no recompression, any size).
// Note: apps that haven't passed Google's API audit have every upload locked as private.
import { stream } from '../storage';
import { api, form, HttpError, now } from '../util';
import { callback, type Provider } from './types';

const YT = 'https://www.googleapis.com/youtube/v3';
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];
const CATEGORY_ENTERTAINMENT = '24';
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

export const youtube: Provider = {
  network: 'youtube',
  configured: (env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  publicPosting: () => true, // the response tells us if Google locked the video as private

  authUrl(env, state) {
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.search = form({
      client_id: env.GOOGLE_CLIENT_ID!, redirect_uri: callback(env, 'youtube'), response_type: 'code',
      scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
    });
    return u.toString();
  },

  async exchange(env, code) {
    const t = await api<{ access_token: string; refresh_token?: string; expires_in: number }>('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ code, client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, redirect_uri: callback(env, 'youtube'), grant_type: 'authorization_code' }),
    }, 'Google login');
    if (!t.refresh_token) throw new HttpError(400, 'O Google não devolveu o token de renovação. Remova o acesso em myaccount.google.com/permissions e conecte de novo.');
    const ch = await api<{ items?: { id: string; snippet: { title: string; customUrl?: string } }[] }>(`${YT}/channels?part=snippet&mine=true`, { headers: auth(t.access_token) }, 'YouTube canal');
    const c = ch.items?.[0];
    if (!c) throw new HttpError(400, 'Nenhum canal do YouTube nesta conta. Escolha a Conta de Marca "Luiz no Set" ao entrar.');
    return { token: { access: t.access_token, refresh: t.refresh_token, expiresAt: now() + t.expires_in * 1000 }, remoteId: c.id, name: c.snippet.title, handle: c.snippet.customUrl };
  },

  async refresh(env, token) {
    if (token.expiresAt && token.expiresAt - now() > 5 * 60_000) return null;
    const t = await api<{ access_token: string; expires_in: number }>('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, refresh_token: token.refresh!, grant_type: 'refresh_token' }),
    }, 'Google renovar token');
    return { ...token, access: t.access_token, expiresAt: now() + t.expires_in * 1000 };
  },

  async profile(_env, acc) {
    const ch = await api<{ items?: { snippet: { title: string; customUrl?: string }; statistics: { subscriberCount?: string } }[] }>(
      `${YT}/channels?part=snippet,statistics&mine=true`, { headers: auth(acc.token.access) }, 'YouTube canal');
    const c = ch.items?.[0];
    return { followers: c?.statistics.subscriberCount ? Number(c.statistics.subscriberCount) : undefined, name: c?.snippet.title, handle: c?.snippet.customUrl };
  },

  async publish(env, acc, post) {
    const yt = post.captions.youtube;
    const scheduled = post.scheduledAt && post.scheduledAt > now() + 15 * 60_000;
    const metadata = {
      snippet: { title: yt.title, description: yt.description, tags: yt.tags, categoryId: CATEGORY_ENTERTAINMENT, defaultLanguage: 'pt-BR', defaultAudioLanguage: 'pt-BR' },
      status: {
        privacyStatus: scheduled ? 'private' : 'public',
        ...(scheduled ? { publishAt: new Date(post.scheduledAt!).toISOString() } : {}),
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: false,
      },
    };
    const { body, size } = await stream(env, post.objectKey);
    const init = await fetch(`https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`, {
      method: 'POST',
      headers: { ...auth(acc.token.access), 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Length': String(size), 'X-Upload-Content-Type': 'video/*' },
      body: JSON.stringify(metadata),
    });
    const location = init.headers.get('Location');
    if (!init.ok || !location) throw new HttpError(502, `YouTube recusou o envio: ${(await init.text()).slice(0, 300)}`);
    const up = await fetch(location, { method: 'PUT', headers: { 'Content-Type': 'video/*', 'Content-Length': String(size) }, body });
    const video = (await up.json().catch(() => ({}))) as { id?: string; status?: { privacyStatus?: string }; error?: { message: string } };
    if (!up.ok || !video.id) throw new HttpError(502, `YouTube falhou no upload: ${video.error?.message ?? up.statusText}`);

    const url = post.format === 'short' ? `https://www.youtube.com/shorts/${video.id}` : `https://www.youtube.com/watch?v=${video.id}`;
    const locked = !scheduled && video.status?.privacyStatus === 'private';
    return locked
      ? { status: 'privado', remoteId: video.id, url, note: 'O Google deixou o vídeo privado: o app ainda não passou pela auditoria da API. Torne público no YouTube Studio.' }
      : { status: 'publicado', remoteId: video.id, url };
  },

  async comments(_env, acc) {
    const r = await api<{ items: { id: string; snippet: { videoId: string; topLevelComment: { id: string; snippet: { authorDisplayName: string; authorChannelId?: { value: string }; textOriginal: string; publishedAt: string } } } }[] }>(
      `${YT}/commentThreads?part=snippet&allThreadsRelatedToChannelId=${acc.remoteId}&maxResults=50&order=time&textFormat=plainText`,
      { headers: auth(acc.token.access) }, 'YouTube comentários');
    return r.items
      .filter((t) => t.snippet.topLevelComment.snippet.authorChannelId?.value !== acc.remoteId)
      .map((t) => {
        const s = t.snippet.topLevelComment.snippet;
        return { id: `youtube:${t.id}`, network: 'youtube' as const, remoteId: t.id, mediaRemoteId: t.snippet.videoId, author: s.authorDisplayName, text: s.textOriginal, createdAt: Date.parse(s.publishedAt) };
      });
  },

  async reply(_env, acc, c, text) {
    await api(`${YT}/comments?part=snippet`, {
      method: 'POST', headers: { ...auth(acc.token.access), 'Content-Type': 'application/json' },
      body: JSON.stringify({ snippet: { parentId: c.remoteId, textOriginal: text } }),
    }, 'YouTube responder');
  },

  async metrics(_env, acc, items) {
    if (!items.length) return [];
    const ids = items.map((i) => i.remoteId);
    const stats = await api<{ items: { id: string; statistics: Record<string, string> }[] }>(`${YT}/videos?part=statistics&id=${ids.join(',')}`, { headers: auth(acc.token.access) }, 'YouTube estatísticas');
    const today = new Date().toISOString().slice(0, 10);
    const an = await api<{ rows?: (string | number)[][]; columnHeaders: { name: string }[] }>(
      `https://youtubeanalytics.googleapis.com/v2/reports?${form({
        ids: 'channel==MINE', startDate: '2024-01-01', endDate: today, dimensions: 'video',
        metrics: 'views,averageViewDuration,averageViewPercentage,subscribersGained,shares', filters: `video==${ids.join(',')}`,
      })}`, { headers: auth(acc.token.access) }, 'YouTube Analytics').catch(() => ({ rows: [], columnHeaders: [] }));
    const col = (n: string) => an.columnHeaders.findIndex((h) => h.name === n);
    return items.map((it) => {
      const s = stats.items.find((x) => x.id === it.remoteId)?.statistics ?? {};
      const row = an.rows?.find((r) => r[0] === it.remoteId);
      const g = (n: string) => (row && col(n) >= 0 ? Number(row[col(n)]) : undefined);
      return {
        postId: it.postId, network: 'youtube' as const, remoteId: it.remoteId,
        views: Number(s.viewCount ?? 0), likes: Number(s.likeCount ?? 0), comments: Number(s.commentCount ?? 0),
        shares: g('shares') ?? 0, avgWatchSec: g('averageViewDuration'), avgViewPct: g('averageViewPercentage'), followersGained: g('subscribersGained'),
        updatedAt: now(),
      };
    });
  },
};
