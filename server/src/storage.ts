// Video storage. Two backends:
// - Cloudflare R2 (binding VIDEOS), when available. Needs a card on Cloudflare even on the free tier.
// - Zernio's free media storage (default, 100% free): the Worker streams the upload to a Zernio presigned URL and
//   keeps the public link in D1. Instagram (via Windsor or official API) and the networks download from that link.
import { AwsClient } from 'aws4fetch';
import type { Env } from './env';
import { zernioPresign } from './providers/zernio';
import { hmac, HttpError, now } from './util';

export const hasR2 = (env: Env) => !!env.VIDEOS;
export const hasR2Keys = (env: Env) => hasR2(env) && !!(env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);

function client(env: Env) {
  return new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
}
const objectUrl = (env: Env, key: string) =>
  `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`;

async function workerUrl(env: Env, route: 'upload' | 'media', key: string, expiresSec: number) {
  const exp = Math.floor(Date.now() / 1000) + expiresSec;
  const sig = await hmac(env, `${route}:${key}:${exp}`);
  return `${env.API_URL.replace(/\/$/, '')}/${route === 'upload' ? 'api/uploads/direct' : 'media'}?${new URLSearchParams({ key, exp: String(exp), sig })}`;
}

export async function verifyWorkerUrl(env: Env, route: 'upload' | 'media', url: URL): Promise<string> {
  const key = url.searchParams.get('key') ?? '', exp = Number(url.searchParams.get('exp')), sig = url.searchParams.get('sig') ?? '';
  if (!key.startsWith('videos/') || !(exp > Date.now() / 1000) || sig !== (await hmac(env, `${route}:${key}:${exp}`))) throw new HttpError(403, 'Link expirado ou inválido.');
  return key;
}

export function storageReady(env: Env): string | null {
  if (hasR2(env) || env.ZERNIO_API_KEY) return null;
  return 'Para guardar os vídeos de graça, ative a conexão rápida (chave do Zernio) na aba Contas.';
}

/** Where the browser sends the file. R2 with keys: straight to R2. Otherwise: through this Worker (≤100 MB). */
export async function presignPut(env: Env, key: string, contentType: string, expiresSec = 3600): Promise<string> {
  if (!hasR2Keys(env)) return workerUrl(env, 'upload', key, expiresSec);
  const url = new URL(objectUrl(env, key));
  url.searchParams.set('X-Amz-Expires', String(expiresSec));
  const signed = await client(env).sign(new Request(url, { method: 'PUT', headers: { 'Content-Type': contentType } }), { aws: { signQuery: true } });
  return signed.url;
}

/** Receives the upload through the Worker and stores it (R2, or streamed straight to Zernio's storage). */
export async function receiveUpload(env: Env, key: string, req: Request) {
  if (!req.body) throw new HttpError(400, 'Arquivo vazio.');
  const type = req.headers.get('Content-Type') ?? 'video/mp4';
  if (hasR2(env)) { await env.VIDEOS!.put(key, req.body, { httpMetadata: { contentType: type } }); return; }
  const size = Number(req.headers.get('Content-Length'));
  if (!size) throw new HttpError(411, 'Tamanho do arquivo não informado.');
  const pre = await zernioPresign(env, key.split('/').pop()!, type, size);
  const put = await fetch(pre.uploadUrl, { method: 'PUT', headers: { 'Content-Type': type, 'Content-Length': String(size) }, body: req.body });
  if (!put.ok) throw new HttpError(502, `Falha ao guardar o vídeo (${put.status}).`);
  await env.DB.prepare('INSERT INTO media (key, public_url, size, content_type, created_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(key) DO UPDATE SET public_url = ?2, size = ?3, content_type = ?4')
    .bind(key, pre.publicUrl, size, type, now()).run();
}

export async function zernioMediaUrl(env: Env, key: string): Promise<string | null> {
  const r = await env.DB.prepare('SELECT public_url FROM media WHERE key = ?1').bind(key).first<{ public_url: string }>();
  return r?.public_url ?? null;
}

/** Public link the networks (and Windsor) download the video from. */
export async function presignGet(env: Env, key: string, expiresSec = 6 * 3600): Promise<string> {
  const z = await zernioMediaUrl(env, key);
  if (z) return z;
  if (!hasR2Keys(env)) return workerUrl(env, 'media', key, expiresSec);
  const url = new URL(objectUrl(env, key));
  url.searchParams.set('X-Amz-Expires', String(expiresSec));
  const signed = await client(env).sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } });
  return signed.url;
}

export async function head(env: Env, key: string): Promise<{ size: number; contentType: string }> {
  const r = await env.DB.prepare('SELECT size, content_type FROM media WHERE key = ?1').bind(key).first<{ size: number; content_type: string }>();
  if (r) return { size: r.size, contentType: r.content_type };
  const obj = hasR2(env) ? await env.VIDEOS!.head(key) : null;
  if (!obj) throw new HttpError(404, 'Vídeo não encontrado no armazenamento. Envie de novo.');
  return { size: obj.size, contentType: obj.httpMetadata?.contentType ?? 'video/mp4' };
}

export async function exists(env: Env, key: string): Promise<boolean> {
  try { await head(env, key); return true; } catch { return false; }
}

/** Whole object (or a byte range) as a stream with a known length. */
export async function stream(env: Env, key: string, range?: { offset: number; length: number }): Promise<{ body: ReadableStream; size: number }> {
  const z = await zernioMediaUrl(env, key);
  if (z) {
    const res = await fetch(z, range ? { headers: { Range: `bytes=${range.offset}-${range.offset + range.length - 1}` } } : {});
    if (!res.ok || !res.body) throw new HttpError(502, 'Não consegui ler o vídeo guardado.');
    const size = range ? range.length : Number(res.headers.get('Content-Length')) || (await head(env, key)).size;
    const fixed = new FixedLengthStream(size);
    res.body.pipeTo(fixed.writable).catch(() => {});
    return { body: fixed.readable, size };
  }
  const obj = hasR2(env) ? await env.VIDEOS!.get(key, range ? { range } : undefined) : null;
  if (!obj) throw new HttpError(404, 'Vídeo não encontrado no armazenamento.');
  const length = range ? range.length : obj.size;
  const fixed = new FixedLengthStream(length);
  obj.body.pipeTo(fixed.writable).catch(() => {});
  return { body: fixed.readable, size: length };
}

export async function remove(env: Env, key: string) {
  await env.DB.prepare('DELETE FROM media WHERE key = ?1').bind(key).run();
  if (hasR2(env)) await env.VIDEOS!.delete(key);
}
