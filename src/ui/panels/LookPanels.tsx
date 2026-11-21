import { useState } from 'react';
import { EFFECT_CATEGORIES, EFFECT_MAP, effectsInCategory } from '../../engine/effects';
import { FILTER_CATEGORIES, LOOKS } from '../../engine/filters';
import { defaultAdjust, uid } from '../../model/defaults';
import { mediaById } from '../../model/timeline';
import type { Adjust } from '../../model/types';
import { useEditor } from '../../store/editor';
import { Grid, Section, Slider, Tabs, Tile } from '../components/ui';
import { upd, useTargetClip } from './hooks';

const CAT_STYLE: Record<string, [string, string]> = {
  trend: ['🔥', 'linear-gradient(135deg,#f43f5e,#f97316)'], glitch: ['📺', 'linear-gradient(135deg,#06b6d4,#d946ef)'],
  retro: ['📼', 'linear-gradient(135deg,#a16207,#57534e)'], light: ['☀️', 'linear-gradient(135deg,#f59e0b,#fde68a)'],
  motion: ['🎥', 'linear-gradient(135deg,#6366f1,#22d3ee)'], distort: ['🌀', 'linear-gradient(135deg,#8b5cf6,#14b8a6)'],
  blur: ['◌', 'linear-gradient(135deg,#64748b,#cbd5e1)'], art: ['🎨', 'linear-gradient(135deg,#ec4899,#8b5cf6)'],
  color: ['🌈', 'linear-gradient(135deg,#22c55e,#3b82f6)'], nature: ['❄️', 'linear-gradient(135deg,#0ea5e9,#e0f2fe)'], frame: ['🖼', 'linear-gradient(135deg,#334155,#0f172a)'],
};

export function EffectsPanel() {
  const c = useTargetClip(true);
  const [cat, setCat] = useState('trend');
  if (!c) return <p className="hint">Adicione um clipe primeiro.</p>;
  const list = effectsInCategory(cat);
  const toggle = (type: string) => upd(c.id, (d) => {
    const i = d.effects.findIndex((e) => e.type === type);
    if (i >= 0) d.effects.splice(i, 1);
    else d.effects.push({ id: uid('e'), type, intensity: 0.7, speed: 1 });
  });
  return (
    <>
      {!useEditor.getState().selectedId && <p className="hint">Aplicando ao clipe sob o cursor. Para efeitos em todo o vídeo, aplique a cada clipe ou use uma sobreposição de cor com mesclagem.</p>}
      <Tabs tabs={EFFECT_CATEGORIES.map((x) => ({ id: x.id, label: x.name }))} value={cat} onChange={setCat} />
      <Grid cols={4}>
        {list.map((e) => {
          const [icon, bg] = CAT_STYLE[e.cat] ?? ['✨', 'var(--bg3)'];
          return (
            <Tile key={e.id} label={e.name} active={c.effects.some((x) => x.type === e.id)} onClick={() => toggle(e.id)} badge={e.animated ? '▶' : undefined}
              icon={<div className="fx-thumb" style={{ background: bg, display: 'grid', placeItems: 'center', fontSize: 22 }}>{icon}</div>} />
          );
        })}
      </Grid>
      {c.effects.length > 0 && (
        <Section title={`Aplicados (${c.effects.length})`}>
          <div className="list">
            {c.effects.map((fx, i) => (
              <div key={fx.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <b style={{ flex: 'none' }}>{EFFECT_MAP.get(fx.type)?.name ?? fx.type}</b>
                  <div style={{ display: 'flex', gap: 4, flex: 'none' }}>
                    <button className="btn small" disabled={i === 0} onClick={() => upd(c.id, (d) => { const [x] = d.effects.splice(i, 1); d.effects.splice(i - 1, 0, x); })} aria-label="Subir">↑</button>
                    <button className="btn small danger" onClick={() => upd(c.id, (d) => { d.effects.splice(i, 1); })}>Remover</button>
                  </div>
                </div>
                <Slider label="Intensidade" value={fx.intensity} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd(c.id, (d) => { const f = d.effects.find((x) => x.id === fx.id); if (f) f.intensity = v; }, 'fxi' + fx.id)} />
                {EFFECT_MAP.get(fx.type)?.animated && <Slider label="Velocidade" value={fx.speed} min={0.1} max={4} step={0.05} format={(v) => `${v.toFixed(2)}x`} onChange={(v) => upd(c.id, (d) => { const f = d.effects.find((x) => x.id === fx.id); if (f) f.speed = v; }, 'fxs' + fx.id)} />}
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

export function FiltersPanel() {
  const c = useTargetClip(true);
  const [cat, setCat] = useState('pop');
  if (!c) return <p className="hint">Adicione um clipe primeiro.</p>;
  const applyAll = () => useEditor.getState().edit((p) => { p.clips.forEach((x) => { if (x.kind === 'video' || x.kind === 'image') x.filter = c.filter ? { ...c.filter } : null; }); });
  const thumb = useEditor.getState().project ? mediaById(useEditor.getState().project!, c.mediaId)?.thumb : undefined;
  return (
    <>
      <Tabs tabs={FILTER_CATEGORIES.map((x) => ({ id: x.id, label: x.name }))} value={cat} onChange={setCat} />
      <Grid cols={4}>
        <Tile label="Original" icon="⊘" active={!c.filter} onClick={() => upd(c.id, (d) => { d.filter = null; })} />
        {LOOKS.filter((l) => l.cat === cat).map((l) => (
          <Tile key={l.id} label={l.name} active={c.filter?.id === l.id} onClick={() => upd(c.id, (d) => { d.filter = { id: l.id, intensity: d.filter?.intensity ?? 0.85 }; })}
            icon={thumb ? (
              <div className="fx-thumb" style={{ backgroundImage: `url(${thumb})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: cssFilterFor(l) }}>
                <div style={{ position: 'absolute', inset: 0, background: l.swatch, mixBlendMode: 'soft-light', opacity: 0.6 }} />
              </div>
            ) : <div className="fx-thumb" style={{ background: `linear-gradient(135deg, ${l.swatch}, #111)` }} />} />
        ))}
      </Grid>
      {c.filter && (
        <>
          <Slider label="Intensidade" value={c.filter.intensity} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd(c.id, (d) => { if (d.filter) d.filter.intensity = v; }, 'fi' + c.id)} />
          <button className="btn small block" onClick={applyAll}>Aplicar a todos os clipes</button>
        </>
      )}
    </>
  );
}

function cssFilterFor(l: (typeof LOOKS)[number]) {
  const parts = [];
  if (l.mode === 1) parts.push('grayscale(1)');
  if (l.mode === 2) parts.push('sepia(1)');
  if (l.saturation) parts.push(`saturate(${1 + l.saturation})`);
  if (l.contrast) parts.push(`contrast(${1 + l.contrast})`);
  if (l.exposure) parts.push(`brightness(${1 + l.exposure})`);
  if (l.hue) parts.push(`hue-rotate(${l.hue * 180}deg)`);
  return parts.join(' ');
}

const ADJ: { k: keyof Adjust; label: string }[] = [
  { k: 'exposure', label: 'Exposição' }, { k: 'brightness', label: 'Brilho' }, { k: 'contrast', label: 'Contraste' }, { k: 'saturation', label: 'Saturação' },
  { k: 'vibrance', label: 'Vibração' }, { k: 'temperature', label: 'Temperatura' }, { k: 'tint', label: 'Matiz (verde/magenta)' }, { k: 'hue', label: 'Tonalidade' },
  { k: 'highlights', label: 'Realces' }, { k: 'shadows', label: 'Sombras' }, { k: 'fade', label: 'Desbotar' }, { k: 'sharpen', label: 'Nitidez' },
  { k: 'vignette', label: 'Vinheta' }, { k: 'grain', label: 'Granulado' },
];

export function AdjustPanel() {
  const c = useTargetClip(true);
  if (!c) return <p className="hint">Adicione um clipe primeiro.</p>;
  const auto = async () => {
    const s = useEditor.getState();
    const m = mediaById(s.project!, c.mediaId);
    if (!m || m.kind === 'audio') return;
    s.setBusy({ msg: 'IA analisando cores e exposição…' });
    try {
      const { autoEnhance } = await import('../../ai/analysis');
      const adj = await autoEnhance(m.id, m.kind as 'video' | 'image', c.in, c.in + c.duration * c.speed);
      upd(c.id, (d) => { d.adjust = { ...d.adjust, ...adj }; });
      s.notify('Auto-aprimorar aplicado ✨', 'ok');
    } catch (e) { s.notify((e as Error).message, 'error'); }
    finally { s.setBusy(null); }
  };
  const applyAll = () => useEditor.getState().edit((p) => { p.clips.forEach((x) => { if (x.kind === 'video' || x.kind === 'image') x.adjust = { ...c.adjust }; }); });
  return (
    <>
      <div className="row" style={{ marginBottom: 6 }}>
        <button className="btn small primary" onClick={auto}>✨ Auto (IA)</button>
        <button className="btn small ghost" onClick={() => upd(c.id, (d) => { d.adjust = defaultAdjust(); })}>Redefinir</button>
        <button className="btn small ghost" onClick={applyAll}>Aplicar a todos</button>
      </div>
      {ADJ.map(({ k, label }) => {
        const bipolar = !['sharpen', 'grain'].includes(k);
        return (
          <Slider key={k} label={label} value={c.adjust[k]} min={bipolar ? -100 : 0} max={100} step={1} center={bipolar ? 0 : undefined}
            format={(v) => `${v > 0 && bipolar ? '+' : ''}${Math.round(v)}`} onReset={() => upd(c.id, (d) => { d.adjust[k] = 0; })}
            onChange={(v) => upd(c.id, (d) => { d.adjust[k] = v; }, `adj:${c.id}:${k}`)} />
        );
      })}
    </>
  );
}
