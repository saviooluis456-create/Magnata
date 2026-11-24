import { audioBufferToWav } from '../engine/audioMix';
import { importBlob, importFileFast, kindOf } from '../engine/media';
import type { MediaAsset } from '../model/types';
import type { Player } from '../engine/player';
import { clipEnd, mainClips } from '../model/timeline';
import { useEditor } from '../store/editor';

export const session: { player: Player | null } = { player: null };
if (typeof window !== 'undefined') (window as unknown as { __session: typeof session }).__session = session;

export function pickFiles(accept: string, multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    document.body.appendChild(input);
    let done = false;
    const finish = (files: File[]) => { if (done) return; done = true; input.remove(); resolve(files); };
    input.onchange = () => finish(Array.from(input.files ?? []));
    // resolve empty when the picker is cancelled (focus returns)
    window.addEventListener('focus', () => setTimeout(() => finish(Array.from(input.files ?? [])), 1500), { once: true });
    input.click();
  });
}

export async function importFiles(files: File[], target: 'main' | 'overlay' | 'audio') {
  const st = useEditor.getState();
  if (!files.length) return;
  const errors: string[] = [];
  const valid = files.filter((f) => { if (kindOf(f)) return true; errors.push(`${f.name}: formato não suportado`); return false; });
  if (valid.length > 1 || valid.some((f) => f.size > 20e6)) st.setBusy({ msg: valid.length > 1 ? `Adicionando ${valid.length} arquivos…` : 'Adicionando…' });
  const existing = st.project?.media ?? [];
  const onEnrich = (id: string, patch: Partial<MediaAsset>) => useEditor.getState().patchMedia(id, patch);
  // read metadata of several files in parallel (keeps the original order)
  const results: (MediaAsset | null)[] = new Array(valid.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < valid.length) {
      const i = next++;
      try { results[i] = await importFileFast(valid[i], existing, onEnrich); }
      catch (e) { errors.push(`${valid[i].name}: ${(e as Error).message}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, valid.length) }, worker));
  st.setBusy(null);
  const assets = results.filter(Boolean) as MediaAsset[];
  if (assets.length) st.addMedia(assets, target);
  if (errors.length) st.notify(errors.join(' · '), 'error');
  else if (assets.length) st.notify(`${assets.length} ${assets.length > 1 ? 'arquivos adicionados' : 'arquivo adicionado'}`, 'ok');
}

export async function importGenerated(blob: Blob, name: string, target: 'main' | 'overlay' | 'audio') {
  const st = useEditor.getState();
  try {
    st.setBusy({ msg: 'Processando…' });
    const a = await importBlob(blob, name);
    st.addMedia([a], target);
  } catch (e) {
    st.notify((e as Error).message, 'error');
  } finally {
    st.setBusy(null);
  }
}

/** Encodes a rendered AudioBuffer and places it on a free audio track at `start` seconds. */
export async function addAudioBuffer(buf: AudioBuffer, name: string, start = 0, volume = 1): Promise<string | null> {
  const st = useEditor.getState();
  const a = await importBlob(audioBufferToWav(buf), `${name}.wav`);
  a.name = name;
  const prev = st.time;
  useEditor.setState({ time: start });
  st.addMedia([a], 'audio');
  const id = useEditor.getState().selectedId;
  if (id && volume !== 1) st.updateClip(id, (c) => { c.audio.volume = volume; });
  useEditor.setState({ time: prev });
  return id;
}

/** Clip to operate on: the selection, or the main clip under the playhead. */
export function targetClipId(): string | null {
  const s = useEditor.getState();
  if (s.selectedId) return s.selectedId;
  const p = s.project;
  if (!p) return null;
  const c = mainClips(p).find((x) => s.time >= x.start && s.time < clipEnd(x)) ?? mainClips(p)[0];
  return c?.id ?? null;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const isIOS = () => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const canShareFiles = () => {
  try { return !!(navigator as Navigator & { canShare?: (d: ShareData) => boolean }).canShare?.({ files: [new File([new Blob(['x'], { type: 'video/mp4' })], 'x.mp4', { type: 'video/mp4' })] }); } catch { return false; }
};

/** Save to the phone gallery (share sheet → "Salvar vídeo") or download as a fallback. */
export async function saveToGallery(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  if (await shareBlob(blob, filename)) return 'shared';
  downloadBlob(blob, filename);
  return 'downloaded';
}

export async function shareBlob(blob: Blob, filename: string): Promise<boolean> {
  try {
    const type = blob.type || (filename.endsWith('.mov') ? 'video/quicktime' : filename.endsWith('.webm') ? 'video/webm' : filename.endsWith('.png') ? 'image/png' : 'video/mp4');
    const file = new File([blob], filename, { type });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    // share only the file: on iOS this shows "Salvar vídeo/Salvar imagem", which saves straight to the Photos gallery
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file] });
      return true;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return true;
  }
  return false;
}
