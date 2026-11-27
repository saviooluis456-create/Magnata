// Client for the Central do Set API (Cloudflare Worker in /server).
import type { Experiment } from './core/analytics';
import type { IntelPayload, StrategyReport } from './core/intel-types';
import type { AccountStatus, CommentItem, Editoria, MetricRow, Network, NetworkCaption, Post, Settings, VideoMeta } from './core/types';

const KEY = 'central.config';
export interface Config { apiUrl: string; token: string }

export function getConfig(): Config | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Config | null;
    return c?.apiUrl && c.token ? c : null;
  } catch { return null; }
}
export function setConfig(c: Config | null) {
  try { if (c) localStorage.setItem(KEY, JSON.stringify({ ...c, apiUrl: c.apiUrl.replace(/\/+$/, '') })); else localStorage.removeItem(KEY); } catch { /* */ }
}

/** True when this app is being served by the Central's own server (same address as the API). */
let sameOrigin: Promise<boolean> | null = null;
export function detectSameOrigin(): Promise<boolean> {
  sameOrigin ??= fetch(location.origin + '/api/public/status').then((r) => r.json()).then((j) => j?.app === 'central-do-set').catch(() => false);
  return sameOrigin;
}

export async function publicStatus(apiUrl: string): Promise<{ needsSetup: boolean }> {
  const r = await fetch(apiUrl.replace(/\/+$/, '') + '/api/public/status');
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.app !== 'central-do-set') throw new Error('Não encontrei a Central neste endereço.');
  return j;
}

async function publicPost(apiUrl: string, path: string, body: unknown): Promise<{ token: string }> {
  const r = await fetch(apiUrl.replace(/\/+$/, '') + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Erro ${r.status}`);
  return j as { token: string };
}
export const setupCentral = (apiUrl: string, code: string, password: string) => publicPost(apiUrl, '/api/setup', { code, password });
export const loginCentral = (apiUrl: string, password: string) => publicPost(apiUrl, '/api/login', { password });

export type Scope = 'ler' | 'responder' | 'publicar' | 'estrategia';
export interface ClaudeKey { id: string; label: string; prefix: string; scopes: Scope[]; createdAt: number; lastUsed: number | null }

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const c = getConfig();
  if (!c) throw new Error('Configure o servidor na aba Contas.');
  const res = await fetch(c.apiUrl + path, {
    ...init,
    headers: { Authorization: `Bearer ${c.token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/api/password')) { setConfig(null); window.dispatchEvent(new Event('central-logout')); }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erro ${res.status}`);
  return data as T;
}

export interface StatusResponse { accounts: AccountStatus[]; settings: Settings; configured: Record<Network, boolean>; ai: boolean }

export const api = {
  status: () => call<StatusResponse>('/api/status'),
  saveSettings: (s: Settings) => call<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(s) }),
  connect: (n: Network) => call<{ url: string }>(`/api/oauth/${n}/start`, { method: 'POST' }),
  disconnect: (n: Network) => call(`/api/accounts/${n}`, { method: 'DELETE' }),
  posts: () => call<Post[]>('/api/posts'),
  createPost: (b: { objectKey: string; meta: VideoMeta; networks: Network[]; captions: NetworkCaption; scheduledAt?: number; editoria?: Editoria; hookType?: string; coverOffsetMs?: number; experiment?: { id: string; variant: string } }) =>
    call<Post>('/api/posts', { method: 'POST', body: JSON.stringify(b) }),
  retry: (id: string) => call<Post>(`/api/posts/${id}/publish`, { method: 'POST' }),
  deletePost: (id: string) => call(`/api/posts/${id}`, { method: 'DELETE' }),
  comments: (status?: string) => call<CommentItem[]>(`/api/comments${status ? `?status=${status}` : ''}`),
  syncComments: () => call<{ novos: number; respondidos: number }>('/api/comments/sync', { method: 'POST' }),
  reply: (id: string, text: string) => call<CommentItem>(`/api/comments/${encodeURIComponent(id)}/reply`, { method: 'POST', body: JSON.stringify({ text }) }),
  ignore: (id: string) => call<CommentItem>(`/api/comments/${encodeURIComponent(id)}/ignore`, { method: 'POST' }),
  metrics: () => call<{ rows: MetricRow[]; posts: Post[] }>('/api/metrics'),
  syncMetrics: () => call<{ updated: number }>('/api/metrics/sync', { method: 'POST' }),
  intel: () => call<IntelPayload>('/api/intel'),
  report: () => call<StrategyReport>('/api/intel/report', { method: 'POST' }),
  async playbookMd(): Promise<string> {
    const c = getConfig();
    if (!c) throw new Error('Configure o servidor.');
    const r = await fetch(c.apiUrl + '/api/intel/playbook.md', { headers: { Authorization: `Bearer ${c.token}` } });
    if (!r.ok) throw new Error(`Erro ${r.status}`);
    return r.text();
  },
  createExperiment: (b: { name: string; hypothesis: string; dimension: string; variants: string[]; minPerVariant?: number }) =>
    call<Experiment>('/api/experiments', { method: 'POST', body: JSON.stringify(b) }),
  setExperiment: (id: string, status: 'ativo' | 'concluido' | 'descartado') => call<Experiment>(`/api/experiments/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  addBench: (handle: string) => call<{ channelId: string; title: string }>('/api/bench', { method: 'POST', body: JSON.stringify({ handle }) }),
  removeBench: (id: string) => call(`/api/bench/${id}`, { method: 'DELETE' }),
  syncBench: () => call<{ videos: number }>('/api/bench/sync', { method: 'POST' }),
  saveWindsorKey: (key: string) => call<{ ok: boolean; account: { id: string; username: string } }>('/api/windsor/key', { method: 'PUT', body: JSON.stringify({ key }) }),
  removeWindsorKey: () => call('/api/windsor/key', { method: 'DELETE' }),
  apps: () => call<{ quick: boolean; windsor: boolean } & Record<Network, { configured: boolean; redirectUri: string }>>('/api/apps'),
  saveQuickKey: (key: string) => call<{ ok: boolean; linked: string[] }>('/api/quick/key', { method: 'PUT', body: JSON.stringify({ key }) }),
  removeQuickKey: () => call('/api/quick/key', { method: 'DELETE' }),
  quickConnect: (n: Network) => call<{ url: string }>(`/api/quick/connect/${n}`, { method: 'POST' }),
  saveApp: (n: Network, id: string, secret: string) => call(`/api/apps/${n}`, { method: 'PUT', body: JSON.stringify({ id, secret }) }),
  deleteApp: (n: Network) => call(`/api/apps/${n}`, { method: 'DELETE' }),
  claudeKeys: () => call<ClaudeKey[]>('/api/claude-keys'),
  createClaudeKey: (label: string, scopes: Scope[]) => call<{ token: string; scopes: Scope[] }>('/api/claude-keys', { method: 'POST', body: JSON.stringify({ label, scopes }) }),
  revokeClaudeKey: (id: string) => call(`/api/claude-keys/${id}`, { method: 'DELETE' }),
  changePassword: (current: string, next: string) => call('/api/password', { method: 'PUT', body: JSON.stringify({ current, next }) }),

  /** Uploads the original file straight to storage (no recompression), with progress. */
  async upload(file: Blob, name: string, onProgress: (p: number) => void): Promise<string> {
    const type = file.type || (name.endsWith('.mov') ? 'video/quicktime' : name.endsWith('.webm') ? 'video/webm' : 'video/mp4');
    const { objectKey, uploadUrl } = await call<{ objectKey: string; uploadUrl: string }>('/api/uploads', {
      method: 'POST', body: JSON.stringify({ filename: name, contentType: type, size: file.size }),
    });
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', type);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Falha no envio (${xhr.status}). Confira o CORS do bucket R2.`)));
      xhr.onerror = () => reject(new Error('Falha de rede no envio. Confira a conexão e o CORS do bucket R2.'));
      xhr.send(file);
    });
    return objectKey;
  },
};
