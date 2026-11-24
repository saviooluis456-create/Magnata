import { useState } from 'react';
import { buildPages } from '../../engine/textRender';
import { emphasisOf } from '../../engine/keywords';
import { decodeAudio } from '../../engine/media';
import { uid } from '../../model/defaults';
import { clipEnd, clipsOnTrack, mainClips, mediaById, maxClipDuration } from '../../model/timeline';
import type { Clip } from '../../model/types';
import { useEditor } from '../../store/editor';
import { Chips, Grid, Section, Slider, Tile } from '../components/ui';
import { targetClipId } from '../actions';

type Tool = null | 'silence' | 'scenes' | 'beats';

export function AIPanel() {
  const [tool, setTool] = useState<Tool>(null);
  const st = useEditor.getState;
  const project = useEditor((s) => s.project!);

  const enhanceAll = async () => {
    const s = st();
    const { autoEnhance } = await import('../../ai/analysis');
    const clips = s.project!.clips.filter((c) => (c.kind === 'video' || c.kind === 'image') && c.mediaId);
    if (!clips.length) { s.notify('Sem clipes de vídeo/foto', 'error'); return; }
    const results = new Map<string, Awaited<ReturnType<typeof autoEnhance>>>();
    try {
      for (let i = 0; i < clips.length; i++) {
        const c = clips[i];
        s.setBusy({ msg: `Analisando clipe ${i + 1}/${clips.length}…`, progress: i / clips.length });
        const m = mediaById(s.project!, c.mediaId)!;
        results.set(c.id, await autoEnhance(m.id, m.kind as 'video' | 'image', c.in, c.in + c.duration * c.speed));
      }
      s.edit((p) => { p.clips.forEach((c) => { const r = results.get(c.id); if (r) c.adjust = { ...c.adjust, ...r }; }); });
      s.notify('Cores e exposição corrigidas em todos os clipes ✨', 'ok');
    } catch (e) { s.notify((e as Error).message, 'error'); }
    finally { s.setBusy(null); }
  };

  const voiceAll = () => {
    st().edit((p) => { p.clips.forEach((c) => { if (c.kind === 'video' || c.kind === 'audio') { c.audio.enhance = true; c.audio.denoise = true; } }); });
    st().notify('Voz aprimorada e ruído reduzido em todos os clipes', 'ok');
  };

  const bgRemove = () => {
    const id = targetClipId();
    if (!id) { st().notify('Adicione um clipe', 'error'); return; }
    st().updateClip(id, (c) => { c.bgRemove = !c.bgRemove; });
    const c = st().project!.clips.find((x) => x.id === id);
    st().notify(c?.bgRemove ? 'Removendo fundo com IA (carregando modelo)…' : 'Fundo restaurado', 'ok');
  };

  const smartZoom = () => {
    const s = st();
    const p = s.project!;
    const words = p.captions.words;
    s.edit((d) => {
      const mains = mainClips(d).filter((c) => c.kind === 'video' || c.kind === 'image');
      if (!mains.length) return;
      // zoom cut points: caption pages (if any) else every ~2.5s
      const points: { t: number; strong: boolean }[] = [];
      if (words.length) {
        buildPages(words, Math.max(2, d.captions.style.wordsPerPage)).forEach((pg) => points.push({ t: pg.start, strong: pg.words.some((w) => emphasisOf(w.text) > 0 || w.highlight) }));
      } else {
        const end = clipEnd(mains[mains.length - 1]);
        for (let t = 0; t < end; t += 2.5) points.push({ t, strong: false });
      }
      for (const c of mains) {
        const kf: Clip['keyframes']['scale'] = [];
        let zoomed = false;
        for (const pt of points) {
          if (pt.t < c.start - 0.01 || pt.t >= clipEnd(c)) continue;
          zoomed = pt.strong ? true : !zoomed;
          kf.push({ t: Math.max(0, pt.t - c.start), v: zoomed ? (pt.strong ? 1.28 : 1.14) * c.transform.scale : c.transform.scale, ease: 'hold' });
        }
        if (kf.length) c.keyframes.scale = kf;
      }
    });
    s.notify('Zoom inteligente aplicado (cortes de zoom no ritmo da fala)', 'ok');
  };

  const reframe = () => {
    st().edit((p) => { mainClips(p).forEach((c) => { if (c.kind === 'video' || c.kind === 'image') c.fit = 'cover'; }); });
    st().notify('Clipes reenquadrados para preencher o formato', 'ok');
  };

  if (tool === 'silence') return <SilenceTool onBack={() => setTool(null)} />;
  if (tool === 'scenes') return <ScenesTool onBack={() => setTool(null)} />;
  if (tool === 'beats') return <BeatsTool onBack={() => setTool(null)} />;

  return (
    <>
      <Grid cols={3}>
        <Tile label="Trilha sonora automática" icon="🎵" onClick={() => st().openPanel('soundtrack')} badge="Novo" />
        <Tile label="Correção de câmera" icon="🎥" onClick={() => st().openPanel('color')} badge="Novo" />
        <Tile label="Legendas automáticas" icon="💬" onClick={() => st().openPanel('captions')} badge="IA" />
        <Tile label="Remover silêncios" icon="✂️" onClick={() => setTool('silence')} badge="IA" />
        <Tile label="Remover fundo" icon="🧍" onClick={bgRemove} badge="IA" />
        <Tile label="Zoom inteligente" icon="🔍" onClick={smartZoom} badge="IA" />
        <Tile label="Cortar por cenas" icon="🎞" onClick={() => setTool('scenes')} />
        <Tile label="Sincronizar batidas" icon="🥁" onClick={() => setTool('beats')} />
        <Tile label="Auto-aprimorar cor" icon="🎨" onClick={enhanceAll} />
        <Tile label="Melhorar voz" icon="🎙" onClick={voiceAll} />
        <Tile label="Reenquadrar" icon="📐" onClick={reframe} />
      </Grid>
      <p className="hint">Todo processamento roda no seu aparelho. Legendas e Remover fundo baixam modelos de IA uma única vez.</p>
      {project.markers.length > 0 && (
        <button className="btn small ghost" onClick={() => st().edit((p) => { p.markers = []; })}>Limpar marcadores de batida ({project.markers.length})</button>
      )}
    </>
  );
}

function pickAudioClip(): Clip | null {
  const s = useEditor.getState();
  const p = s.project!;
  const id = targetClipId();
  const c = p.clips.find((x) => x.id === id);
  if (c && (c.kind === 'video' || c.kind === 'audio') && mediaById(p, c.mediaId)?.hasAudio) return c;
  return null;
}

function SilenceTool({ onBack }: { onBack: () => void }) {
  const [thr, setThr] = useState(-38);
  const [minSil, setMinSil] = useState(0.5);
  const [scope, setScope] = useState<'clip' | 'main'>('main');
  const run = async () => {
    const s = useEditor.getState();
    const p = s.project!;
    const targets = scope === 'main' ? mainClips(p).filter((c) => c.kind === 'video' && mediaById(p, c.mediaId)?.hasAudio) : [pickAudioClip()].filter(Boolean) as Clip[];
    if (!targets.length) { s.notify('Nenhum clipe com áudio encontrado', 'error'); return; }
    const { silentRanges } = await import('../../ai/analysis');
    s.setBusy({ msg: 'Detectando silêncios…' });
    try {
      const plans = new Map<string, [number, number][]>();
      let removed = 0;
      for (const c of targets) {
        const buf = await decodeAudio(c.mediaId!);
        if (!buf) continue;
        const from = c.in, to = c.in + c.duration * c.speed;
        const sil = silentRanges(buf, from, to, { thresholdDb: thr, minSilence: minSil });
        if (!sil.length) continue;
        const keep: [number, number][] = [];
        let t = from;
        for (const [a, b] of sil) { if (a - t > 0.08) keep.push([t, a]); removed += (b - a) / c.speed; t = b; }
        if (to - t > 0.08) keep.push([t, to]);
        plans.set(c.id, keep);
      }
      if (!plans.size) { s.notify('Nenhum silêncio longo encontrado'); return; }
      s.edit((d) => {
        for (const [id, keep] of plans) {
          const c = d.clips.find((x) => x.id === id);
          if (!c) continue;
          const idx = d.clips.indexOf(c);
          d.clips.splice(idx, 1);
          let start = c.start;
          const shift = c.duration - keep.reduce((a, [x, y]) => a + (y - x) / c.speed, 0);
          keep.forEach(([a, b], i) => {
            const n: Clip = { ...structuredClone(c), id: i === 0 ? c.id : uid('c'), in: a, duration: (b - a) / c.speed, start: c.trackId === 'main' ? c.start + i * 0.0001 : start, transition: i === 0 ? c.transition : null, keyframes: {} };
            start += n.duration;
            d.clips.push(n);
          });
          if (c.trackId !== 'main') clipsOnTrack(d, c.trackId).forEach((o) => { if (o.start >= clipEnd(c) - 0.001) o.start = Math.max(0, o.start - shift); });
        }
        // captions follow edits poorly once removed: clear them to avoid desync
        if (d.captions.words.length) d.captions.words = [];
      });
      s.notify(`${removed.toFixed(1)}s de silêncio removidos ✂️${p.captions.words.length ? ' (gere as legendas novamente)' : ''}`, 'ok');
      onBack();
    } catch (e) { s.notify((e as Error).message, 'error'); }
    finally { s.setBusy(null); }
  };
  return (
    <>
      <button className="btn small ghost" onClick={onBack}>← Ferramentas</button>
      <Section title="Remover silêncios">
        <Chips options={[{ v: 'main', label: 'Toda a faixa principal' }, { v: 'clip', label: 'Clipe selecionado' }]} value={scope} onChange={(v) => setScope(v as 'clip' | 'main')} />
        <Slider label="Sensibilidade" value={-thr} min={20} max={60} step={1} format={(v) => (v < 32 ? 'Agressiva' : v < 44 ? 'Normal' : 'Suave')} onChange={(v) => setThr(-v)} />
        <Slider label="Silêncio mínimo" value={minSil} min={0.2} max={2} step={0.05} format={(v) => `${v.toFixed(2)}s`} onChange={setMinSil} />
        <button className="btn primary block" onClick={run}>✂️ Remover silêncios</button>
        <p className="hint">Ideal para vídeos falados: corta pausas automaticamente e mantém um pequeno respiro entre as frases. Você pode desfazer a qualquer momento.</p>
      </Section>
    </>
  );
}

function ScenesTool({ onBack }: { onBack: () => void }) {
  const [sens, setSens] = useState(0.5);
  const run = async () => {
    const s = useEditor.getState();
    const id = targetClipId();
    const c = s.project!.clips.find((x) => x.id === id);
    if (!c || c.kind !== 'video') { s.notify('Selecione um clipe de vídeo', 'error'); return; }
    const { detectScenes } = await import('../../ai/analysis');
    s.setBusy({ msg: 'Detectando cenas…', progress: 0 });
    try {
      const cuts = await detectScenes(c.mediaId!, c.in, c.in + c.duration * c.speed, (f) => s.setBusy({ msg: 'Detectando cenas…', progress: f }), sens);
      if (!cuts.length) { s.notify('Nenhuma mudança de cena encontrada'); return; }
      s.edit((d) => {
        const orig = d.clips.find((x) => x.id === c.id)!;
        const points = [orig.in, ...cuts, orig.in + orig.duration * orig.speed];
        d.clips.splice(d.clips.indexOf(orig), 1);
        for (let i = 0; i < points.length - 1; i++) {
          const a = points[i], b = points[i + 1];
          if (b - a < 0.1) continue;
          d.clips.push({ ...structuredClone(orig), id: i === 0 ? orig.id : uid('c'), in: a, duration: (b - a) / orig.speed, start: orig.start + (a - orig.in) / orig.speed + (orig.trackId === 'main' ? i * 0.00001 : 0), transition: i === 0 ? orig.transition : null, keyframes: {} });
        }
      });
      s.notify(`${cuts.length} cortes de cena criados`, 'ok');
      onBack();
    } catch (e) { s.notify((e as Error).message, 'error'); }
    finally { s.setBusy(null); }
  };
  return (
    <>
      <button className="btn small ghost" onClick={onBack}>← Ferramentas</button>
      <Section title="Cortar por cenas">
        <Slider label="Sensibilidade" value={sens} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={setSens} />
        <button className="btn primary block" onClick={run}>🎞 Detectar e dividir</button>
        <p className="hint">Divide o clipe selecionado (ou o clipe sob o cursor) em cada mudança de cena, para você reorganizar ou excluir trechos.</p>
      </Section>
    </>
  );
}

function BeatsTool({ onBack }: { onBack: () => void }) {
  const [every, setEvery] = useState(2);
  const project = useEditor((s) => s.project!);
  const audioClips = project.clips.filter((c) => c.kind === 'audio');
  // prefer music (longest audio that isn't a voice-studio/recorded voice track)
  const preferred = [...audioClips].sort((a, b) => {
    const va = /estúdio|narra|voz/i.test(a.name) ? 1 : 0, vb = /estúdio|narra|voz/i.test(b.name) ? 1 : 0;
    return va - vb || b.duration - a.duration;
  })[0];
  const [clipId, setClipId] = useState(preferred?.id ?? '');
  const detect = async (apply: boolean) => {
    const s = useEditor.getState();
    const c = s.project!.clips.find((x) => x.id === clipId);
    if (!c) { s.notify('Adicione uma música primeiro (Áudio → Importar)', 'error'); return; }
    s.setBusy({ msg: 'Analisando ritmo…' });
    try {
      const buf = await decodeAudio(c.mediaId!);
      if (!buf) throw new Error('Não foi possível ler o áudio');
      const { detectBeats } = await import('../../ai/analysis');
      const { beats, bpm } = detectBeats(buf, c.in, c.in + c.duration * c.speed);
      const tl = beats.map((b) => c.start + (b - c.in) / c.speed).filter((t) => t >= c.start && t <= clipEnd(c));
      s.edit((d) => {
        d.markers = tl;
        if (apply) {
          const mains = mainClips(d);
          let t = 0;
          let bi = 0;
          for (const m of mains) {
            const med = mediaById(d, m.mediaId);
            const max = maxClipDuration(m, med);
            // advance `every` beats from current position
            let target = t;
            let n = 0;
            while (bi < tl.length && n < every) { if (tl[bi] > t + 0.15) { target = tl[bi]; n++; } bi++; }
            if (n === 0) break;
            m.duration = Math.max(0.2, Math.min(max, target - t));
            m.transition = null;
            t += m.duration;
          }
        }
      });
      s.notify(`${bpm ? bpm + ' BPM · ' : ''}${tl.length} batidas${apply ? ' · cortes sincronizados 🥁' : ' marcadas'}`, 'ok');
      onBack();
    } catch (e) { s.notify((e as Error).message, 'error'); }
    finally { s.setBusy(null); }
  };
  return (
    <>
      <button className="btn small ghost" onClick={onBack}>← Ferramentas</button>
      <Section title="Sincronizar com a batida">
        {audioClips.length === 0 ? <p className="hint">Adicione uma música na faixa de áudio primeiro.</p> : (
          <select className="field" value={clipId} onChange={(e) => setClipId(e.target.value)} aria-label="Música">
            {audioClips.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <div className="hint">Cortar a cada</div>
        <Chips options={[1, 2, 4, 8].map((v) => ({ v, label: `${v} batida${v > 1 ? 's' : ''}` }))} value={every} onChange={setEvery} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => detect(false)} disabled={!audioClips.length}>Só marcar</button>
          <button className="btn primary" onClick={() => detect(true)} disabled={!audioClips.length}>🥁 Cortar no ritmo</button>
        </div>
      </Section>
    </>
  );
}
