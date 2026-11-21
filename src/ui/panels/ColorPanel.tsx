import { useEffect, useRef, useState } from 'react';
import { analyzeCamera, type CameraAnalysis } from '../../ai/camera';
import { LUTS, LUT_CATEGORIES, importCubeFile, lutThumb } from '../../engine/lut';
import { defaultAdjust, defaultWheels } from '../../model/defaults';
import { mediaById } from '../../model/timeline';
import type { Clip, Wheel4, Wheels } from '../../model/types';
import { useEditor } from '../../store/editor';
import { pickFiles } from '../actions';
import { Grid, Section, Slider, Tabs, Tile } from '../components/ui';
import { upd, useTargetClip } from './hooks';
import { AdjustPanel, FiltersPanel } from './LookPanels';

type Tab = 'camera' | 'lut' | 'wheels' | 'adjust' | 'filters';

export function ColorPanel() {
  const c = useTargetClip(true);
  const [tab, setTab] = useState<Tab>('camera');
  if (!c) return <p className="hint">Adicione um clipe primeiro.</p>;
  return (
    <>
      <Tabs tabs={[{ id: 'camera', label: 'Câmera' }, { id: 'lut', label: 'LUTs' }, { id: 'wheels', label: 'Rodas de cor' }, { id: 'adjust', label: 'Ajustes' }, { id: 'filters', label: 'Filtros' }]} value={tab} onChange={setTab} />
      {!useEditor.getState().selectedId && <p className="hint">Corrigindo o clipe sob o cursor.</p>}
      {tab === 'camera' && <CameraTab c={c} />}
      {tab === 'lut' && <LutTab c={c} />}
      {tab === 'wheels' && <WheelsTab c={c} />}
      {tab === 'adjust' && <AdjustPanel />}
      {tab === 'filters' && <FiltersPanel />}
    </>
  );
}

// ------------------------------------------------------------------ camera
function CameraTab({ c }: { c: Clip }) {
  const project = useEditor((s) => s.project!);
  const [res, setRes] = useState<CameraAnalysis | null>(null);
  const m = mediaById(project, c.mediaId);
  const run = async (all: boolean) => {
    const s = useEditor.getState();
    const targets = all ? s.project!.clips.filter((x) => x.kind === 'video' && x.mediaId) : [c];
    if (!targets.length || (targets.length === 1 && targets[0].kind !== 'video')) { s.notify('A detecção de câmera funciona em clipes de vídeo', 'error'); return; }
    const out = new Map<string, CameraAnalysis>();
    try {
      for (let i = 0; i < targets.length; i++) {
        s.setBusy({ msg: `Identificando câmera e perfil de cor (${i + 1}/${targets.length})…`, progress: i / targets.length });
        const t = targets[i];
        out.set(t.id, await analyzeCamera(t.mediaId!, t.in, t.in + t.duration * t.speed));
      }
      s.edit((d) => {
        for (const x of d.clips) {
          const a = out.get(x.id);
          if (!a) continue;
          x.camera = a.info;
          x.lut = a.lut ? { id: a.lut, intensity: 1 } : x.lut;
          x.adjust = { ...defaultAdjust(), ...a.adjust };
        }
      });
      setRes(out.get(c.id) ?? [...out.values()][0]);
      s.notify(`Correção de câmera aplicada em ${out.size} clipe(s) 🎥`, 'ok');
    } catch (e) { s.notify((e as Error).message, 'error'); }
    finally { s.setBusy(null); }
  };
  const info = c.camera;
  return (
    <>
      <Section title="Correção inteligente de câmera">
        <p className="hint">A IA lê os metadados do arquivo (marca, modelo, HDR) e analisa a imagem para detectar gravações em LOG/flat. Depois aplica o LUT de conversão certo e corrige exposição, contraste, saturação e balanço de branco.</p>
        <div className="row">
          <button className="btn primary" onClick={() => run(false)} disabled={c.kind !== 'video'} data-testid="camera-detect">🎥 Detectar e corrigir</button>
          <button className="btn" onClick={() => run(true)}>Todos os clipes</button>
        </div>
      </Section>
      {(res || info) && (
        <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
          <b>{info ? `${info.make}${info.model ? ' · ' + info.model : ''}` : ''}</b>
          {res?.summary.map((s) => <div key={s} className="hint" style={{ margin: 0 }}>• {s}</div>)}
          {info && !res && <div className="hint" style={{ margin: 0 }}>{info.hdr ? 'HDR' : info.log ? 'Perfil LOG' : 'Rec.709'}{info.profile ? ` · LUT ${LUTS.find((l) => l.id === info.profile)?.name ?? info.profile}` : ''}</div>}
          {res && <div className="hint" style={{ margin: 0 }}>Brilho médio {(res.stats.mean * 100).toFixed(0)}% · contraste {(res.stats.std * 100).toFixed(0)} · saturação {(res.stats.sat * 100).toFixed(0)}</div>}
        </div>
      )}
      <Section title="Perfil manual da câmera">
        <Grid cols={3}>
          {LUTS.filter((l) => l.cat === 'camera').map((l) => (
            <Tile key={l.id} label={l.name} active={c.lut?.id === l.id} onClick={() => upd(c.id, (d) => { d.lut = d.lut?.id === l.id ? null : { id: l.id, intensity: 1 }; })}
              icon={<LutThumb id={l.id} src={m?.thumb} swatch={l.swatch} />} badge={l.note ? undefined : undefined} />
          ))}
        </Grid>
        <p className="hint">Conversões LOG→Rec.709 são aproximações matemáticas das curvas dos fabricantes. Para o LUT oficial da sua câmera, importe o arquivo .cube na aba LUTs.</p>
      </Section>
    </>
  );
}

function LutThumb({ id, src, swatch }: { id: string; src?: string; swatch: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let on = true; lutThumb(id, src).then((u) => on && setUrl(u)); return () => { on = false; }; }, [id, src]);
  return url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div className="fx-thumb" style={{ background: `linear-gradient(135deg, ${swatch}, #111)` }} />;
}

// ------------------------------------------------------------------ LUTs
function LutTab({ c }: { c: Clip }) {
  const project = useEditor((s) => s.project!);
  const [cat, setCat] = useState('film');
  const m = mediaById(project, c.mediaId);
  const list = cat === 'custom' ? project.customLuts.map((x) => ({ id: x.id, name: x.name, swatch: '#475569' })) : LUTS.filter((l) => l.cat === cat);
  const importLut = async () => {
    const files = await pickFiles('.cube', true);
    const s = useEditor.getState();
    for (const f of files) {
      try {
        const r = await importCubeFile(f);
        s.edit((d) => { d.customLuts.push(r); });
        upd(c.id, (d) => { d.lut = { id: r.id, intensity: 1 }; });
        s.notify(`LUT “${r.name}” importado`, 'ok');
      } catch (e) { s.notify(`${f.name}: ${(e as Error).message}`, 'error'); }
    }
    setCat('custom');
  };
  return (
    <>
      <Tabs tabs={LUT_CATEGORIES.map((x) => ({ id: x.id, label: x.name }))} value={cat} onChange={setCat} />
      <Grid cols={4}>
        <Tile label="Nenhum" icon="⊘" active={!c.lut} onClick={() => upd(c.id, (d) => { d.lut = null; })} />
        {list.map((l) => (
          <Tile key={l.id} label={l.name} active={c.lut?.id === l.id} onClick={() => upd(c.id, (d) => { d.lut = { id: l.id, intensity: d.lut?.intensity ?? 1 }; })}
            icon={<LutThumb id={l.id} src={m?.thumb} swatch={l.swatch} />} />
        ))}
        {cat === 'custom' && <Tile label="Importar .cube" icon="＋" onClick={importLut} />}
      </Grid>
      {c.lut && (
        <>
          <Slider label="Intensidade do LUT" value={c.lut.intensity} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd(c.id, (d) => { if (d.lut) d.lut.intensity = v; }, 'lut' + c.id)} />
          <button className="btn small block" onClick={() => useEditor.getState().edit((p) => { p.clips.forEach((x) => { if (x.kind === 'video' || x.kind === 'image') x.lut = c.lut ? { ...c.lut } : null; }); })}>Aplicar a todos os clipes</button>
        </>
      )}
      <div className="row" style={{ marginTop: 10 }}><button className="btn small" onClick={importLut}>Importar LUT (.cube) do Premiere/DaVinci</button></div>
    </>
  );
}

// ------------------------------------------------------------------ color wheels
function WheelsTab({ c }: { c: Clip }) {
  const w = c.wheels ?? defaultWheels();
  const set = (k: keyof Wheels, v: Wheel4) => upd(c.id, (d) => { d.wheels = { ...(d.wheels ?? defaultWheels()), [k]: v }; }, `wh:${c.id}:${k}`);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <ColorWheel label="Sombras (Lift)" value={w.lift} onChange={(v) => set('lift', v)} />
        <ColorWheel label="Meios-tons (Gamma)" value={w.gamma} onChange={(v) => set('gamma', v)} />
        <ColorWheel label="Realces (Gain)" value={w.gain} onChange={(v) => set('gain', v)} />
        <ColorWheel label="Geral (Offset)" value={w.offset ?? [0, 0, 0, 0]} onChange={(v) => set('offset', v)} />
      </div>
      <button className="btn small ghost block" style={{ marginTop: 10 }} onClick={() => upd(c.id, (d) => { d.wheels = defaultWheels(); })}>Redefinir rodas</button>
      <p className="hint">Arraste o ponto para tingir sombras, meios-tons ou realces (como no DaVinci Resolve). O controle abaixo de cada roda ajusta o brilho daquela faixa. Toque duas vezes na roda para zerar.</p>
    </>
  );
}

function ColorWheel({ label, value, onChange }: { label: string; value: Wheel4; onChange: (v: Wheel4) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [r, g, b, master] = value;
  const x = (r - (g + b) / 2) / 1.5, y = ((g - b) * Math.sqrt(3) / 2) / 1.5;
  const R = 0.5;
  const fromPoint = (e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    let dx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    let dy = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    const a = Math.atan2(dy, dx), rad = Math.min(1, len) * R;
    const k = (o: number) => Math.round(rad * Math.cos(a - o) * 1000) / 1000;
    onChange([k(0), k((2 * Math.PI) / 3), k((-2 * Math.PI) / 3), master]);
  };
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="hint" style={{ margin: '0 0 6px' }}>{label}</div>
      <div ref={ref} className="wheel" onDoubleClick={() => onChange([0, 0, 0, master])}
        onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); fromPoint(e); }}
        onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') fromPoint(e); }}
        role="slider" aria-label={label}>
        <i style={{ left: `${50 + (x / R) * 50}%`, top: `${50 - (y / R) * 50}%` }} />
      </div>
      <input type="range" min={-1} max={1} step={0.01} value={master} aria-label={label + ' brilho'}
        style={{ ['--lo' as string]: `${Math.min(50, (master + 1) * 50)}%`, ['--hi' as string]: `${Math.max(50, (master + 1) * 50)}%` }}
        onChange={(e) => onChange([r, g, b, parseFloat(e.target.value)])} onDoubleClick={() => onChange([r, g, b, 0])} />
    </div>
  );
}
