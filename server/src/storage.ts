// Video storage on Cloudflare R2. The browser uploads straight to R2 with a presigned URL (no size limit from the
// Worker), and Instagram downloads the video from a short-lived presigned GET URL.
import { AwsClient } from 'aws4fetch';
import type { Env } from './env';
import { hmac, HttpError } from './util';

function client(env: Env) {
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) throw new HttpError(500, 'Credenciais do R2 não configuradas.');
  return new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
}

const objectUrl = (env: Env, key: string) =>
  `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`;

/** With an R2 API token, the browser uploads straight to R2 (any size). Without it, through this Worker (≤100 MB on the free plan). */
export const hasR2Keys = (env: Env) => !!(env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);

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

export async function presignPut(env: Env, key: string, contentType: string, expiresSec = 3600): Promise<string> {
  if (!hasR2Keys(env)) return workerUrl(env, 'upload', key, expiresSec);
  const url = new URL(objectUrl(env, key));
  url.searchParams.set('X-Amz-Expires', String(expiresSec));
  const signed = await client(env).sign(new Request(url, { method: 'PUT', headers: { 'Content-Type': contentType } }), { aws: { signQuery: true } });
  return signed.url;
}

export async function presignGet(env: Env, key: string, expiresSec = 6 * 3600): Promise<string> {
  if (!hasR2Keys(env)) return workerUrl(env, 'media', key, expiresSec);
  const url = new URL(objectUrl(env, key));
  url.searchParams.set('X-Amz-Expires', String(expiresSec));
  const signed = await client(env).sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } });
  return signed.url;
}

export async function head(env: Env, key: string): Promise<R2Object> {
  const obj = await env.VIDEOS.head(key);
  if (!obj) throw new HttpError(404, 'Vídeo não encontrado no armazenamento. Envie de novo.');
  return obj;
}

/** Whole object as a stream with a known length (needed by the YouTube upload). */
export async function stream(env: Env, key: string, range?: { offset: number; length: number }): Promise<{ body: ReadableStream; size: number }> {
  const obj = await env.VIDEOS.get(key, range ? { range } : undefined);
  if (!obj) throw new HttpError(404, 'Vídeo não encontrado no armazenamento.');
  const length = range ? range.length : obj.size;
  const fixed = new FixedLengthStream(length);
  obj.body.pipeTo(fixed.writable).catch(() => {});
  return { body: fixed.readable, size: length };
}
