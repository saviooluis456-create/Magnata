import { useEffect, useRef, useState } from 'react';
import { FPS_OPTIONS, QUALITY_OPTIONS, RESOLUTIONS, captionsToSrt, estimateBitrate, exportAudioWav, exportDims, exportVideo, supportedCodecs, type ExportProgress, type ExportResult } from '../../engine/exporter';
import { formatTime, projectDuration } from '../../model/timeline';
import type { ExportSettings } from '../../model/types';
import { useEditor } from '../../store/editor';
import { canShareFiles, downloadBlob, isIOS, saveToGallery, session, shareBlob } from '../actions';
import { Chips, Section, Toggle } from '../components/ui';
import { handoff } from '../../central/videoMeta';

const KEY = 'magnata.export';
function loadSettings(): ExportSettings {
  const d: ExportSettings = { resolution: 1080, fps: 30, quality: 'high', videoCodec: 'avc', container: 'mp4', audioBitrate: 192000, includeAudio: true, range: 'all', loudness: -14 };
  let r = d;
  try { r = { ...d, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { /* */ }
  // the iPhone gallery can't import WebM/VP9/AV1 → force a Photos-compatible combo
  if (isIOS()) { if (r.container === 'webm') r.container = 'mp4'; if (r.videoCodec === 'vp9' || r.videoCodec === 'av1') r.videoCodec = 'avc'; }
  return r;
}

export function ExportPanel() {
  const project = useEditor((s) => s.project!);
  const [s, setS] = useState<ExportSettings>(loadSettings);
  const [codecs, setCodecs] = useState<Record<string, boolean> | null>(null);
  const [prog, setProg] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const dur = projectDuration(project);
  const { w, h } = exportDims(project, s.resolution);
  const bitrate = estimateBitrate(s, w, h);
  const sizeMb = ((bitrate + (s.includeAudio ? s.audioBitrate : 0)) * dur) / 8 / 1e6;

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* */ } }, [s]);
  useEffect(() => { supportedCodecs(w, h, s.fps).then(setCodecs); }, [w, h, s.fps]);
  useEffect(() => () => { abort.current?.abort(); }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const set = <K extends keyof ExportSettings>(k: K, v: ExportSettings[K]) => setS((x) => ({ ...x, [k]: v }));

  const start = async () => {
    const st = useEditor.getState();
    st.setPlaying(false);
    setResult(null);
    if (url) { URL.revokeObjectURL(url); setUrl(null); }
    abort.current = new AbortController();
    setProg({ phase: 'Iniciando…', progress: 0 });
    // keep screen awake during export where supported
    let lock: { release(): Promise<void> } | null = null;
    try { lock = await (navigator as Navigator & { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen') ?? null; } catch { /* */ }
    try {
      const res = await exportVideo(st.project!, s, setProg, abort.current.signal);
      setResult(res);
      setUrl(URL.createObjectURL(res.blob));
      res.warnings.forEach((w) => st.notify(w));
      st.notify(`Vídeo pronto · ${(res.blob.size / 1e6).toFixed(1)} MB`, 'ok');
    } catch (e) {
      const msg = (e as Error).message;
      if (!/cancel/i.test(msg)) st.notify('Erro na exportação: ' + msg, 'error');
    } finally {
      setProg(null);
      lock?.release().catch(() => {});
    }
  };

  const frame = async () => {
    const p = session.player;
    if (!p) return;
    const b = await p.snapshot('image/png');
    await saveToGallery(b, `${project.name}_quadro.png`);
  };

  const audio = async () => {
    const st = useEditor.getState();
    st.setBusy({ msg: 'Renderizando áudio…' });
    try {
      const b = await exportAudioWav(project);
      if (b) downloadBlob(b, `${project.name}.wav`); else st.notify('O projeto não tem áudio', 'error');
    } finally { st.setBusy(null); }
  };

  if (prog) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }} data-testid="export-progress">
        <div className="spinner" />
        <b>{prog.phase}</b>
        <div className="progress" style={{ margin: '14px 0' }}><i style={{ width: `${Math.round(prog.progress * 100)}%` }} /></div>
        <div className="hint">{Math.round(prog.progress * 100)}%{prog.fps ? ` · ${prog.fps.toFixed(1)} quadros/s` : ''}{prog.eta !== undefined && isFinite(prog.eta) ? ` · restam ~${formatTime(prog.eta, false)}` : ''}</div>
        <button className="btn danger" onClick={() => abort.current?.abort()}>Cancelar</button>
        <p className="hint">Mantenha o app aberto durante a exportação.</p>
      </div>
    );
  }

  if (result && url) {
    return (
      <div data-testid="export-done">
        <video className="result-video" src={url} controls playsInline />
        <p className="hint">{result.filename} · {(result.blob.size / 1e6).toFixed(1)} MB</p>
        <button className="btn primary block" style={{ padding: 16, fontSize: 16 }} data-testid="save-gallery"
          onClick={async () => { const r = await saveToGallery(result.blob, result.filename); if (r === 'downloaded') useEditor.getState().notify('Vídeo baixado — abra a pasta Downloads/Arquivos para salvá-lo na galeria'); }}>
          📲 Salvar na galeria
        </button>
        <p className="hint" style={{ textAlign: 'center' }}>{isIOS() ? 'No menu que abrir, toque em “Salvar vídeo” — ele vai direto para o app Fotos.' : canShareFiles() ? 'No menu que abrir, escolha Galeria/Fotos ou o app para postar.' : 'O vídeo será baixado para a pasta de downloads.'}</p>
        <div className="row">
          <button className="btn" onClick={async () => { if (!(await shareBlob(result.blob, result.filename))) downloadBlob(result.blob, result.filename); }}>Compartilhar</button>
          <button className="btn" onClick={() => downloadBlob(result.blob, result.filename)} data-testid="download">Baixar arquivo</button>
        </div>
        <button className="btn block central-entry" style={{ marginTop: 10 }} data-testid="publish-central"
          onClick={() => { handoff.video = { blob: result.blob, name: result.filename }; location.hash = 'central'; }}>
          🎬 Publicar na Central (Instagram, TikTok, YouTube)
        </button>
        <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => { setResult(null); URL.revokeObjectURL(url); setUrl(null); }}>Exportar novamente</button>
      </div>
    );
  }

  const codecOpts: { v: ExportSettings['videoCodec']; label: string; hint: string }[] = [
    { v: 'avc', label: 'H.264', hint: 'Compatível' }, { v: 'hevc', label: 'HEVC', hint: 'Menor arquivo' },
    { v: 'vp9', label: 'VP9', hint: 'Web' }, { v: 'av1', label: 'AV1', hint: 'Máxima eficiência' },
  ];

  return (
    <>
      <Section title="Resolução">
        <Chips options={RESOLUTIONS.map((r) => ({ v: r.v, label: r.label, hint: r.hint }))} value={s.resolution} onChange={(v) => set('resolution', v)} />
      </Section>
      <Section title="Taxa de quadros">
        <Chips options={FPS_OPTIONS.map((v) => ({ v, label: `${v}`, hint: 'fps' }))} value={s.fps} onChange={(v) => set('fps', v)} />
      </Section>
      <Section title="Qualidade (taxa de bits)">
        <Chips options={QUALITY_OPTIONS.map((q) => ({ v: q.v, label: q.label }))} value={s.quality} onChange={(v) => set('quality', v)} />
      </Section>
      <Section title="Codec">
        <Chips options={codecOpts.map((c) => ({ ...c, disabled: codecs ? codecs[c.v] === false : false }))} value={s.videoCodec} onChange={(v) => set('videoCodec', v)} />
      </Section>
      <Section title="Formato">
        <Chips options={[{ v: 'mp4', label: 'MP4', hint: 'Recomendado' }, { v: 'mov', label: 'MOV', hint: 'iPhone' }, { v: 'webm', label: 'WebM', hint: isIOS() ? 'Não vai p/ Fotos' : 'Web', disabled: isIOS() }]} value={s.container} onChange={(v) => set('container', v as ExportSettings['container'])} />
      </Section>
      <Toggle label="Incluir áudio" value={s.includeAudio} onChange={(v) => set('includeAudio', v)} />
      {s.includeAudio && (
        <Toggle label="Volume padrão das redes (−14 LUFS)" hint="Deixa o áudio no mesmo volume do TikTok, Reels e YouTube, sem distorcer" value={!!s.loudness} onChange={(v) => set('loudness', v ? -14 : null)} />
      )}
      {s.includeAudio && (
        <Chips options={[128000, 192000, 256000, 320000].map((v) => ({ v, label: `${v / 1000} kbps` }))} value={s.audioBitrate} onChange={(v) => set('audioBitrate', v)} />
      )}
      <div className="hint" style={{ margin: '12px 0' }}>
        {w}×{h} · {(bitrate / 1e6).toFixed(1)} Mbps · duração {formatTime(dur, false)} · tamanho estimado ~{sizeMb < 1 ? sizeMb.toFixed(2) : sizeMb.toFixed(0)} MB
      </div>
      <button className="btn primary block" style={{ padding: 16, fontSize: 16 }} onClick={start} disabled={dur <= 0} data-testid="start-export">Exportar vídeo</button>
      <Section title="Outros formatos">
        <div className="row">
          <button className="btn small" onClick={frame}>Quadro atual (PNG)</button>
          <button className="btn small" onClick={audio}>Só áudio (WAV)</button>
          <button className="btn small" disabled={!project.captions.words.length} onClick={() => downloadBlob(new Blob([captionsToSrt(project)], { type: 'text/plain' }), `${project.name}.srt`)}>Legendas (SRT)</button>
        </div>
      </Section>
    </>
  );
}
