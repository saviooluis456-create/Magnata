// Orchestration: publishing to each network, comment sync + AI replies, metrics sync.
import type { AccountStatus, CommentItem, Network, Post } from '../../src/central/core/types';
import { NETWORK_LABEL, NETWORKS } from '../../src/central/core/types';
import { AUTO_SAFE, draftReply } from './ai';
import * as db from './db';
import type { Env } from './env';
import { instagram } from './providers/instagram';
import { tiktok } from './providers/tiktok';
import type { Provider } from './providers/types';
import { youtube } from './providers/youtube';
import { windsorInstagram } from './providers/windsor';
import { ZERNIO } from './providers/zernio';
import { HttpError, now } from './util';

export const PROVIDERS: Record<Network, Provider> = { instagram, tiktok, youtube };

/** The account decides the provider: quick connection (Zernio) or own developer app. */
export const providerFor = (acc: db.Account): Provider =>
  acc.token.via === 'zernio' ? ZERNIO[acc.network] : acc.token.via === 'windsor' ? windsorInstagram : PROVIDERS[acc.network];
const usable = (env: Env, acc: db.Account | null): acc is db.Account => !!acc && providerFor(acc).configured(env);

/** Loads the account and refreshes its token when needed. */
export async function account(env: Env, network: Network): Promise<db.Account> {
  const acc = await db.getAccount(env, network);
  if (!acc) throw new HttpError(400, `Conta do ${NETWORK_LABEL[network]} não conectada. Conecte na aba Contas.`);
  const fresh = await providerFor(acc).refresh(env, acc.token);
  if (fresh) { acc.token = fresh; await db.saveAccount(env, acc); }
  return acc;
}

export async function statuses(env: Env): Promise<AccountStatus[]> {
  return Promise.all(NETWORKS.map(async (n) => {
    const acc = await db.getAccount(env, n);
    const p = acc ? providerFor(acc) : PROVIDERS[n];
    const base: AccountStatus = { network: n, connected: false, publicPosting: p.publicPosting(env), via: acc?.token.via === 'zernio' ? 'rapida' : acc?.token.via === 'windsor' ? 'windsor' : acc ? 'oficial' : undefined };
    if (!acc || !p.configured(env)) return base;
    try {
      const a = await account(env, n);
      const prof = await p.profile(env, a);
      return { ...base, connected: true, name: prof.name ?? a.name, handle: prof.handle ?? a.handle, followers: prof.followers, expiresAt: a.token.refreshExpiresAt ?? a.token.expiresAt };
    } catch {
      return { ...base, connected: false, name: acc.name, handle: acc.handle };
    }
  }));
}

/** Publishes every pending target of a post. Networks run in parallel; one failure doesn't block the others. */
export async function publishPost(env: Env, post: Post): Promise<Post> {
  const todo = post.targets.filter((t) => t.status === 'pendente' || t.status === 'agendado' || t.status === 'erro');
  for (const t of todo) { t.status = 'enviando'; t.error = undefined; }
  await db.savePost(env, post);
  await Promise.all(todo.map(async (t) => {
    try {
      const acc = await account(env, t.network);
      const r = await providerFor(acc).publish(env, acc, post);
      Object.assign(t, { status: r.status, remoteId: r.remoteId, providerPostId: r.providerPostId, url: r.url, error: r.note, publishedAt: r.status === 'aguardando' ? undefined : now() });
    } catch (e) {
      t.status = 'erro';
      t.error = (e as Error).message;
    }
  }));
  await db.savePost(env, post);
  return post;
}

export async function publishDue(env: Env) {
  for (const p of await db.duePosts(env)) {
    if (p.targets.some((t) => t.status === 'pendente' || t.status === 'agendado')) await publishPost(env, p);
  }
}

// ---------- comments ----------
export async function syncComments(env: Env): Promise<{ novos: number; respondidos: number }> {
  const settings = await db.getSettings(env);
  const posts = await db.listPosts(env, 200);
  const byRemote = new Map<string, Post>();
  for (const p of posts) for (const t of p.targets) if (t.remoteId) byRemote.set(`${t.network}:${t.remoteId}`, p);

  let novos = 0, respondidos = 0, drafted = 0;
  for (const n of NETWORKS) {
    if (!usable(env, await db.getAccount(env, n))) continue;
    const acc = await account(env, n);
    const items = await providerFor(acc).comments(env, acc).catch(() => []);
    for (const raw of items.sort((a, b) => a.createdAt - b.createdAt)) {
      const post = byRemote.get(`${n}:${raw.mediaRemoteId}`);
      const c: CommentItem = { ...raw, postId: post?.id, status: 'novo' };
      const inserted = await db.upsertComment(env, c);
      if (!inserted) continue;
      novos++;
      if (settings.replyMode === 'desligado' || drafted >= 25) continue; // cap AI calls per run
      const d = await draftReply(env, c, post?.captions.youtube.title);
      drafted++;
      if (!d) continue;
      c.kind = d.kind;
      c.draft = d.reply.trim();
      if (!c.draft) c.status = d.kind === 'spam' ? 'ignorado' : 'revisar';
      else if (settings.replyMode === 'automatico' && AUTO_SAFE.includes(d.kind) && respondidos < 15) {
        try {
          await providerFor(acc).reply(env, acc, c, c.draft);
          Object.assign(c, { status: 'respondido', replyText: c.draft, repliedAt: now() });
          respondidos++;
        } catch { c.status = 'rascunho'; }
      } else c.status = AUTO_SAFE.includes(d.kind) ? 'rascunho' : 'revisar';
      await db.upsertComment(env, c, false);
    }
  }
  return { novos, respondidos };
}

export async function replyComment(env: Env, id: string, text: string): Promise<CommentItem> {
  const c = await db.getComment(env, id);
  if (!c) throw new HttpError(404, 'Comentário não encontrado.');
  const msg = text.trim();
  if (!msg) throw new HttpError(400, 'Resposta vazia.');
  const acc = await account(env, c.network);
  await providerFor(acc).reply(env, acc, c, msg);
  Object.assign(c, { status: 'respondido', replyText: msg, repliedAt: now() });
  await db.upsertComment(env, c, false);
  return c;
}

// ---------- metrics ----------
export async function syncMetrics(env: Env): Promise<number> {
  const posts = await db.listPosts(env, 200);
  let count = 0;
  for (const n of NETWORKS) {
    if (!usable(env, await db.getAccount(env, n))) continue;
    const items = posts.flatMap((p) => p.targets.filter((t) => t.network === n && (t.remoteId || t.providerPostId)).map((t) => ({ postId: p.id, remoteId: t.remoteId ?? '', providerPostId: t.providerPostId })));
    if (!items.length) continue;
    const acc = await account(env, n);
    const rows = await providerFor(acc).metrics(env, acc, items).catch(() => []);
    for (const r of rows) {
      await db.saveMetric(env, r);
      const post = posts.find((p) => p.id === r.postId);
      await db.saveSnapshot(env, r, post?.targets.find((t) => t.network === n)?.publishedAt);
      count++;
    }
  }
  return count;
}
