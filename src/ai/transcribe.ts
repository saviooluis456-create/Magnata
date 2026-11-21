import { uid } from '../model/defaults';
import { projectDuration } from '../model/timeline';
import type { CaptionWord, Project } from '../model/types';
import { renderMix } from '../engine/audioMix';
import { emojiFor } from '../engine/keywords';

export const WHISPER_MODELS = [
  { id: 'onnx-community/whisper-tiny_timestamped', name: 'Rápido (tiny)', size: '~45 MB' },
  { id: 'onnx-community/whisper-base_timestamped', name: 'Equilibrado (base)', size: '~80 MB' },
  { id: 'Xenova/whisper-small', name: 'Preciso (small)', size: '~250 MB' },
];

export const LANGUAGES = [
  { id: 'portuguese', name: 'Português' }, { id: 'english', name: 'English' }, { id: 'spanish', name: 'Español' },
  { id: 'french', name: 'Français' }, { id: 'german', name: 'Deutsch' }, { id: 'italian', name: 'Italiano' },
  { id: 'japanese', name: '日本語' }, { id: 'korean', name: '한국어' }, { id: 'chinese', name: '中文' }, { id: '', name: 'Detectar automaticamente' },
];

export interface TranscribeEvents { onStatus(msg: string, progress?: number): void }

async function projectAudio16k(p: Project): Promise<Float32Array> {
  const buf = await renderMix(p, 0, projectDuration(p), 16000);
  if (!buf) throw new Error('Não há áudio na linha do tempo para transcrever');
  const a = buf.getChannelData(0), b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : a;
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) * 0.5;
  return out;
}

/** Transcribes the project's audio mix into word-timed captions (timeline time). */
export async function transcribeProject(p: Project, model: string, language: string, ev: TranscribeEvents, signal?: AbortSignal): Promise<CaptionWord[]> {
  ev.onStatus('Preparando áudio…', 0);
  const audio = await projectAudio16k(p);
  const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
  try {
    const res = await new Promise<{ chunks: { text: string; timestamp: [number, number | null] }[]; wordLevel: boolean }>((resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new Error('Cancelado')));
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'status') ev.onStatus(m.msg);
        else if (m.type === 'download') ev.onStatus('Baixando modelo…', m.progress);
        else if (m.type === 'done') resolve(m);
        else if (m.type === 'error') reject(new Error(m.msg));
      };
      worker.onerror = (e) => reject(new Error(e.message || 'Falha no módulo de IA'));
      worker.postMessage({ audio, model, language: language || null }, [audio.buffer]);
    });
    const dur = projectDuration(p);
    const words: CaptionWord[] = [];
    for (const ch of res.chunks) {
      const s = ch.timestamp[0] ?? 0;
      const e = ch.timestamp[1] ?? Math.min(dur, s + 1);
      const parts = ch.text.trim().split(/\s+/).filter(Boolean);
      if (!parts.length) continue;
      if (res.wordLevel && parts.length === 1) {
        words.push({ id: uid('w'), text: parts[0], start: s, end: Math.max(e, s + 0.08) });
      } else {
        // distribute proportionally to word length
        const total = parts.reduce((a, w) => a + w.length + 1, 0);
        let t = s;
        for (const w of parts) {
          const d = ((e - s) * (w.length + 1)) / total;
          words.push({ id: uid('w'), text: w, start: t, end: t + d });
          t += d;
        }
      }
    }
    return finalizeWords(words);
  } finally {
    worker.terminate();
  }
}

export function finalizeWords(words: CaptionWord[]): CaptionWord[] {
  const out = words.filter((w) => w.text.trim()).sort((a, b) => a.start - b.start);
  for (let i = 0; i < out.length; i++) {
    const w = out[i];
    if (w.end <= w.start) w.end = w.start + 0.1;
    const next = out[i + 1];
    if (next && w.end > next.start) w.end = Math.max(w.start + 0.05, next.start);
    if (!w.emoji) { const e = emojiFor(w.text); if (e) w.emoji = e; }
  }
  return out;
}

/** Turns a script into timed words, aligned to detected speech regions (offline fallback; no AI download). */
export async function alignScript(p: Project, script: string): Promise<CaptionWord[]> {
  const parts = script.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  const dur = projectDuration(p);
  let regions: [number, number][] = [[0, dur]];
  try {
    const buf = await renderMix(p, 0, dur, 16000);
    if (buf) {
      const { speechRegions } = await import('./analysis');
      const r = speechRegions(buf);
      if (r.length) regions = r;
    }
  } catch { /* ignore */ }
  const totalSpeech = regions.reduce((a, [s, e]) => a + (e - s), 0);
  const totalChars = parts.reduce((a, w) => a + w.length + 1, 0);
  const words: CaptionWord[] = [];
  let ri = 0, rt = regions[0][0];
  for (const w of parts) {
    let d = (totalSpeech * (w.length + 1)) / totalChars;
    while (ri < regions.length && d > 0) {
      const [, re] = regions[ri];
      const avail = re - rt;
      if (avail >= d - 1e-6) {
        words.push({ id: uid('w'), text: w, start: rt, end: rt + d });
        rt += d; d = 0;
      } else {
        ri++;
        if (ri < regions.length) rt = regions[ri][0];
        else { words.push({ id: uid('w'), text: w, start: rt, end: rt + d }); d = 0; }
      }
    }
  }
  return finalizeWords(words);
}

/** Parse SRT/VTT into words (timing interpolated within each cue) */
export function parseSubtitles(text: string): CaptionWord[] {
  const toSec = (s: string) => {
    const m = s.trim().replace(',', '.').split(':').map(Number);
    return m.length === 3 ? m[0] * 3600 + m[1] * 60 + m[2] : m.length === 2 ? m[0] * 60 + m[1] : m[0];
  };
  const words: CaptionWord[] = [];
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
  for (const b of blocks) {
    const lines = b.split('\n').filter((l) => l.trim());
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti < 0) continue;
    const [a, z] = lines[ti].split('-->');
    const s = toSec(a), e = toSec(z.split(' ')[1] ? z.trim().split(' ')[0] : z);
    const txt = lines.slice(ti + 1).join(' ').replace(/<[^>]+>/g, '');
    const parts = txt.split(/\s+/).filter(Boolean);
    const total = parts.reduce((acc, w) => acc + w.length + 1, 0);
    let t = s;
    for (const w of parts) { const d = ((e - s) * (w.length + 1)) / total; words.push({ id: uid('w'), text: w, start: t, end: t + d }); t += d; }
  }
  return finalizeWords(words);
}
