import type { Project } from '../model/types';

const DB_NAME = 'magnata-studio';
const VERSION = 1;
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbp = null; reject(req.error); };
  });
  return dbp;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

export const db = {
  async listProjects(): Promise<Project[]> {
    try {
      const all = await tx<Project[]>('projects', 'readonly', (s) => s.getAll() as IDBRequest<Project[]>);
      return all.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch { return []; }
  },
  getProject: (id: string) => tx<Project | undefined>('projects', 'readonly', (s) => s.get(id) as IDBRequest<Project | undefined>),
  saveProject: (p: Project) => tx('projects', 'readwrite', (s) => s.put(p)),
  deleteProject: (id: string) => tx('projects', 'readwrite', (s) => s.delete(id)),
  putMedia: (id: string, blob: Blob) => tx('media', 'readwrite', (s) => s.put(blob, id)),
  getMedia: (id: string) => tx<Blob | undefined>('media', 'readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>),
  deleteMedia: (id: string) => tx('media', 'readwrite', (s) => s.delete(id)),
  async estimate(): Promise<{ usage: number; quota: number } | null> {
    try {
      const e = await navigator.storage?.estimate?.();
      return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null;
    } catch { return null; }
  },
  async persist() { try { await navigator.storage?.persist?.(); } catch { /* ignore */ } },
};
