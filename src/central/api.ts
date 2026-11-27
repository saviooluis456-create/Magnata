// Client for the Central do Set API (Cloudflare Worker in /server).
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

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const c = getConfig();
  if (!c) throw new Error('Configure o servidor na aba Contas.');
  const res = await fetch(c.apiUrl + path, {
    ...init,
    headers: { Authorization: `Bearer ${c.token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  const data = await res.json().catch(() => ({}));
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
  createPost: (b: { objectKey: string; meta: VideoMeta; networks: Network[]; captions: NetworkCaption; scheduledAt?: number; editoria?: Editoria; hookType?: string; coverOffsetMs?: number }) =>
    call<Post>('/api/posts', { method: 'POST', body: JSON.stringify(b) }),
  retry: (id: string) => call<Post>(`/api/posts/${id}/publish`, { method: 'POST' }),
  deletePost: (id: string) => call(`/api/posts/${id}`, { method: 'DELETE' }),
  comments: (status?: string) => call<CommentItem[]>(`/api/comments${status ? `?status=${status}` : ''}`),
  syncComments: () => call<{ novos: number; respondidos: number }>('/api/comments/sync', { method: 'POST' }),
  reply: (id: string, text: string) => call<CommentItem>(`/api/comments/${encodeURIComponent(id)}/reply`, { method: 'POST', body: JSON.stringify({ text }) }),
  ignore: (id: string) => call<CommentItem>(`/api/comments/${encodeURIComponent(id)}/ignore`, { method: 'POST' }),
  metrics: () => call<{ rows: MetricRow[]; posts: Post[] }>('/api/metrics'),
  syncMetrics: () => call<{ updated: number }>('/api/metrics/sync', { method: 'POST' }),

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
