// Access control: password created on first access → app sessions; scoped keys for Claude; app credentials typed in the UI.
import type { Network } from '../../src/central/core/types';
import type { Env } from './env';
import { decrypt, encrypt, HttpError, now } from './util';

export type Scope = 'ler' | 'responder' | 'publicar' | 'estrategia';
export const ALL_SCOPES: Scope[] = ['ler', 'responder', 'publicar', 'estrategia'];
export interface Who { role: 'admin' | 'claude'; scopes: Scope[] }

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
export const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const randomToken = (prefix: string) => prefix + Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, '0')).join('');

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function pbkdf2(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 }, key, 256));
}

async function getSetting<T>(env: Env, key: string): Promise<T | null> {
  const r = await env.DB.prepare('SELECT value FROM settings WHERE key = ?1').bind(key).first<{ value: string }>();
  return r ? (JSON.parse(r.value) as T) : null;
}
async function setSetting(env: Env, key: string, value: unknown) {
  await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2').bind(key, JSON.stringify(value)).run();
}

// ---------- first access ----------
export async function needsSetup(env: Env): Promise<boolean> {
  return !(await getSetting(env, 'admin_password'));
}

async function issue(env: Env, role: Who['role'], scopes: Scope[], label: string, ttlDays?: number): Promise<string> {
  const token = randomToken(role === 'claude' ? 'lns_claude_' : 'lns_sess_');
  await env.DB.prepare('INSERT INTO api_keys (hash, role, scopes, label, prefix, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
    .bind(await sha256(token), role, JSON.stringify(scopes), label, token.slice(0, 16), now(), ttlDays ? now() + ttlDays * 86400_000 : null).run();
  return token;
}

export async function setup(env: Env, code: string, password: string): Promise<string> {
  if (!(await needsSetup(env))) throw new HttpError(409, 'A senha já foi criada. Entre com ela.');
  if (!env.SETUP_CODE) throw new HttpError(500, 'SETUP_CODE não configurado no servidor.');
  if (!safeEqual(code.trim(), env.SETUP_CODE)) { await failure(env); throw new HttpError(401, 'Código de instalação errado.'); }
  if (password.length < 12) throw new HttpError(400, 'Use uma senha com pelo menos 12 caracteres.');
  const salt = randomToken('');
  await setSetting(env, 'admin_password', { salt, hash: await pbkdf2(password, salt) });
  return issue(env, 'admin', ALL_SCOPES, 'app', 90);
}

async function failure(env: Env) {
  const f = (await getSetting<{ n: number; since: number }>(env, 'login_failures')) ?? { n: 0, since: now() };
  const fresh = now() - f.since > 15 * 60_000 ? { n: 1, since: now() } : { n: f.n + 1, since: f.since };
  await setSetting(env, 'login_failures', fresh);
}

export async function login(env: Env, password: string): Promise<string> {
  const f = await getSetting<{ n: number; since: number }>(env, 'login_failures');
  if (f && f.n >= 8 && now() - f.since < 15 * 60_000) throw new HttpError(429, 'Muitas tentativas. Espere 15 minutos.');
  const stored = await getSetting<{ salt: string; hash: string }>(env, 'admin_password');
  if (!stored) throw new HttpError(409, 'Crie a senha primeiro.');
  if (!safeEqual(await pbkdf2(password, stored.salt), stored.hash)) { await failure(env); throw new HttpError(401, 'Senha errada.'); }
  await setSetting(env, 'login_failures', { n: 0, since: now() });
  return issue(env, 'admin', ALL_SCOPES, 'app', 90);
}

export async function changePassword(env: Env, current: string, next: string) {
  const stored = await getSetting<{ salt: string; hash: string }>(env, 'admin_password');
  if (!stored || !safeEqual(await pbkdf2(current, stored.salt), stored.hash)) throw new HttpError(401, 'Senha atual errada.');
  if (next.length < 12) throw new HttpError(400, 'Use uma senha com pelo menos 12 caracteres.');
  const salt = randomToken('');
  await setSetting(env, 'admin_password', { salt, hash: await pbkdf2(next, salt) });
  await env.DB.prepare("DELETE FROM api_keys WHERE role = 'admin'").run(); // sign out every device
}

// ---------- every request ----------
export async function authenticate(req: Request, env: Env): Promise<Who> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new HttpError(401, 'Entre na Central.');
  if (env.ADMIN_TOKEN && env.ADMIN_TOKEN.length >= 24 && safeEqual(await sha256(token), await sha256(env.ADMIN_TOKEN))) return { role: 'admin', scopes: ALL_SCOPES };
  const h = await sha256(token);
  const r = await env.DB.prepare('SELECT role, scopes, expires_at, last_used FROM api_keys WHERE hash = ?1').bind(h).first<{ role: Who['role']; scopes: string; expires_at: number | null; last_used: number | null }>();
  if (!r || (r.expires_at && r.expires_at < now())) throw new HttpError(401, 'Sessão expirada. Entre de novo.');
  if (!r.last_used || now() - r.last_used > 3600_000) await env.DB.prepare('UPDATE api_keys SET last_used = ?1 WHERE hash = ?2').bind(now(), h).run();
  return { role: r.role, scopes: JSON.parse(r.scopes) as Scope[] };
}

export function require(who: Who, need: Scope | 'admin') {
  if (who.role === 'admin') return;
  if (need === 'admin' || !who.scopes.includes(need)) throw new HttpError(403, `Esta chave não tem permissão para isso (${need}).`);
}

// ---------- Claude keys ----------
export async function createClaudeKey(env: Env, label: string, scopes: Scope[]) {
  const valid = scopes.filter((s) => ALL_SCOPES.includes(s));
  if (!valid.includes('ler')) valid.unshift('ler');
  return { token: await issue(env, 'claude', valid, label.slice(0, 60) || 'Claude'), scopes: valid };
}
export async function listClaudeKeys(env: Env) {
  const { results } = await env.DB.prepare("SELECT hash, label, prefix, scopes, created_at, last_used FROM api_keys WHERE role = 'claude' ORDER BY created_at DESC").all<{ hash: string; label: string; prefix: string; scopes: string; created_at: number; last_used: number | null }>();
  return results.map((r) => ({ id: r.hash.slice(0, 16), label: r.label, prefix: r.prefix, scopes: JSON.parse(r.scopes), createdAt: r.created_at, lastUsed: r.last_used }));
}
export async function revokeClaudeKey(env: Env, id: string) {
  await env.DB.prepare("DELETE FROM api_keys WHERE role = 'claude' AND substr(hash, 1, 16) = ?1").bind(id).run();
}

// ---------- developer-app credentials typed in the Central ----------
const APP_KEYS: Record<Network, [keyof Env, keyof Env]> = {
  instagram: ['IG_APP_ID', 'IG_APP_SECRET'],
  youtube: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  tiktok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
};

export async function saveAppCreds(env: Env, network: Network, id: string, secret: string) {
  if (!id.trim() || !secret.trim()) throw new HttpError(400, 'Preencha o ID e a chave secreta.');
  await setSetting(env, `app_${network}`, await encrypt(env, { id: id.trim(), secret: secret.trim() }));
}
export async function deleteAppCreds(env: Env, network: Network) {
  await env.DB.prepare('DELETE FROM settings WHERE key = ?1').bind(`app_${network}`).run();
}

export async function saveZernioKey(env: Env, key: string | null) {
  if (key === null) { await env.DB.prepare("DELETE FROM settings WHERE key IN ('zernio_key', 'zernio_profile')").run(); return; }
  if (!/^sk_[A-Za-z0-9]{20,}$/.test(key.trim())) throw new HttpError(400, 'Essa não parece uma chave do Zernio (começa com sk_).');
  await setSetting(env, 'zernio_key', await encrypt(env, key.trim()));
}

export async function saveWindsorKey(env: Env, key: string | null) {
  if (key === null) { await env.DB.prepare("DELETE FROM settings WHERE key = 'windsor_key'").run(); return; }
  if (key.trim().length < 16) throw new HttpError(400, 'Essa não parece uma chave da API do Windsor.');
  await setSetting(env, 'windsor_key', await encrypt(env, key.trim()));
}

/** Returns env with app credentials from the database filled in, and API_URL/APP_URL derived when not set. */
export async function resolveEnv(env: Env, origin?: string): Promise<Env> {
  const over: Record<string, string> = {};
  // A Proxy keeps the bindings (DB, VIDEOS, ASSETS) exactly as the runtime gave them.
  const out = new Proxy(env, { get: (t, k) => (typeof k === 'string' && k in over ? over[k] : (t as unknown as Record<string | symbol, unknown>)[k]) });
  for (const [network, [idKey, secretKey]] of Object.entries(APP_KEYS) as [Network, [keyof Env, keyof Env]][]) {
    if (env[idKey] && env[secretKey]) continue;
    const blob = await getSetting<string>(env, `app_${network}`);
    if (!blob) continue;
    try {
      const c = await decrypt<{ id: string; secret: string }>(env, blob);
      over[idKey] = c.id;
      over[secretKey] = c.secret;
    } catch { /* TOKEN_KEY changed: credentials must be typed again */ }
  }
  if (!env.ZERNIO_API_KEY) {
    const zk = await getSetting<string>(env, 'zernio_key');
    if (zk) { try { over.ZERNIO_API_KEY = await decrypt<string>(env, zk); } catch { /* re-type the key */ } }
  }
  if (!env.WINDSOR_API_KEY) {
    const wk = await getSetting<string>(env, 'windsor_key');
    if (wk) { try { over.WINDSOR_API_KEY = await decrypt<string>(env, wk); } catch { /* re-type the key */ } }
  }
  const isPlaceholder = (u?: string) => !u || /SEU-|SUA-/i.test(u);
  if (origin) {
    const saved = await getSetting<string>(env, 'origin');
    if (saved !== origin) await setSetting(env, 'origin', origin);
  }
  const base = origin ?? (await getSetting<string>(env, 'origin')) ?? '';
  if (isPlaceholder(env.API_URL)) over.API_URL = base;
  if (isPlaceholder(env.APP_URL)) over.APP_URL = base + '/';
  return out;
}
