// Central do Set API: Cloudflare Worker.
import { buildCaptions } from '../../src/central/core/captions';
import { checkVideo, detectFormat } from '../../src/central/core/quality';
import type { Editoria, Network, NetworkCaption, Post, Settings, VideoMeta } from '../../src/central/core/types';
import { NETWORKS } from '../../src/central/core/types';
import { PROVIDERS, publishDue, publishPost, replyComment, statuses, syncComments, syncMetrics } from './core';
import * as db from './db';
import type { Env } from './env';
import { hasR2Keys, presignPut, verifyWorkerUrl } from './storage';
import { corsHeaders, HttpError, json, now, requireAdmin, uid } from './util';

const isNetwork = (x: string): x is Network => (NETWORKS as string[]).includes(x);

interface CreatePostBody {
  objectKey: string;
  meta: VideoMeta;
  networks: Network[];
  captions: NetworkCaption;
  scheduledAt?: number;
  editoria?: Editoria;
  hookType?: string;
  coverOffsetMs?: number;
}

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const m = req.method;

  if (m === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });
  if (path === '/') return json(env, { ok: true, app: 'Central do Set' });

  // ---------- OAuth callback (browser redirect from the platform; protected by the one-time state) ----------
  const cb = path.match(/^\/oauth\/(\w+)\/callback$/);
  if (cb && m === 'GET') {
    const network = cb[1];
    const back = (q: string) => Response.redirect(`${env.APP_URL}#central?${q}`, 302);
    if (!isNetwork(network)) return back('erro=rede');
    const state = url.searchParams.get('state') ?? '';
    const code = url.searchParams.get('code');
    if (url.searchParams.get('error') || !code) return back(`erro=${encodeURIComponent(url.searchParams.get('error_description') ?? url.searchParams.get('error') ?? 'cancelado')}`);
    if (!(await db.takeState(env, state, network))) return back('erro=sessao-expirada');
    try {
      const c = await PROVIDERS[network].exchange(env, code);
      await db.saveAccount(env, { network, remoteId: c.remoteId, name: c.name, handle: c.handle, token: c.token });
      return back(`conectado=${network}`);
    } catch (e) {
      return back(`erro=${encodeURIComponent((e as Error).message)}`);
    }
  }

  // ---------- signed media links (used when there is no R2 API token) ----------
  if (path === '/api/uploads/direct' && m === 'PUT') {
    const key = await verifyWorkerUrl(env, 'upload', url);
    if (!req.body) throw new HttpError(400, 'Arquivo vazio.');
    await env.VIDEOS.put(key, req.body, { httpMetadata: { contentType: req.headers.get('Content-Type') ?? 'video/mp4' } });
    return json(env, { ok: true });
  }
  if (path === '/media' && (m === 'GET' || m === 'HEAD')) {
    const key = await verifyWorkerUrl(env, 'media', url);
    const range = req.headers.get('Range')?.match(/bytes=(\d+)-(\d*)/);
    const obj = await env.VIDEOS.get(key, range ? { range: { offset: Number(range[1]), ...(range[2] ? { length: Number(range[2]) - Number(range[1]) + 1 } : {}) } } : undefined);
    if (!obj) throw new HttpError(404, 'Vídeo não encontrado.');
    const h = new Headers({ 'Content-Type': obj.httpMetadata?.contentType ?? 'video/mp4', 'Accept-Ranges': 'bytes', ETag: obj.httpEtag });
    if (range && obj.range && 'offset' in obj.range) {
      const off = obj.range.offset ?? 0, len = obj.range.length ?? obj.size - off;
      h.set('Content-Range', `bytes ${off}-${off + len - 1}/${obj.size}`); h.set('Content-Length', String(len));
      return new Response(m === 'HEAD' ? null : obj.body, { status: 206, headers: h });
    }
    h.set('Content-Length', String(obj.size));
    return new Response(m === 'HEAD' ? null : obj.body, { headers: h });
  }

  // ---------- everything below needs the admin token ----------
  await requireAdmin(req, env);
  const body = async <T>() => (await req.json().catch(() => { throw new HttpError(400, 'JSON inválido.'); })) as T;

  if (path === '/api/status' && m === 'GET') {
    return json(env, {
      accounts: await statuses(env),
      settings: await db.getSettings(env),
      configured: Object.fromEntries(NETWORKS.map((n) => [n, PROVIDERS[n].configured(env)])),
      ai: !!env.ANTHROPIC_API_KEY,
    });
  }

  if (path === '/api/settings' && m === 'PUT') {
    const s = await body<Settings>();
    if (!['aprovacao', 'automatico', 'desligado'].includes(s.replyMode)) throw new HttpError(400, 'Modo inválido.');
    await db.saveSettings(env, { replyMode: s.replyMode, extraBlockedHashtags: (s.extraBlockedHashtags ?? []).slice(0, 200), signature: (s.signature ?? '').slice(0, 200) });
    return json(env, await db.getSettings(env));
  }

  const start = path.match(/^\/api\/oauth\/(\w+)\/start$/);
  if (start && m === 'POST') {
    const n = start[1];
    if (!isNetwork(n)) throw new HttpError(404, 'Rede desconhecida.');
    if (!PROVIDERS[n].configured(env)) throw new HttpError(400, `Credenciais do app do ${n} não configuradas no servidor.`);
    const state = uid('st_');
    await db.saveState(env, state, n);
    return json(env, { url: PROVIDERS[n].authUrl(env, state) });
  }

  const disc = path.match(/^\/api\/accounts\/(\w+)$/);
  if (disc && m === 'DELETE' && isNetwork(disc[1])) { await db.deleteAccount(env, disc[1]); return json(env, { ok: true }); }

  if (path === '/api/uploads' && m === 'POST') {
    const b = await body<{ filename: string; contentType: string; size: number }>();
    if (!/^video\/(mp4|quicktime|webm)$/.test(b.contentType)) throw new HttpError(400, 'Envie MP4, MOV ou WebM.');
    if (!(b.size > 0) || b.size > 10 * 1024 ** 3) throw new HttpError(400, 'Tamanho inválido.');
    if (!hasR2Keys(env) && b.size > 100 * 1024 ** 2) throw new HttpError(400, 'Vídeos acima de 100 MB precisam do token de API do R2 no servidor (veja o LEIA-ME).');
    const ext = b.contentType === 'video/quicktime' ? 'mov' : b.contentType === 'video/webm' ? 'webm' : 'mp4';
    const objectKey = `videos/${new Date().toISOString().slice(0, 10)}/${uid()}.${ext}`;
    return json(env, { objectKey, uploadUrl: await presignPut(env, objectKey, b.contentType) });
  }

  // Server-side caption builder (the app has the same code; exposed for Claude/automations).
  if (path === '/api/captions' && m === 'POST') {
    const s = await db.getSettings(env);
    const b = await body<Parameters<typeof buildCaptions>[0]>();
    return json(env, buildCaptions({ ...b, extraBlocked: s.extraBlockedHashtags, signature: b.signature ?? s.signature }));
  }

  if (path === '/api/posts' && m === 'GET') return json(env, await db.listPosts(env));

  if (path === '/api/posts' && m === 'POST') {
    const b = await body<CreatePostBody>();
    const networks = (b.networks ?? []).filter(isNetwork);
    if (!networks.length) throw new HttpError(400, 'Escolha pelo menos uma rede.');
    if (!b.objectKey?.startsWith('videos/')) throw new HttpError(400, 'Vídeo inválido.');
    await env.VIDEOS.head(b.objectKey).then((o) => { if (!o) throw new HttpError(400, 'O vídeo ainda não terminou de subir.'); });
    const format = detectFormat(b.meta);
    const blocking = checkVideo(b.meta, networks, format).filter((c) => c.level === 'erro');
    if (blocking.length) throw new HttpError(400, blocking.map((c) => c.message).join(' '));
    const scheduled = b.scheduledAt && b.scheduledAt > now() + 60_000 ? b.scheduledAt : undefined;
    const post: Post = {
      id: uid('post_'), createdAt: now(), scheduledAt: scheduled, format, editoria: b.editoria, hookType: b.hookType,
      objectKey: b.objectKey, coverOffsetMs: b.coverOffsetMs, meta: b.meta, captions: b.captions,
      targets: networks.map((network) => ({ network, status: scheduled ? 'agendado' : 'pendente' })),
    };
    await db.savePost(env, post);
    // Publish now: the request stays open while the networks process (the app shows progress).
    return json(env, scheduled ? post : await publishPost(env, post));
  }

  const pub = path.match(/^\/api\/posts\/([\w]+)\/publish$/);
  if (pub && m === 'POST') {
    const p = await db.getPost(env, pub[1]);
    if (!p) throw new HttpError(404, 'Post não encontrado.');
    return json(env, await publishPost(env, p));
  }

  const del = path.match(/^\/api\/posts\/([\w]+)$/);
  if (del && m === 'DELETE') {
    const p = await db.getPost(env, del[1]);
    if (p && !p.targets.some((t) => t.status === 'publicado' || t.status === 'privado')) await env.VIDEOS.delete(p.objectKey);
    await db.deletePost(env, del[1]);
    return json(env, { ok: true });
  }

  if (path === '/api/comments' && m === 'GET') return json(env, await db.listComments(env, url.searchParams.get('status') ?? undefined));
  if (path === '/api/comments/sync' && m === 'POST') return json(env, await syncComments(env));

  const cm = path.match(/^\/api\/comments\/([^/]+)\/(reply|ignore)$/);
  if (cm && m === 'POST') {
    const id = decodeURIComponent(cm[1]);
    if (cm[2] === 'reply') return json(env, await replyComment(env, id, (await body<{ text: string }>()).text));
    const c = await db.getComment(env, id);
    if (!c) throw new HttpError(404, 'Comentário não encontrado.');
    c.status = 'ignorado';
    await db.upsertComment(env, c, false);
    return json(env, c);
  }

  if (path === '/api/metrics' && m === 'GET') return json(env, { rows: await db.listMetrics(env), posts: await db.listPosts(env, 200) });
  if (path === '/api/metrics/sync' && m === 'POST') return json(env, { updated: await syncMetrics(env) });

  throw new HttpError(404, 'Rota não encontrada.');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await route(req, env);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      return json(env, { error: (e as Error).message }, status);
    }
  },

  async scheduled(_ev: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      await publishDue(env).catch((e) => console.error('publishDue', e));
      await syncComments(env).catch((e) => console.error('syncComments', e));
      // Metrics every hour is enough (cron runs every 15 min).
      if (new Date().getUTCMinutes() < 15) await syncMetrics(env).catch((e) => console.error('syncMetrics', e));
    })());
  },
} satisfies ExportedHandler<Env>;
