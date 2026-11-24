import { useEffect, useRef, useState } from 'react';
import { FONTS, onFontsChanged } from '../../engine/fonts';
import { MOTION_CATEGORIES, MOTION_MAP, MOTION_TEMPLATES, defaultMotion, drawMotion } from '../../engine/motion';
import type { MotionData } from '../../model/types';
import { useEditor } from '../../store/editor';
import { subscribeTick } from '../components/ticker';
import { Section, Slider, Swatches, PALETTE, Tabs } from '../components/ui';
import { upd, useTargetClip } from './hooks';

function MotionPreview({ m, aspect, still }: { m: MotionData; aspect: number; still?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { const off = onFontsChanged(() => setTick((x) => x + 1)); return () => { off(); }; }, []);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round((c.clientWidth || 160) * dpr);
    const h = Math.round(w / aspect);
    c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    const tpl = MOTION_MAP.get(m.template);
    const d = tpl?.duration ?? 4;
    if (still) { drawMotion(ctx, w, h, m, d * 0.6, d); return; }
    let visible = false;
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); }) : null;
    io?.observe(c);
    if (!io) visible = true;
    const start = performance.now();
    drawMotion(ctx, w, h, m, Math.min(1.5, d * 0.5), d);
    const off = subscribeTick((now) => { if (visible && !document.hidden) drawMotion(ctx, w, h, m, ((now - start) / 1000) % (d + 0.6), d); });
    return () => { off(); io?.disconnect(); };
  }, [m, aspect, tick, still]);
  return <canvas ref={ref} style={{ width: '100%', aspectRatio: String(aspect), display: 'block', borderRadius: 10, background: 'linear-gradient(135deg,#334155,#0f172a)' }} />;
}

export function MotionPanel() {
  const [cat, setCat] = useState('lower');
  const project = useEditor((s) => s.project!);
  // square thumbnails keep every template legible regardless of the project format
  const aspect = Math.max(1, project.width / project.height);
  return (
    <>
      <p className="hint">Gráficos animados prontos: toque para inserir no cursor. Depois edite textos, cores e fonte.</p>
      <Tabs tabs={MOTION_CATEGORIES.map((c) => ({ id: c.id, label: c.name }))} value={cat} onChange={setCat} />
      <div className="motion-grid" style={{ ['--ar' as string]: aspect }}>
        {MOTION_TEMPLATES.filter((t) => t.cat === cat).map((t) => (
          <button key={t.id} className="motion-tile" onClick={() => useEditor.getState().addMotion(t.id)} data-testid={`motion-${t.id}`} aria-label={`Inserir ${t.name}`}>
            <MotionPreview m={defaultMotion(t.id)} aspect={aspect} />
            <span>{t.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export function MotionEditPanel() {
  const c = useTargetClip(false);
  const project = useEditor((s) => s.project!);
  if (!c || c.kind !== 'motion' || !c.motion) return <p className="hint">Selecione um gráfico na linha do tempo.</p>;
  const m = c.motion;
  const tpl = MOTION_MAP.get(m.template);
  const set = (fn: (x: MotionData) => void, key = 'mo') => upd(c.id, (d) => { if (d.motion) fn(d.motion); }, key + c.id);
  return (
    <>
      <div style={{ maxWidth: 260, margin: '0 auto 10px' }}><MotionPreview m={m} aspect={project.width / project.height} /></div>
      <Section title="Textos">
        {(tpl?.fields ?? ['Texto']).map((label, i) => (
          <label key={label} style={{ display: 'block', marginBottom: 8 }}>
            <span className="hint" style={{ margin: 0 }}>{label}</span>
            <input className="field" value={m.texts[i] ?? ''} onChange={(e) => { const v = e.target.value; set((x) => { x.texts[i] = v; }, 'mot' + i); }} data-testid={`motion-text-${i}`} />
          </label>
        ))}
      </Section>
      <Section title="Cores">
        {m.colors.map((col, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div className="hint" style={{ margin: '0 0 4px' }}>{['Principal', 'Destaque', 'Terciária'][i] ?? `Cor ${i + 1}`}</div>
            <Swatches colors={PALETTE} value={col} onChange={(v) => set((x) => { x.colors[i] = v; }, 'moc' + i)} />
          </div>
        ))}
      </Section>
      <Section title="Fonte">
        <div className="font-list">
          {FONTS.map((f) => <button key={f.family} className={m.font === f.family ? 'on' : ''} style={{ fontFamily: `"${f.family}"` }} onClick={() => set((x) => { x.font = f.family; }, 'mof')}>{f.family}</button>)}
        </div>
      </Section>
      <Slider label="Duração" value={c.duration} min={1} max={30} step={0.1} format={(v) => `${v.toFixed(1)}s`} onChange={(v) => upd(c.id, (d) => { d.duration = v; }, 'mod' + c.id)} />
      <button className="btn small ghost" onClick={() => upd(c.id, (d) => { d.motion = defaultMotion(m.template); })}>Restaurar padrão</button>
      <p className="hint">Arraste e faça pinça na prévia do vídeo para posicionar e redimensionar.</p>
    </>
  );
}
