import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from 'mediabunny';
import { uid } from '../model/defaults';
import type { MediaAsset, MediaKind } from '../model/types';
import { db } from '../store/db';

const blobs = new Map<string, Blob>();
const urls = new Map<string, string>();
const images = new Map<string, Promise<ImageBitmap | HTMLImageElement>>();
const imageReady = new Map<string, ImageBitmap | HTMLImageElement>();
const audioBuffers = new Map<string, Promise<AudioBuffer | null>>();

export function kindOf(file: File | Blob, name = ''): MediaKind | null {
  const t = file.type;
  const n = (name || (file as File).name || '').toLowerCase();
  if (t.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv|3gp|avi)$/.test(n)) return 'video';
  if (t.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic|heif|avif|bmp|svg)$/.test(n)) return 'image';
  if (t.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|weba)$/.test(n)) return 'audio';
  return null;
}

export async function ensureBlob(id: string): Promise<Blob | null> {
  const b = blobs.get(id);
  if (b) return b;
  try {
    const fromDb = await db.getMedia(id);
    if (fromDb) { blobs.set(id, fromDb); return fromDb; }
  } catch { /* ignore */ }
  return null;
}

export function urlOf(id: string): string | null {
  const u = urls.get(id);
  if (u) return u;
  const b = blobs.get(id);
  if (!b) return null;
  const nu = URL.createObjectURL(b);
  urls.set(id, nu);
  return nu;
}

export async function ensureUrl(id: string): Promise<string | null> {
  await ensureBlob(id);
  return urlOf(id);
}

export function registerBlob(id: string, blob: Blob) {
  blobs.set(id, blob);
}

function loadVideoMeta(url: string): Promise<{ duration: number; width: number; height: number; el: HTMLVideoElement }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.crossOrigin = 'anonymous';
    const to = setTimeout(() => reject(new Error('Tempo esgotado ao ler o vídeo')), 20000);
    v.onloadedmetadata = () => {
      const finish = () => { clearTimeout(to); resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight, el: v }); };
      if (!isFinite(v.duration)) {
        // some webm files report Infinity until seeked to the end
        v.currentTime = 1e7;
        v.ontimeupdate = () => { v.ontimeupdate = null; v.currentTime = 0; finish(); };
      } else finish();
    };
    v.onerror = () => { clearTimeout(to); reject(new Error('Formato de vídeo não suportado neste navegador')); };
    v.src = url;
  });
}

function loadAudioMeta(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const a = document.createElement('audio');
    a.preload = 'metadata';
    const to = setTimeout(() => reject(new Error('Tempo esgotado ao ler o áudio')), 15000);
    a.onloadedmetadata = () => { clearTimeout(to); resolve(isFinite(a.duration) ? a.duration : 0); };
    a.onerror = () => { clearTimeout(to); reject(new Error('Formato de áudio não suportado')); };
    a.src = url;
  });
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const to = setTimeout(done, 3000);
    function done() { clearTimeout(to); v.removeEventListener('seeked', done); resolve(); }
    v.addEventListener('seeked', done);
    v.currentTime = Math.max(0, Math.min(t, (v.duration || 0) - 0.05));
  });
}

async function filmstrip(v: HTMLVideoElement, duration: number, count: number): Promise<string[]> {
  const c = document.createElement('canvas');
  const h = 96;
  const w = Math.max(1, Math.round((v.videoWidth / Math.max(1, v.videoHeight)) * h));
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? Math.min(0.5, duration / 2) : (duration * (i + 0.5)) / count;
    await seek(v, t);
    try { ctx.drawImage(v, 0, 0, w, h); out.push(c.toDataURL('image/jpeg', 0.6)); } catch { /* tainted/unsupported */ }
  }
  return out;
}

let sharedCtx: AudioContext | null = null;
export function audioCtx(): AudioContext {
  if (!sharedCtx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new AC({ latencyHint: 'interactive' });
  }
  return sharedCtx;
}

export function decodeAudio(id: string): Promise<AudioBuffer | null> {
  let p = audioBuffers.get(id);
  if (p) return p;
  p = (async () => {
    const b = await ensureBlob(id);
    if (!b) return null;
    try {
      const ab = await b.arrayBuffer();
      return await new Promise<AudioBuffer>((res, rej) => {
        const r = audioCtx().decodeAudioData(ab, res, rej);
        if (r && typeof (r as Promise<AudioBuffer>).then === 'function') (r as Promise<AudioBuffer>).then(res, rej);
      });
    } catch {
      return decodeWithMediabunny(b);
    }
  })();
  audioBuffers.set(id, p);
  return p;
}

async function decodeWithMediabunny(b: Blob): Promise<AudioBuffer | null> {
  try {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(b) });
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return null;
    const sink = new AudioBufferSink(track);
    const parts: AudioBuffer[] = [];
    for await (const w of sink.buffers()) parts.push(w.buffer);
    if (!parts.length) return null;
    const sr = parts[0].sampleRate, ch = parts[0].numberOfChannels;
    const len = parts.reduce((a, p) => a + p.length, 0);
    const out = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: ch });
    let off = 0;
    for (const p of parts) {
      for (let c = 0; c < ch; c++) out.getChannelData(c).set(p.getChannelData(Math.min(c, p.numberOfChannels - 1)), off);
      off += p.length;
    }
    return out;
  } catch { return null; }
}

export function peaks(buf: AudioBuffer, count: number): number[] {
  const data = buf.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / count));
  const out: number[] = [];
  let max = 0;
  for (let i = 0; i < count; i++) {
    let m = 0;
    const s = i * step, e = Math.min(data.length, s + step);
    for (let j = s; j < e; j += 16) { const v = Math.abs(data[j]); if (v > m) m = v; }
    out.push(m);
    if (m > max) max = m;
  }
  return out.map((v) => (max > 0 ? Math.round((v / max) * 100) / 100 : 0));
}

async function probeHasAudio(b: Blob): Promise<boolean> {
  try {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(b) });
    const t = await input.getPrimaryAudioTrack();
    return !!t;
  } catch { return true; }
}

export interface ImportProgress { (msg: string): void }

// ------------------------------------------------------------------ fast import
const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;
const persisted = new Map<string, Promise<void>>();
export const persistPending = () => Promise.all(persisted.values());

/** First frame thumbnail with a single seek (fast). */
async function posterFrame(v: HTMLVideoElement, duration: number): Promise<string | undefined> {
  await seek(v, Math.min(0.1, duration / 3));
  try {
    const c = document.createElement('canvas');
    c.height = 96; c.width = Math.max(1, Math.round((v.videoWidth / Math.max(1, v.videoHeight)) * 96));
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.6);
  } catch { return undefined; }
}

/** Filmstrip via WebCodecs: decodes only key frames (no long GOP decoding) → very fast. */
async function filmstripFast(blob: Blob, duration: number, count: number): Promise<string[] | null> {
  try {
    const { CanvasSink, EncodedPacketSink } = await import('mediabunny');
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) return null;
    const h = 96, w = Math.max(16, Math.round((track.displayWidth / Math.max(1, track.displayHeight)) * h));
    const packets = new EncodedPacketSink(track);
    const sink = new CanvasSink(track, { width: w, height: h, fit: 'fill', poolSize: 1 });
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    const out: string[] = [];
    const cache = new Map<number, string>();
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.1 : (duration * (i + 0.5)) / count;
      const key = await packets.getKeyPacket(t, { metadataOnly: true } as never);
      const ts = key ? key.timestamp : t;
      let url = cache.get(ts);
      if (!url) {
        const wc = await sink.getCanvas(ts);
        if (!wc) continue;
        ctx.drawImage(wc.canvas as CanvasImageSource, 0, 0, w, h);
        url = c.toDataURL('image/jpeg', 0.6);
        cache.set(ts, url);
      }
      out.push(url);
    }
    input.dispose?.();
    return out.length ? out : null;
  } catch { return null; }
}

/** Waveform peaks streamed through WebCodecs (no full decode kept in memory). */
async function waveformFast(blob: Blob, duration: number): Promise<number[] | null> {
  try {
    const { AudioBufferSink } = await import('mediabunny');
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return null;
    const bins = Math.min(2000, Math.max(100, Math.round(duration * 20)));
    const acc = new Float32Array(bins);
    const sink = new AudioBufferSink(track);
    for await (const wb of sink.buffers()) {
      const d = wb.buffer.getChannelData(0), sr = wb.buffer.sampleRate;
      for (let i = 0; i < d.length; i += 32) {
        const bi = Math.min(bins - 1, Math.floor(((wb.timestamp + i / sr) / Math.max(0.01, duration)) * bins));
        const v = Math.abs(d[i]);
        if (v > acc[bi]) acc[bi] = v;
      }
    }
    input.dispose?.();
    let max = 0; for (const v of acc) max = Math.max(max, v);
    return Array.from(acc, (v) => (max > 0 ? Math.round((v / max) * 100) / 100 : 0));
  } catch { return null; }
}

/**
 * Fast import: returns as soon as duration/size are known (≈0.1–0.5 s) so the clip appears on the timeline
 * immediately. Thumbnails, waveform and storage are completed in the background via `onEnrich`.
 */
export async function importFileFast(file: File, existing: MediaAsset[], onEnrich: (id: string, patch: Partial<MediaAsset>) => void): Promise<MediaAsset> {
  const kind = kindOf(file);
  if (!kind) throw new Error(`Tipo de arquivo não suportado: ${file.name}`);
  // same file picked again → reuse instantly
  const key = fileKey(file);
  const dup = existing.find((m) => (m as MediaAsset & { key?: string }).key === key);
  if (dup && blobs.has(dup.id)) return dup;
  const id = uid('m');
  blobs.set(id, file);
  const url = urlOf(id)!;
  const asset: MediaAsset & { key?: string } = { id, key, name: file.name || kind, kind, mime: file.type, size: file.size, duration: 0, width: 0, height: 0, hasAudio: false };
  if (kind === 'video') {
    const [meta, hasAudio] = await Promise.all([loadVideoMeta(url), probeHasAudio(file)]);
    asset.duration = meta.duration; asset.width = meta.width; asset.height = meta.height; asset.hasAudio = hasAudio;
    asset.thumb = await posterFrame(meta.el, meta.duration);
    asset.thumbs = asset.thumb ? [asset.thumb] : [];
    // background enrichment
    void (async () => {
      const n = Math.min(14, Math.max(3, Math.ceil(meta.duration / 2)));
      let strip = await filmstripFast(file, meta.duration, n);
      if (!strip) strip = await filmstrip(meta.el, meta.duration, n);
      meta.el.removeAttribute('src'); meta.el.load();
      if (strip?.length) onEnrich(id, { thumbs: strip, thumb: strip[0] });
      if (hasAudio) {
        const wf = await waveformFast(file, meta.duration);
        if (wf) onEnrich(id, { waveform: wf });
      }
    })();
  } else if (kind === 'image') {
    const img = await loadImage(id);
    asset.width = (img as ImageBitmap).width || (img as HTMLImageElement).naturalWidth;
    asset.height = (img as ImageBitmap).height || (img as HTMLImageElement).naturalHeight;
    const c = document.createElement('canvas');
    c.height = 96; c.width = Math.max(1, Math.round((asset.width / Math.max(1, asset.height)) * 96));
    c.getContext('2d')!.drawImage(img as CanvasImageSource, 0, 0, c.width, c.height);
    asset.thumb = c.toDataURL('image/jpeg', 0.7);
    asset.thumbs = [asset.thumb];
  } else {
    asset.duration = await loadAudioMeta(url);
    asset.hasAudio = true;
    void (async () => {
      const wf = (await waveformFast(file, asset.duration)) ?? await (async () => { const b = await decodeAudio(id); return b ? peaks(b, Math.min(2000, Math.max(100, Math.round(b.duration * 20)))) : null; })();
      if (wf) onEnrich(id, { waveform: wf });
    })();
  }
  // persist the original file to on-device storage in the background
  persisted.set(id, db.putMedia(id, file).then(() => { persisted.delete(id); }).catch(() => { persisted.delete(id); }));
  return asset;
}

export async function importFile(file: File, onProgress?: ImportProgress): Promise<MediaAsset> {
  const kind = kindOf(file);
  if (!kind) throw new Error(`Tipo de arquivo não suportado: ${file.name}`);
  const id = uid('m');
  blobs.set(id, file);
  const url = urlOf(id)!;
  const asset: MediaAsset = { id, name: file.name || kind, kind, mime: file.type, size: file.size, duration: 0, width: 0, height: 0, hasAudio: false };
  onProgress?.(`Lendo ${asset.name}…`);
  if (kind === 'video') {
    const meta = await loadVideoMeta(url);
    asset.duration = meta.duration;
    asset.width = meta.width;
    asset.height = meta.height;
    asset.hasAudio = await probeHasAudio(file);
    const n = Math.min(14, Math.max(3, Math.ceil(meta.duration / 2)));
    asset.thumbs = (await filmstripFast(file, meta.duration, n)) ?? await filmstrip(meta.el, meta.duration, n);
    asset.thumb = asset.thumbs[0];
    meta.el.removeAttribute('src');
    meta.el.load();
  } else if (kind === 'image') {
    const img = await loadImage(id);
    asset.width = (img as ImageBitmap).width || (img as HTMLImageElement).naturalWidth;
    asset.height = (img as ImageBitmap).height || (img as HTMLImageElement).naturalHeight;
    const c = document.createElement('canvas');
    c.height = 96; c.width = Math.max(1, Math.round((asset.width / Math.max(1, asset.height)) * 96));
    c.getContext('2d')!.drawImage(img as CanvasImageSource, 0, 0, c.width, c.height);
    asset.thumb = c.toDataURL('image/jpeg', 0.7);
    asset.thumbs = [asset.thumb];
  } else {
    asset.duration = await loadAudioMeta(url);
    asset.hasAudio = true;
  }
  await db.putMedia(id, file);
  if (asset.hasAudio && file.size < 400 * 1024 * 1024) {
    try {
      const wf = await waveformFast(file, asset.duration);
      if (wf) asset.waveform = wf;
      else {
        const buf = await decodeAudio(id);
        if (buf) {
          asset.waveform = peaks(buf, Math.min(2000, Math.max(100, Math.round(buf.duration * 20))));
          if (kind === 'audio' && !asset.duration) asset.duration = buf.duration;
        }
      }
    } catch { /* ignore */ }
  }
  return asset;
}

/** Store a generated blob (e.g. recording, freeze frame) as a media asset */
export async function importBlob(blob: Blob, name: string, onProgress?: ImportProgress): Promise<MediaAsset> {
  const file = new File([blob], name, { type: blob.type });
  return importFile(file, onProgress);
}

export function loadImage(id: string): Promise<ImageBitmap | HTMLImageElement> {
  let p = images.get(id);
  if (p) return p;
  p = (async () => {
    const b = await ensureBlob(id);
    if (!b) throw new Error('imagem ausente');
    try {
      if (typeof createImageBitmap === 'function' && !b.type.includes('svg')) {
        const bmp = await createImageBitmap(b, { imageOrientation: 'from-image' } as ImageBitmapOptions);
        imageReady.set(id, bmp);
        return bmp;
      }
    } catch { /* fall back */ }
    const img = new Image();
    img.decoding = 'async';
    img.src = urlOf(id)!;
    await img.decode();
    imageReady.set(id, img);
    return img;
  })();
  images.set(id, p);
  p.catch(() => images.delete(id));
  return p;
}

export const imageIfReady = (id: string) => imageReady.get(id) ?? null;

export function forgetMedia(id: string) {
  const u = urls.get(id);
  if (u) URL.revokeObjectURL(u);
  urls.delete(id);
  blobs.delete(id);
  images.delete(id);
  imageReady.delete(id);
  audioBuffers.delete(id);
}
