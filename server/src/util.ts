import type { Env } from './env';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const now = () => Date.now();

export function uid(prefix = ''): string {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return prefix + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function corsHeaders(env: Env): Record<string, string> {
  const origin = new URL(env.APP_URL).origin;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(env: Env, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders(env) } });
}

/** Constant-time comparison of the admin bearer token. */
export async function requireAdmin(req: Request, env: Env): Promise<void> {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 24) throw new HttpError(500, 'ADMIN_TOKEN não configurado (mínimo 24 caracteres).');
  const got = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(got)),
    crypto.subtle.digest('SHA-256', enc.encode(env.ADMIN_TOKEN)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  if (diff !== 0) throw new HttpError(401, 'Não autorizado.');
}

// ---------- token encryption (AES-GCM, key from TOKEN_KEY secret) ----------
async function key(env: Env): Promise<CryptoKey> {
  if (!env.TOKEN_KEY) throw new HttpError(500, 'TOKEN_KEY não configurado.');
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.TOKEN_KEY));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encrypt(env: Env, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(env), new TextEncoder().encode(JSON.stringify(value)));
  return b64(iv) + '.' + b64(new Uint8Array(ct));
}

export async function decrypt<T>(env: Env, blob: string): Promise<T> {
  const [iv, ct] = blob.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await key(env), unb64(ct));
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}

/** fetch + JSON with readable errors from the platform APIs. */
export async function api<T = any>(url: string, init: RequestInit = {}, label = 'API'): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  const err = body && typeof body === 'object' ? body.error : undefined;
  // TikTok answers { error: { code: 'ok' } } on success; Google OAuth uses { error: 'invalid_grant' }.
  const failed = !res.ok || typeof err === 'string' || (err && typeof err === 'object' && err.code !== undefined && err.code !== 'ok');
  if (failed) {
    const msg = err?.message ?? body?.error_description ?? err?.code ?? err ?? (typeof body === 'string' ? body.slice(0, 300) : res.statusText);
    throw new HttpError(res.status >= 400 ? res.status : 502, `${label}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
  return body as T;
}

export const form = (data: Record<string, string>) => new URLSearchParams(data).toString();

/** HMAC-SHA256 (hex) with TOKEN_KEY: signs short-lived media URLs. */
export async function hmac(env: Env, data: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('media:' + env.TOKEN_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}
