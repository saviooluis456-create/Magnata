// Central do Set API: Cloudflare Worker.
import { buildCaptions } from '../../src/central/core/captions';
import { checkVideo, detectFormat } from '../../src/central/core/quality';
import type { Editoria, Network, NetworkCaption, Post, Settings, VideoMeta } from '../../src/central/core/types';
import { NETWORKS } from '../../src/central/core/types';
import { PROVIDERS, publishDue, publishPost, replyComment, statuses, syncComments, syncMetrics } from './core';
import * as db from './db';
import type { Env } from './env';
import { addBenchChannel, generateReport, intel, latestPlaybook, listExperiments, playbookMarkdown, removeBenchChannel, saveExperiment, syncBench } from './intel';
import { hasR2Keys, presignPut, verifyWorkerUrl } from './storage';
import { ALL_SCOPES, authenticate, changePassword, createClaudeKey, deleteAppCreds, listClaudeKeys, login, needsSetup, require, resolveEnv, revokeClaudeKey, saveAppCreds, saveWindsorKey, saveZernioKey, setup, type Scope } from './auth';
import { windsorAccounts } from './providers/windsor';
import { presignGet } from './storage';
import { connectUrl, ensureProfile } from './providers/zernio';
import { callback } from './providers/types';
import { corsHeaders, HttpError, json, now, uid } from './util';

const isNetwork = (x: string): x is Network => (NETWORKS as string[]).includes(x);
/** env with a different Zernio key, keeping every binding intact. */
const withKey = (env: Env, key: string) => new Proxy(env, { get: (t, k) => (k === 'ZERNIO_API_KEY' ? key : (t as unknown as Record<string | symbol, unknown>)[k]) }) as Env;

interface CreatePostBody {
  objectKey: string;
  meta: VideoMeta;
  networks: Network[];
  captions: NetworkCaption;
  scheduledAt?: number;
  editoria?: Editoria;
  hookType?: string;
  coverOffsetMs?: number;
  experiment?: { id: string; variant: string };
}

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const m = req.method;

  if (m === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });
  if (!/^\/(api|oauth|media)(\/|$)/.test(path) && env.ASSETS) return env.ASSETS.fetch(req); // the app itself
  if (path === '/' || path === '/api') return json(env, { ok: true, app: 'Central do Set' });

  // ---------- first access / login (public, rate-limited) ----------
  if (path === '/api/public/status' && m === 'GET') return json(env, { app: 'central-do-set', needsSetup: await needsSetup(env) });
  if (path === '/api/setup' && m === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { code?: string; password?: string };
    return json(env, { token: await setup(env, b.code ?? '', b.password ?? '') });
  }
  if (path === '/api/login' && m === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { password?: string };
    return json(env, { token: await login(env, b.password ?? '') });
  }

  // ---------- quick connection callback (Zernio redirects back here) ----------
  if (path === '/oauth/zernio/callback' && m === 'GET') {
    const back = (q: string) => Response.redirect(`${env.APP_URL}#central?${q}`, 302);
    const network = url.searchParams.get('network') ?? '';
    if (!isNetwork(network)) return back('erro=rede');
    if (!(await db.takeState(env, url.searchParams.get('state') ?? '', network))) return back('erro=sessao-expirada');
    const accountId = url.searchParams.get('accountId');
    if (url.searchParams.get('error') || !accountId) return back(`erro=${encodeURIComponent(url.searchParams.get('error_message') ?? url.searchParams.get('error') ?? 'cancelado')}`);
    const username = url.searchParams.get('username') ?? undefined;
    await db.saveAccount(env, { network, remoteId: accountId, name: username, handle: username, token: { access: 'zernio', via: 'zernio', profileId: url.searchParams.get('profileId') ?? undefined } });
    return back(`conectado=${network}`);
  }

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
  const who = await authenticate(req, env);
  const need = (s: Scope | 'admin') => require(who, s);
  // Read-only routes need "ler"; replies "responder"; uploads/publishing "publicar"; experiments/report "estrategia";
  // account, app and access settings are app-only (never available to a Claude key).
  if (m === 'GET') need('ler');
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
    need('admin');
    const s = await body<Settings>();
    if (!['aprovacao', 'automatico', 'desligado'].includes(s.replyMode)) throw new HttpError(400, 'Modo inválido.');
    await db.saveSettings(env, { replyMode: s.replyMode, extraBlockedHashtags: (s.extraBlockedHashtags ?? []).slice(0, 200), signature: (s.signature ?? '').slice(0, 200) });
    return json(env, await db.getSettings(env));
  }

  const start = path.match(/^\/api\/oauth\/(\w+)\/start$/);
  if (start && m === 'POST') {
    need('admin');
    const n = start[1];
    if (!isNetwork(n)) throw new HttpError(404, 'Rede desconhecida.');
    if (!PROVIDERS[n].configured(env)) throw new HttpError(400, `Credenciais do app do ${n} não configuradas no servidor.`);
    const state = uid('st_');
    await db.saveState(env, state, n);
    return json(env, { url: PROVIDERS[n].authUrl(env, state) });
  }

  const disc = path.match(/^\/api\/accounts\/(\w+)$/);
  if (disc && m === 'DELETE' && isNetwork(disc[1])) { need('admin'); await db.deleteAccount(env, disc[1]); return json(env, { ok: true }); }

  if (path === '/api/uploads' && m === 'POST') {
    need('publicar');
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
    need('ler');
    const s = await db.getSettings(env);
    const b = await body<Parameters<typeof buildCaptions>[0]>();
    return json(env, buildCaptions({ ...b, extraBlocked: s.extraBlockedHashtags, signature: b.signature ?? s.signature }));
  }

  if (path === '/api/posts' && m === 'GET') return json(env, await db.listPosts(env));

  if (path === '/api/posts' && m === 'POST') {
    need('publicar');
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
      experiment: b.experiment?.id && b.experiment.variant ? { id: b.experiment.id, variant: b.experiment.variant } : undefined,
      targets: networks.map((network) => ({ network, status: scheduled ? 'agendado' : 'pendente' })),
    };
    await db.savePost(env, post);
    // Publish now: the request stays open while the networks process (the app shows progress).
    return json(env, scheduled ? post : await publishPost(env, post));
  }

  const pub = path.match(/^\/api\/posts\/([\w]+)\/publish$/);
  if (pub && m === 'POST') {
    need('publicar');
    const p = await db.getPost(env, pub[1]);
    if (!p) throw new HttpError(404, 'Post não encontrado.');
    return json(env, await publishPost(env, p));
  }

  const del = path.match(/^\/api\/posts\/([\w]+)$/);
  if (del && m === 'DELETE') {
    need('admin');
    const p = await db.getPost(env, del[1]);
    if (p && !p.targets.some((t) => t.status === 'publicado' || t.status === 'privado')) await env.VIDEOS.delete(p.objectKey);
    await db.deletePost(env, del[1]);
    return json(env, { ok: true });
  }

  if (path === '/api/comments' && m === 'GET') return json(env, await db.listComments(env, url.searchParams.get('status') ?? undefined));
  if (path === '/api/comments/sync' && m === 'POST') return need('ler'), json(env, await syncComments(env));

  const cm = path.match(/^\/api\/comments\/([^/]+)\/(reply|ignore)$/);
  if (cm && m === 'POST') {
    need('responder');
    const id = decodeURIComponent(cm[1]);
    if (cm[2] === 'reply') return json(env, await replyComment(env, id, (await body<{ text: string }>()).text));
    const c = await db.getComment(env, id);
    if (!c) throw new HttpError(404, 'Comentário não encontrado.');
    c.status = 'ignorado';
    await db.upsertComment(env, c, false);
    return json(env, c);
  }

  if (path === '/api/metrics' && m === 'GET') return json(env, { rows: await db.listMetrics(env), posts: await db.listPosts(env, 200) });
  if (path === '/api/metrics/sync' && m === 'POST') return need('ler'), json(env, { updated: await syncMetrics(env) });

  // ---------- inteligência ----------
  if (path === '/api/intel' && m === 'GET') return json(env, await intel(env));
  if (path === '/api/intel/report' && m === 'POST') return need('estrategia'), json(env, await generateReport(env));
  if (path === '/api/intel/playbook.md' && m === 'GET') {
    const d = await intel(env);
    return new Response(playbookMarkdown(d.playbook ?? (await latestPlaybook(env)), d.report), { headers: { 'Content-Type': 'text/markdown; charset=utf-8', ...corsHeaders(env) } });
  }
  if (path === '/api/experiments' && m === 'POST') {
    need('estrategia');
    const b = await body<{ name: string; hypothesis: string; dimension: string; variants: string[]; minPerVariant?: number }>();
    const variants = (b.variants ?? []).map((v) => v.trim()).filter(Boolean).slice(0, 3);
    if (!b.name?.trim() || variants.length < 2) throw new HttpError(400, 'Dê um nome e pelo menos 2 variantes.');
    const e = { id: uid('exp_'), name: b.name.trim(), hypothesis: (b.hypothesis ?? '').trim(), dimension: (b.dimension ?? '').trim(), variants, status: 'ativo' as const, minPerVariant: Math.max(3, Math.min(10, b.minPerVariant ?? 4)), createdAt: now(), createdBy: 'voce' as const };
    await saveExperiment(env, e);
    return json(env, e);
  }
  const ex = path.match(/^\/api\/experiments\/([\w]+)$/);
  if (ex && m === 'PUT') {
    need('estrategia');
    const { status } = await body<{ status: string }>();
    if (!['ativo', 'concluido', 'descartado'].includes(status)) throw new HttpError(400, 'Status inválido.');
    const e = (await listExperiments(env)).find((x) => x.id === ex[1]);
    if (!e) throw new HttpError(404, 'Experimento não encontrado.');
    e.status = status as typeof e.status;
    await saveExperiment(env, e);
    return json(env, e);
  }
  if (path === '/api/bench' && m === 'POST') return need('estrategia'), json(env, await addBenchChannel(env, (await body<{ handle: string }>()).handle ?? ''));
  if (path === '/api/bench/sync' && m === 'POST') return need('ler'), json(env, { videos: await syncBench(env) });
  const bc = path.match(/^\/api\/bench\/([\w-]+)$/);
  if (bc && m === 'DELETE') { need('estrategia'); await removeBenchChannel(env, bc[1]); return json(env, { ok: true }); }

  // ---------- access & connections (app only) ----------
  if (path === '/api/me' && m === 'GET') return json(env, who);
  if (path === '/api/password' && m === 'PUT') {
    need('admin');
    const b = await body<{ current: string; next: string }>();
    await changePassword(env, b.current ?? '', b.next ?? '');
    return json(env, { ok: true });
  }
  if (path === '/api/apps' && m === 'GET') {
    need('admin');
    return json(env, { quick: !!env.ZERNIO_API_KEY, windsor: !!env.WINDSOR_API_KEY, ...Object.fromEntries(NETWORKS.map((n) => [n, { configured: PROVIDERS[n].configured(env), redirectUri: callback(env, n) }])) });
  }
  if (path === '/api/quick/key' && (m === 'PUT' || m === 'DELETE')) {
    need('admin');
    if (m === 'DELETE') { await saveZernioKey(env, null); return json(env, { ok: true }); }
    const { key } = await body<{ key: string }>();
    await saveZernioKey(env, key ?? '');
    // Validate right away with the key just typed.
    try { await ensureProfile(withKey(env, key.trim())); }
    catch (e) { await saveZernioKey(env, null); throw e; }
    return json(env, { ok: true });
  }
  // Instagram through Windsor.ai (read via REST; publishing/replies by Claude in the chat)
  if (path === '/api/windsor/key' && (m === 'PUT' || m === 'DELETE')) {
    need('admin');
    if (m === 'DELETE') { await saveWindsorKey(env, null); return json(env, { ok: true }); }
    const { key, accountId } = await body<{ key: string; accountId?: string }>();
    const list = await windsorAccounts(env, (key ?? '').trim());
    if (!list.length) throw new HttpError(400, 'A chave funciona, mas nenhuma conta do Instagram está conectada no Windsor. Conecte o Instagram em onboard.windsor.ai e tente de novo.');
    const pick = list.find((a) => a.id === accountId) ?? list.find((a) => /luiznoset/i.test(a.username)) ?? list[0];
    await saveWindsorKey(env, key);
    await db.saveAccount(env, { network: 'instagram', remoteId: pick.id, name: pick.username, handle: pick.username, token: { access: 'windsor', via: 'windsor' } });
    return json(env, { ok: true, account: pick, all: list });
  }
  // Hand-off: posts waiting for Claude (Instagram via Windsor) and the report back.
  if (path === '/api/handoff' && m === 'GET') {
    need('publicar');
    const pending = [];
    for (const p of await db.listPosts(env, 100)) {
      for (const t of p.targets) {
        if (t.status !== 'aguardando') continue;
        pending.push({ postId: p.id, network: t.network, format: p.format, scheduledAt: p.scheduledAt, caption: t.network === 'youtube' ? p.captions.youtube : p.captions[t.network].caption, videoUrl: await presignGet(env, p.objectKey, 6 * 3600), coverOffsetMs: p.coverOffsetMs });
      }
    }
    return json(env, pending);
  }
  const tgt = path.match(/^\/api\/posts\/(\w+)\/targets\/(\w+)$/);
  if (tgt && m === 'PUT' && isNetwork(tgt[2])) {
    need('publicar');
    const p = await db.getPost(env, tgt[1]);
    const t = p?.targets.find((x) => x.network === tgt[2]);
    if (!p || !t) throw new HttpError(404, 'Post ou rede não encontrados.');
    const b = await body<{ status: 'publicado' | 'erro'; remoteId?: string; url?: string; error?: string }>();
    if (!['publicado', 'erro'].includes(b.status)) throw new HttpError(400, 'Status deve ser publicado ou erro.');
    Object.assign(t, { status: b.status, remoteId: b.remoteId ?? t.remoteId, url: b.url ?? t.url, error: b.error, publishedAt: b.status === 'publicado' ? now() : t.publishedAt });
    await db.savePost(env, p);
    return json(env, p);
  }
  const quick = path.match(/^\/api\/quick\/connect\/(\w+)$/);
  if (quick && m === 'POST' && isNetwork(quick[1])) {
    need('admin');
    const state = uid('st_');
    await db.saveState(env, state, quick[1]);
    const redirect = `${env.API_URL.replace(/\/$/, '')}/oauth/zernio/callback?${new URLSearchParams({ network: quick[1], state })}`;
    return json(env, { url: await connectUrl(env, quick[1], redirect) });
  }
  const appm = path.match(/^\/api\/apps\/(\w+)$/);
  if (appm && isNetwork(appm[1])) {
    need('admin');
    if (m === 'PUT') { const b = await body<{ id: string; secret: string }>(); await saveAppCreds(env, appm[1], b.id ?? '', b.secret ?? ''); return json(env, { ok: true }); }
    if (m === 'DELETE') { await deleteAppCreds(env, appm[1]); return json(env, { ok: true }); }
  }
  if (path === '/api/claude-keys' && m === 'GET') { need('admin'); return json(env, await listClaudeKeys(env)); }
  if (path === '/api/claude-keys' && m === 'POST') {
    need('admin');
    const b = await body<{ label?: string; scopes?: Scope[] }>();
    return json(env, await createClaudeKey(env, b.label ?? 'Claude', (b.scopes ?? ['ler']).filter((x) => ALL_SCOPES.includes(x))));
  }
  const ck = path.match(/^\/api\/claude-keys\/(\w+)$/);
  if (ck && m === 'DELETE') { need('admin'); await revokeClaudeKey(env, ck[1]); return json(env, { ok: true }); }

  throw new HttpError(404, 'Rota não encontrada.');
}

export default {
  async fetch(req: Request, rawEnv: Env): Promise<Response> {
    let env = rawEnv;
    try {
      env = await resolveEnv(rawEnv, new URL(req.url).origin);
      return await route(req, env);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      return json(env, { error: (e as Error).message }, status);
    }
  },

  async scheduled(_ev: ScheduledController, rawEnv: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      const env = await resolveEnv(rawEnv);
      await publishDue(env).catch((e) => console.error('publishDue', e));
      await syncComments(env).catch((e) => console.error('syncComments', e));
      // Metrics every hour is enough (cron runs every 15 min).
      const d = new Date();
      if (d.getUTCMinutes() < 15) await syncMetrics(env).catch((e) => console.error('syncMetrics', e));
      // Competitors once a day (03h BRT); strategy report every Monday 09h BRT.
      if (d.getUTCHours() === 6 && d.getUTCMinutes() < 15) await syncBench(env).catch((e) => console.error('syncBench', e));
      if (d.getUTCDay() === 1 && d.getUTCHours() === 12 && d.getUTCMinutes() < 15 && env.ANTHROPIC_API_KEY) await generateReport(env).catch((e) => console.error('report', e));
    })());
  },
} satisfies ExportedHandler<Env>;
