import { audioBufferToWav } from '../engine/audioMix';
import { importBlob, importFile, kindOf } from '../engine/media';
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
  const assets = [];
  const errors: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!kindOf(f)) { errors.push(`${f.name}: formato não suportado`); continue; }
    try {
      st.setBusy({ msg: `Importando ${i + 1}/${files.length}…`, progress: i / files.length });
      assets.push(await importFile(f, (m) => st.setBusy({ msg: m, progress: i / files.length })));
    } catch (e) {
      errors.push(`${f.name}: ${(e as Error).message}`);
    }
  }
  st.setBusy(null);
  if (assets.length) st.addMedia(assets, target);
  if (errors.length) st.notify(errors.join(' · '), 'error');
  else if (assets.length) st.notify(`${assets.length} ${assets.length > 1 ? 'arquivos importados' : 'arquivo importado'}`, 'ok');
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

export async function shareBlob(blob: Blob, filename: string): Promise<boolean> {
  try {
    const file = new File([blob], filename, { type: blob.type });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: filename });
      return true;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return true;
  }
  return false;
}
