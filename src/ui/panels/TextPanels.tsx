import { useState } from 'react';
import { FONTS } from '../../engine/fonts';
import { defaultTextStyle } from '../../model/defaults';
import type { TextStyle } from '../../model/types';
import { useEditor } from '../../store/editor';
import { Chips, Grid, PALETTE, Section, Slider, Swatches, Tabs, Tile, Toggle } from '../components/ui';
import { upd, useTargetClip } from './hooks';

export const TEXT_PRESETS: { id: string; name: string; style: Partial<TextStyle> }[] = [
  { id: 'classic', name: 'Clássico', style: {} },
  { id: 'outline', name: 'Contorno', style: { strokeWidth: 8, strokeColor: '#000000', shadowBlur: 0 } },
  { id: 'title', name: 'Título', style: { font: 'Anton', weight: 400, size: 140, uppercase: true, letterSpacing: 2 } },
  { id: 'neon', name: 'Neon', style: { font: 'Righteous', weight: 400, color: '#ffffff', glowColor: '#ec4899', glowSize: 30, shadowBlur: 0 } },
  { id: 'box', name: 'Caixa', style: { font: 'Inter', weight: 800, size: 72, color: '#111111', bgColor: '#ffffff', bgOpacity: 1, shadowBlur: 0, bgRadius: 18 } },
  { id: 'boxdark', name: 'Faixa', style: { font: 'Inter', weight: 700, size: 64, bgColor: '#000000', bgOpacity: 0.75, shadowBlur: 0, bgRadius: 10 } },
  { id: 'gradient', name: 'Gradiente', style: { font: 'Montserrat', weight: 900, size: 120, color: '#fde047', gradient: '#f97316', shadowBlur: 20 } },
  { id: 'comic', name: 'Quadrinho', style: { font: 'Bangers', weight: 400, size: 130, color: '#fde047', strokeWidth: 10, strokeColor: '#000', shadowX: 8, shadowY: 8, shadowBlur: 0, shadowColor: '#000' } },
  { id: 'elegant', name: 'Elegante', style: { font: 'Playfair Display', weight: 700, italic: true, size: 100 } },
  { id: 'script', name: 'Manuscrito', style: { font: 'Pacifico', weight: 400, size: 110 } },
  { id: 'retro', name: 'Retrô', style: { font: 'Monoton', weight: 400, size: 110, color: '#f472b6', glowColor: '#f472b6', glowSize: 20 } },
  { id: 'gamer', name: 'Gamer', style: { font: 'Press Start 2P', weight: 400, size: 60, color: '#a3e635', strokeWidth: 6, strokeColor: '#14532d' } },
  { id: 'news', name: 'Notícia', style: { font: 'Roboto', weight: 900, size: 64, uppercase: true, bgColor: '#dc2626', bgOpacity: 1, bgRadius: 0, shadowBlur: 0 } },
  { id: 'cinema', name: 'Cinema', style: { font: 'Cinzel', weight: 700, size: 90, letterSpacing: 10, uppercase: true } },
  { id: 'horror', name: 'Terror', style: { font: 'Creepster', weight: 400, size: 130, color: '#dc2626', glowColor: '#7f1d1d', glowSize: 20 } },
  { id: 'marker', name: 'Marcador', style: { font: 'Permanent Marker', weight: 400, size: 110, color: '#ffffff', shadowBlur: 0, strokeWidth: 0 } },
];

export function TextPanel() {
  const st = useEditor.getState;
  return (
    <>
      <button className="btn primary block" onClick={() => st().addText('Seu texto')} data-testid="add-text">+ Adicionar texto</button>
      <Section title="Estilos prontos">
        <Grid cols={4}>
          {TEXT_PRESETS.map((p) => {
            const s = { ...defaultTextStyle(), ...p.style };
            return (
              <Tile key={p.id} label={p.name} onClick={() => st().addText(p.name === 'Clássico' ? 'Seu texto' : p.name, { text: { ...s, text: p.name === 'Clássico' ? 'Seu texto' : p.name, preset: p.id } })}
                icon={<span style={{ fontFamily: `"${s.font}"`, fontWeight: s.weight, fontStyle: s.italic ? 'italic' : 'normal', color: s.color, fontSize: 18, WebkitTextStroke: s.strokeWidth ? `1px ${s.strokeColor}` : undefined, textShadow: s.glowSize ? `0 0 8px ${s.glowColor}` : undefined, background: s.bgOpacity ? s.bgColor : undefined, padding: s.bgOpacity ? '2px 6px' : undefined, borderRadius: 4 }}>Aa</span>} />
            );
          })}
        </Grid>
      </Section>
      <p className="hint">Para legendas automáticas da fala, use a ferramenta <b>Legendas</b>.</p>
    </>
  );
}

export function TextEditPanel() {
  const c = useTargetClip(false);
  const [tab, setTab] = useState<'text' | 'font' | 'style' | 'presets'>('text');
  if (!c || !c.text) return <p className="hint">Selecione um texto.</p>;
  const t = c.text;
  const set = (fn: (s: TextStyle) => void, key = 'txt') => upd(c.id, (d) => { if (d.text) fn(d.text); }, key + c.id);
  return (
    <>
      <Tabs tabs={[{ id: 'text', label: 'Texto' }, { id: 'font', label: 'Fonte' }, { id: 'style', label: 'Estilo' }, { id: 'presets', label: 'Modelos' }]} value={tab} onChange={setTab} />
      {tab === 'text' && (
        <>
          <textarea className="field" value={t.text} onChange={(e) => set((s) => { s.text = e.target.value; }, 'tt')} autoFocus data-testid="text-input" />
          <Section title="Cor">
            <Swatches colors={PALETTE} value={t.color} onChange={(v) => set((s) => { s.color = v; s.gradient = null; }, 'tc')} />
          </Section>
          <Chips options={[{ v: 'left', label: 'Esquerda' }, { v: 'center', label: 'Centro' }, { v: 'right', label: 'Direita' }]} value={t.align} onChange={(v) => set((s) => { s.align = v as TextStyle['align']; })} />
        </>
      )}
      {tab === 'font' && (
        <>
          <Grid cols={3}>
            {FONTS.map((f) => (
              <button key={f.family} className={`tile ${t.font === f.family ? 'active' : ''}`} onClick={() => set((s) => { s.font = f.family; }, 'tf')}>
                <div className="tile-icon" style={{ aspectRatio: '2', fontFamily: `"${f.family}"`, fontSize: 18 }}>Abc</div>
                <div className="tile-label">{f.family}</div>
              </button>
            ))}
          </Grid>
          <Section title="Peso">
            <Chips options={[400, 600, 700, 800, 900].map((v) => ({ v, label: String(v) }))} value={t.weight} onChange={(v) => set((s) => { s.weight = v; })} />
          </Section>
          <Toggle label="Itálico" value={t.italic} onChange={(v) => set((s) => { s.italic = v; })} />
          <Toggle label="MAIÚSCULAS" value={t.uppercase} onChange={(v) => set((s) => { s.uppercase = v; })} />
          <Slider label="Tamanho" value={t.size} min={12} max={400} step={1} onChange={(v) => set((s) => { s.size = v; }, 'ts')} />
          <Slider label="Espaçamento entre letras" value={t.letterSpacing} min={-10} max={40} step={0.5} onChange={(v) => set((s) => { s.letterSpacing = v; }, 'tls')} />
          <Slider label="Altura da linha" value={t.lineHeight} min={0.7} max={2.5} step={0.05} onChange={(v) => set((s) => { s.lineHeight = v; }, 'tlh')} />
        </>
      )}
      {tab === 'style' && (
        <>
          <Section title="Gradiente">
            <Swatches colors={['', ...PALETTE].filter(Boolean)} value={t.gradient ?? ''} onChange={(v) => set((s) => { s.gradient = v; }, 'tg')} />
            {t.gradient && <button className="btn small ghost" style={{ marginTop: 8 }} onClick={() => set((s) => { s.gradient = null; })}>Remover gradiente</button>}
          </Section>
          <Section title="Contorno">
            <Swatches colors={PALETTE} value={t.strokeColor} onChange={(v) => set((s) => { s.strokeColor = v; if (!s.strokeWidth) s.strokeWidth = 6; }, 'tsc')} />
            <Slider label="Espessura" value={t.strokeWidth} min={0} max={30} step={0.5} onChange={(v) => set((s) => { s.strokeWidth = v; }, 'tsw')} />
          </Section>
          <Section title="Sombra">
            <Slider label="Desfoque" value={t.shadowBlur} min={0} max={60} step={1} onChange={(v) => set((s) => { s.shadowBlur = v; }, 'tsb')} />
            <Slider label="Deslocamento X" value={t.shadowX} min={-30} max={30} step={1} center={0} onChange={(v) => set((s) => { s.shadowX = v; }, 'tsx')} />
            <Slider label="Deslocamento Y" value={t.shadowY} min={-30} max={30} step={1} center={0} onChange={(v) => set((s) => { s.shadowY = v; }, 'tsy')} />
          </Section>
          <Section title="Brilho (glow)">
            <Swatches colors={PALETTE} value={t.glowColor} onChange={(v) => set((s) => { s.glowColor = v; if (!s.glowSize) s.glowSize = 20; }, 'tgc')} />
            <Slider label="Intensidade" value={t.glowSize} min={0} max={80} step={1} onChange={(v) => set((s) => { s.glowSize = v; }, 'tgs')} />
          </Section>
          <Section title="Fundo">
            <Swatches colors={PALETTE} value={t.bgColor} onChange={(v) => set((s) => { s.bgColor = v; if (!s.bgOpacity) s.bgOpacity = 1; }, 'tbc')} />
            <Slider label="Opacidade" value={t.bgOpacity} min={0} max={1} step={0.01} onChange={(v) => set((s) => { s.bgOpacity = v; }, 'tbo')} />
            <Slider label="Margem" value={t.bgPadding} min={0} max={80} step={1} onChange={(v) => set((s) => { s.bgPadding = v; }, 'tbp')} />
            <Slider label="Arredondamento" value={t.bgRadius} min={0} max={80} step={1} onChange={(v) => set((s) => { s.bgRadius = v; }, 'tbr')} />
          </Section>
        </>
      )}
      {tab === 'presets' && (
        <Grid cols={4}>
          {TEXT_PRESETS.map((p) => {
            const s = { ...defaultTextStyle(), ...p.style };
            return (
              <Tile key={p.id} label={p.name} active={t.preset === p.id} onClick={() => set((x) => { Object.assign(x, defaultTextStyle(x.text), p.style, { text: x.text, preset: p.id }); }, 'tp')}
                icon={<span style={{ fontFamily: `"${s.font}"`, fontWeight: s.weight, color: s.color, fontSize: 18 }}>Aa</span>} />
            );
          })}
        </Grid>
      )}
    </>
  );
}
