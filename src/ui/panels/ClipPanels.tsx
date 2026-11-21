import { useState } from 'react';
import { IN_ANIMS, LOOP_ANIMS, OUT_ANIMS } from '../../engine/animations';
import { VOICE_FX } from '../../engine/audioFx';
import { audioCtx } from '../../engine/media';
import { SFX, sfxBuffer } from '../../engine/sfx';
import { TRANSITIONS, TRANSITION_CATEGORIES, TRANSITION_MAP, TRENDING_TRANSITIONS } from '../../engine/transitions';
import { defaultChroma, defaultMask, defaultTransform } from '../../model/defaults';
import { evalKeyframes, mainClips, mediaById, maxClipDuration, setKeyframe } from '../../model/timeline';
import type { AnimProp, BlendMode, Clip, Ease, MaskType } from '../../model/types';
import { useEditor } from '../../store/editor';
import { Chips, Grid, Section, Slider, Swatches, Tabs, Tile, Toggle } from '../components/ui';
import { upd, useTargetClip } from './hooks';

function NoClip() { return <p className="hint">Selecione um clipe na linha do tempo.</p>; }

// ------------------------------------------------------------------ keyframe helper
function useKf(c: Clip, prop: AnimProp, base: number) {
  const time = useEditor((s) => s.time);
  const lt = time - c.start;
  const kfs = c.keyframes[prop];
  const has = !!kfs?.length;
  const value = has ? evalKeyframes(kfs, lt, base) : base;
  const active = !!kfs?.some((k) => Math.abs(k.t - lt) < 0.03);
  const inside = lt >= 0 && lt <= c.duration;
  return {
    value,
    set: (v: number, assignBase: (c: Clip, v: number) => void) => upd(c.id, (d) => {
      if (d.keyframes[prop]?.length && inside) d.keyframes[prop] = setKeyframe(d.keyframes[prop], lt, v);
      else assignBase(d, v);
    }, `kf:${c.id}:${prop}`),
    kf: {
      active, has,
      toggle: () => upd(c.id, (d) => {
        if (!inside) return;
        const list = d.keyframes[prop] ?? [];
        if (list.some((k) => Math.abs(k.t - lt) < 0.03)) d.keyframes[prop] = list.filter((k) => Math.abs(k.t - lt) >= 0.03);
        else d.keyframes[prop] = setKeyframe(list, lt, value);
        if (!d.keyframes[prop]!.length) delete d.keyframes[prop];
      }),
    },
  };
}

// ------------------------------------------------------------------ speed
export function SpeedPanel() {
  const c = useTargetClip(false);
  const project = useEditor((s) => s.project!);
  if (!c) return <NoClip />;
  const m = mediaById(project, c.mediaId);
  const setSpeed = (v: number) => upd(c.id, (d) => {
    const srcLen = d.duration * d.speed;
    d.speed = v;
    d.duration = srcLen / v;
    const max = maxClipDuration(d, m);
    if (d.duration > max) d.duration = max;
  }, 'speed:' + c.id);
  const presets = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10];
  return (
    <>
      <Slider label="Velocidade" value={c.speed} min={0.1} max={10} step={0.05} onChange={setSpeed} format={(v) => `${v.toFixed(2)}x`} onReset={() => setSpeed(1)} center={1} />
      <Chips options={presets.map((v) => ({ v, label: `${v}x` }))} value={c.speed} onChange={setSpeed} />
      <p className="hint">Duração resultante: {c.duration.toFixed(2)}s. O tom do áudio acompanha a velocidade (efeito câmera lenta/rápida).</p>
    </>
  );
}

// ------------------------------------------------------------------ volume
export function VolumePanel() {
  const c = useTargetClip(false);
  if (!c) return <NoClip />;
  return <VolumeInner c={c} />;
}
function VolumeInner({ c }: { c: Clip }) {
  const kf = useKf(c, 'volume', c.audio.volume);
  return (
    <>
      <Slider label="Volume" value={kf.value} min={0} max={3} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onReset={() => upd(c.id, (d) => { d.audio.volume = 1; })}
        onChange={(v) => kf.set(v, (d, x) => { d.audio.volume = x; })} keyframe={kf.kf} />
      <Toggle label="Silenciar" value={c.audio.muted} onChange={(v) => upd(c.id, (d) => { d.audio.muted = v; })} />
      <Slider label="Fade in" value={c.audio.fadeIn} min={0} max={Math.min(10, c.duration / 2)} step={0.1} format={(v) => `${v.toFixed(1)}s`} onChange={(v) => upd(c.id, (d) => { d.audio.fadeIn = v; }, 'fi')} />
      <Slider label="Fade out" value={c.audio.fadeOut} min={0} max={Math.min(10, c.duration / 2)} step={0.1} format={(v) => `${v.toFixed(1)}s`} onChange={(v) => upd(c.id, (d) => { d.audio.fadeOut = v; }, 'fo')} />
    </>
  );
}

// ------------------------------------------------------------------ voice
export function VoicePanel() {
  const c = useTargetClip(false);
  if (!c) return <NoClip />;
  const a = c.audio;
  return (
    <>
      <Section title="Aprimorar com IA">
        <Toggle label="Melhorar voz" hint="EQ de presença + compressão de estúdio" value={a.enhance} onChange={(v) => upd(c.id, (d) => { d.audio.enhance = v; })} />
        <Toggle label="Reduzir ruído" hint="Remove zumbido, graves e chiado" value={a.denoise} onChange={(v) => upd(c.id, (d) => { d.audio.denoise = v; })} />
      </Section>
      <Section title="Efeito de voz">
        <Grid cols={4}>
          {VOICE_FX.map((v) => <Tile key={v.id} label={v.name} icon={v.icon} active={a.voiceFx === v.id} onClick={() => upd(c.id, (d) => { d.audio.voiceFx = v.id; })} />)}
        </Grid>
      </Section>
      <Section title="Equalizador">
        <Slider label="Graves" value={a.eqLow} min={-12} max={12} step={0.5} center={0} format={(v) => `${v > 0 ? '+' : ''}${v} dB`} onChange={(v) => upd(c.id, (d) => { d.audio.eqLow = v; }, 'eql')} onReset={() => upd(c.id, (d) => { d.audio.eqLow = 0; })} />
        <Slider label="Médios" value={a.eqMid} min={-12} max={12} step={0.5} center={0} format={(v) => `${v > 0 ? '+' : ''}${v} dB`} onChange={(v) => upd(c.id, (d) => { d.audio.eqMid = v; }, 'eqm')} onReset={() => upd(c.id, (d) => { d.audio.eqMid = 0; })} />
        <Slider label="Agudos" value={a.eqHigh} min={-12} max={12} step={0.5} center={0} format={(v) => `${v > 0 ? '+' : ''}${v} dB`} onChange={(v) => upd(c.id, (d) => { d.audio.eqHigh = v; }, 'eqh')} onReset={() => upd(c.id, (d) => { d.audio.eqHigh = 0; })} />
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ animation
export function AnimationPanel() {
  const c = useTargetClip(false);
  const [tab, setTab] = useState<'in' | 'out' | 'loop'>('in');
  if (!c) return <NoClip />;
  const list = tab === 'in' ? IN_ANIMS : tab === 'out' ? OUT_ANIMS : LOOP_ANIMS;
  const cur = c.anims[tab];
  const maxD = tab === 'loop' ? 4 : Math.max(0.1, Math.min(5, c.duration * (tab === 'in' ? 0.9 : 0.9)));
  return (
    <>
      <Tabs tabs={[{ id: 'in', label: 'Entrada' }, { id: 'out', label: 'Saída' }, { id: 'loop', label: 'Contínua' }]} value={tab} onChange={setTab} />
      <Grid cols={4}>
        <Tile label="Nenhuma" icon="🚫" active={!cur} onClick={() => upd(c.id, (d) => { d.anims[tab] = null; })} />
        {list.map((a) => (
          <Tile key={a.id} label={a.name} icon={a.icon} active={cur?.type === a.id}
            onClick={() => upd(c.id, (d) => { d.anims[tab] = { type: a.id, duration: cur?.duration ?? (tab === 'loop' ? 1.2 : Math.min(0.6, d.duration / 2)) }; })} />
        ))}
      </Grid>
      {cur && (
        <Slider label={tab === 'loop' ? 'Ciclo' : 'Duração'} value={Math.min(cur.duration, maxD)} min={0.1} max={maxD} step={0.05} format={(v) => `${v.toFixed(2)}s`}
          onChange={(v) => upd(c.id, (d) => { if (d.anims[tab]) d.anims[tab]!.duration = v; }, 'animd')} />
      )}
    </>
  );
}

// ------------------------------------------------------------------ transform
export function TransformPanel() {
  const c = useTargetClip(false);
  if (!c) return <NoClip />;
  return <TransformInner c={c} />;
}
function TransformInner({ c }: { c: Clip }) {
  const t = c.transform;
  const x = useKf(c, 'x', t.x), y = useKf(c, 'y', t.y), s = useKf(c, 'scale', t.scale), r = useKf(c, 'rotation', t.rotation), o = useKf(c, 'opacity', t.opacity);
  const [tab, setTab] = useState<'pos' | 'crop'>('pos');
  return (
    <>
      <Tabs tabs={[{ id: 'pos', label: 'Posição' }, { id: 'crop', label: 'Cortar' }]} value={tab} onChange={setTab} />
      {tab === 'pos' ? (
        <>
          {c.kind !== 'text' && (
            <Chips options={[{ v: 'contain', label: 'Ajustar' }, { v: 'cover', label: 'Preencher' }, { v: 'fill', label: 'Esticar' }]} value={c.fit}
              onChange={(v) => upd(c.id, (d) => { d.fit = v as Clip['fit']; })} />
          )}
          <Slider label="Escala" value={s.value} min={0.05} max={5} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => s.set(v, (d, k) => { d.transform.scale = k; })} keyframe={s.kf} onReset={() => upd(c.id, (d) => { d.transform.scale = 1; })} />
          <Slider label="Posição X" value={x.value} min={-1} max={1} step={0.005} center={0} format={(v) => `${Math.round(v * 100)}`} onChange={(v) => x.set(v, (d, k) => { d.transform.x = k; })} keyframe={x.kf} onReset={() => upd(c.id, (d) => { d.transform.x = 0; })} />
          <Slider label="Posição Y" value={y.value} min={-1} max={1} step={0.005} center={0} format={(v) => `${Math.round(v * 100)}`} onChange={(v) => y.set(v, (d, k) => { d.transform.y = k; })} keyframe={y.kf} onReset={() => upd(c.id, (d) => { d.transform.y = 0; })} />
          <Slider label="Rotação" value={r.value} min={-180} max={180} step={1} center={0} format={(v) => `${Math.round(v)}°`} onChange={(v) => r.set(v, (d, k) => { d.transform.rotation = k; })} keyframe={r.kf} onReset={() => upd(c.id, (d) => { d.transform.rotation = 0; })} />
          <Slider label="Opacidade" value={o.value} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => o.set(v, (d, k) => { d.transform.opacity = k; })} keyframe={o.kf} onReset={() => upd(c.id, (d) => { d.transform.opacity = 1; })} />
          <div className="row">
            <button className={`btn small ${t.flipX ? 'primary' : ''}`} onClick={() => upd(c.id, (d) => { d.transform.flipX = !d.transform.flipX; })}>Espelhar ↔</button>
            <button className={`btn small ${t.flipY ? 'primary' : ''}`} onClick={() => upd(c.id, (d) => { d.transform.flipY = !d.transform.flipY; })}>Virar ↕</button>
            <button className="btn small" onClick={() => upd(c.id, (d) => { d.transform.rotation = ((d.transform.rotation + 90 + 180) % 360) - 180; })}>Girar 90°</button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn small ghost" onClick={() => upd(c.id, (d) => { d.transform = { ...defaultTransform(), cropL: d.transform.cropL, cropR: d.transform.cropR, cropT: d.transform.cropT, cropB: d.transform.cropB }; d.keyframes = { volume: d.keyframes.volume }; })}>Redefinir</button>
          </div>
          <p className="hint">Dica: arraste e faça pinça diretamente na pré-visualização. Toque em ◆ para criar keyframes animados.</p>
        </>
      ) : (
        <>
          <Slider label="Esquerda" value={t.cropL} min={0} max={0.9 - t.cropR} step={0.005} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd(c.id, (d) => { d.transform.cropL = v; }, 'crop')} />
          <Slider label="Direita" value={t.cropR} min={0} max={0.9 - t.cropL} step={0.005} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd(c.id, (d) => { d.transform.cropR = v; }, 'crop')} />
          <Slider label="Topo" value={t.cropT} min={0} max={0.9 - t.cropB} step={0.005} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd(c.id, (d) => { d.transform.cropT = v; }, 'crop')} />
          <Slider label="Base" value={t.cropB} min={0} max={0.9 - t.cropT} step={0.005} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd(c.id, (d) => { d.transform.cropB = v; }, 'crop')} />
          <button className="btn small ghost" onClick={() => upd(c.id, (d) => { d.transform.cropL = d.transform.cropR = d.transform.cropT = d.transform.cropB = 0; })}>Remover corte</button>
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------------ mask
const MASKS: { id: MaskType; name: string; icon: string }[] = [
  { id: 'none', name: 'Nenhuma', icon: '🚫' }, { id: 'circle', name: 'Círculo', icon: '⚪' }, { id: 'rect', name: 'Retângulo', icon: '⬜' },
  { id: 'linear', name: 'Linear', icon: '◧' }, { id: 'mirror', name: 'Faixa', icon: '▤' }, { id: 'heart', name: 'Coração', icon: '♥' }, { id: 'star', name: 'Estrela', icon: '★' },
];
export function MaskPanel() {
  const c = useTargetClip(false);
  if (!c) return <NoClip />;
  const m = c.mask;
  const set = (fn: (mm: typeof m) => void, key = 'mask') => upd(c.id, (d) => fn(d.mask), key + c.id);
  return (
    <>
      <Grid cols={4}>{MASKS.map((x) => <Tile key={x.id} label={x.name} icon={x.icon} active={m.type === x.id} onClick={() => set((mm) => { mm.type = x.id; }, 'mt')} />)}</Grid>
      {m.type !== 'none' && (
        <>
          <Slider label="Posição X" value={m.x} min={-0.5} max={0.5} step={0.005} center={0} onChange={(v) => set((mm) => { mm.x = v; })} />
          <Slider label="Posição Y" value={m.y} min={-0.5} max={0.5} step={0.005} center={0} onChange={(v) => set((mm) => { mm.y = v; })} />
          {m.type !== 'linear' && <Slider label="Largura" value={m.w} min={0.02} max={1.5} step={0.01} onChange={(v) => set((mm) => { mm.w = v; if (mm.type === 'circle' || mm.type === 'heart' || mm.type === 'star') mm.h = v; })} />}
          {(m.type === 'rect' || m.type === 'mirror') && <Slider label="Altura" value={m.h} min={0.02} max={1.5} step={0.01} onChange={(v) => set((mm) => { mm.h = v; })} />}
          <Slider label="Rotação" value={m.rotation} min={-180} max={180} step={1} center={0} format={(v) => `${v}°`} onChange={(v) => set((mm) => { mm.rotation = v; })} />
          <Slider label="Suavizar borda" value={m.feather} min={0} max={0.5} step={0.005} onChange={(v) => set((mm) => { mm.feather = v; })} />
          {m.type === 'rect' && <Slider label="Arredondar" value={m.radius} min={0} max={1} step={0.01} onChange={(v) => set((mm) => { mm.radius = v; })} />}
          <Toggle label="Inverter" value={m.invert} onChange={(v) => set((mm) => { mm.invert = v; }, 'mi')} />
          <button className="btn small ghost" onClick={() => upd(c.id, (d) => { d.mask = defaultMask(); })}>Redefinir</button>
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------------ chroma
export function ChromaPanel() {
  const c = useTargetClip(false);
  if (!c) return <NoClip />;
  const k = c.chroma;
  const set = (fn: (x: typeof k) => void, key = 'chroma') => upd(c.id, (d) => fn(d.chroma), key + c.id);
  return (
    <>
      <Toggle label="Ativar chroma key" hint="Remove fundo verde/azul" value={k.enabled} onChange={(v) => set((x) => { x.enabled = v; }, 'ce')} />
      <Section title="Cor a remover">
        <Swatches colors={['#00ff00', '#00b140', '#0047bb', '#0000ff', '#ffffff', '#000000']} value={k.color} onChange={(v) => set((x) => { x.color = v; x.enabled = true; }, 'cc')} />
      </Section>
      <Slider label="Intensidade" value={k.similarity} min={0} max={1} step={0.01} onChange={(v) => set((x) => { x.similarity = v; })} />
      <Slider label="Suavidade" value={k.smoothness} min={0} max={1} step={0.01} onChange={(v) => set((x) => { x.smoothness = v; })} />
      <Slider label="Remover reflexo" value={k.spill} min={0} max={1} step={0.01} onChange={(v) => set((x) => { x.spill = v; })} />
      <button className="btn small ghost" onClick={() => upd(c.id, (d) => { d.chroma = defaultChroma(); })}>Redefinir</button>
      <p className="hint">Para fundos comuns (sem tela verde), use “Remover fundo” com IA na barra de ferramentas.</p>
    </>
  );
}

// ------------------------------------------------------------------ blend
const BLENDS: { id: BlendMode; name: string }[] = [
  { id: 'normal', name: 'Normal' }, { id: 'multiply', name: 'Multiplicar' }, { id: 'screen', name: 'Tela' }, { id: 'overlay', name: 'Sobrepor' },
  { id: 'add', name: 'Adicionar' }, { id: 'softlight', name: 'Luz suave' }, { id: 'hardlight', name: 'Luz forte' }, { id: 'darken', name: 'Escurecer' },
  { id: 'lighten', name: 'Clarear' }, { id: 'difference', name: 'Diferença' }, { id: 'colordodge', name: 'Subexpor cor' }, { id: 'colorburn', name: 'Superexpor cor' }, { id: 'exclusion', name: 'Exclusão' },
];
export function BlendPanel() {
  const c = useTargetClip(false);
  if (!c) return <NoClip />;
  return (
    <>
      <Grid cols={4}>{BLENDS.map((b) => <Tile key={b.id} label={b.name} icon={<div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--grad)', mixBlendMode: b.id === 'add' ? 'plus-lighter' : b.id === 'softlight' ? 'soft-light' : b.id === 'hardlight' ? 'hard-light' : b.id === 'colordodge' ? 'color-dodge' : b.id === 'colorburn' ? 'color-burn' : b.id } as React.CSSProperties} />} active={c.blend === b.id} onClick={() => upd(c.id, (d) => { d.blend = b.id; })} />)}</Grid>
      <Slider label="Opacidade" value={c.transform.opacity} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd(c.id, (d) => { d.transform.opacity = v; }, 'op' + c.id)} />
    </>
  );
}

// ------------------------------------------------------------------ keyframes
const KF_PROPS: { id: AnimProp; name: string }[] = [
  { id: 'x', name: 'Posição X' }, { id: 'y', name: 'Posição Y' }, { id: 'scale', name: 'Escala' }, { id: 'rotation', name: 'Rotação' },
  { id: 'opacity', name: 'Opacidade' }, { id: 'blur', name: 'Desfoque' }, { id: 'volume', name: 'Volume' },
];
const EASES: { v: Ease; label: string }[] = [
  { v: 'linear', label: 'Linear' }, { v: 'easeInOut', label: 'Suave' }, { v: 'easeIn', label: 'Acelerar' }, { v: 'easeOut', label: 'Desacelerar' },
  { v: 'back', label: 'Recuo' }, { v: 'elastic', label: 'Elástico' }, { v: 'bounce', label: 'Quique' }, { v: 'hold', label: 'Segurar' },
];
export function KeyframesPanel() {
  const c = useTargetClip(false);
  const time = useEditor((s) => s.time);
  if (!c) return <NoClip />;
  const lt = time - c.start;
  const inside = lt >= 0 && lt <= c.duration;
  const baseOf = (p: AnimProp) => (p === 'volume' ? c.audio.volume : p === 'blur' ? 0 : (c.transform as unknown as Record<string, number>)[p]);
  const addAll = () => upd(c.id, (d) => {
    for (const p of ['x', 'y', 'scale', 'rotation', 'opacity'] as AnimProp[]) d.keyframes[p] = setKeyframe(d.keyframes[p], lt, evalKeyframes(d.keyframes[p], lt, baseOf(p)));
  });
  const presets: { name: string; apply: (d: Clip) => void }[] = [
    { name: 'Zoom in lento', apply: (d) => { d.keyframes.scale = [{ t: 0, v: 1, ease: 'easeInOut' }, { t: d.duration, v: 1.3, ease: 'linear' }]; } },
    { name: 'Zoom out lento', apply: (d) => { d.keyframes.scale = [{ t: 0, v: 1.3, ease: 'easeInOut' }, { t: d.duration, v: 1, ease: 'linear' }]; } },
    { name: 'Pan → ', apply: (d) => { d.keyframes.scale = [{ t: 0, v: 1.25, ease: 'linear' }]; d.keyframes.x = [{ t: 0, v: -0.1, ease: 'easeInOut' }, { t: d.duration, v: 0.1, ease: 'linear' }]; } },
    { name: 'Pan ←', apply: (d) => { d.keyframes.scale = [{ t: 0, v: 1.25, ease: 'linear' }]; d.keyframes.x = [{ t: 0, v: 0.1, ease: 'easeInOut' }, { t: d.duration, v: -0.1, ease: 'linear' }]; } },
    { name: 'Punch zoom', apply: (d) => { d.keyframes.scale = [{ t: 0, v: 1, ease: 'back' }, { t: Math.min(0.25, d.duration / 2), v: 1.25, ease: 'linear' }]; } },
    { name: 'Rotação 3D', apply: (d) => { d.keyframes.rotation = [{ t: 0, v: -8, ease: 'easeInOut' }, { t: d.duration, v: 8, ease: 'linear' }]; d.keyframes.scale = [{ t: 0, v: 1.15, ease: 'linear' }]; } },
  ];
  return (
    <>
      <p className="hint">Mova o cursor da linha do tempo e ajuste valores — keyframes são criados automaticamente onde houver ◆.</p>
      <div className="row">
        <button className="btn small primary" disabled={!inside} onClick={addAll}>◆ Adicionar keyframe aqui</button>
        <button className="btn small ghost" onClick={() => upd(c.id, (d) => { d.keyframes = {}; })}>Limpar tudo</button>
      </div>
      <Section title="Animações prontas">
        <div className="chips">{presets.map((p) => <button key={p.name} onClick={() => upd(c.id, p.apply)}>{p.name}</button>)}</div>
      </Section>
      <Section title="Propriedades">
        <div className="list">
          {KF_PROPS.map((p) => {
            const list = c.keyframes[p.id] ?? [];
            return (
              <div key={p.id} className="list-item" style={{ flexWrap: 'wrap' }}>
                <div className="grow"><b style={{ fontSize: 13 }}>{p.name}</b> <span className="hint">{list.length} ◆</span></div>
                <button className="btn small" disabled={!inside} onClick={() => upd(c.id, (d) => { d.keyframes[p.id] = setKeyframe(d.keyframes[p.id], lt, evalKeyframes(d.keyframes[p.id], lt, baseOf(p.id))); })}>◆ +</button>
                {list.length > 0 && <button className="btn small ghost" onClick={() => upd(c.id, (d) => { delete d.keyframes[p.id]; })}>Limpar</button>}
                {list.length > 1 && (
                  <div style={{ width: '100%', marginTop: 6 }}>
                    <Chips options={EASES} value={list[0].ease} onChange={(e) => upd(c.id, (d) => { d.keyframes[p.id] = d.keyframes[p.id]!.map((k) => ({ ...k, ease: e })); })} />
                  </div>
                )}
                {p.id === 'blur' && list.length > 0 && inside && (
                  <div style={{ width: '100%' }}>
                    <Slider label="Desfoque aqui" value={evalKeyframes(list, lt, 0)} min={0} max={1} step={0.01} onChange={(v) => upd(c.id, (d) => { d.keyframes.blur = setKeyframe(d.keyframes.blur, lt, v); }, 'kfblur')} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ transition
export function TransitionPanel() {
  const c = useTargetClip(false);
  const project = useEditor((s) => s.project!);
  const [cat, setCat] = useState('trend');
  if (!c || c.trackId !== 'main') return <p className="hint">Toque no botão “+” entre dois clipes da faixa principal.</p>;
  const mains = mainClips(project);
  const idx = mains.findIndex((x) => x.id === c.id);
  if (idx <= 0) return <p className="hint">Este é o primeiro clipe. Transições ficam entre dois clipes — toque no “+” entre eles.</p>;
  const prev = mains[idx - 1];
  const tr = c.transition;
  const maxD = Math.max(0.1, Math.min(prev.duration, c.duration) * 0.9);
  const list = cat === 'trend' ? TRENDING_TRANSITIONS.map((id) => TRANSITION_MAP.get(id)!) : TRANSITIONS.filter((t) => t.cat === cat);
  const apply = (id: string | null) => upd(c.id, (d) => {
    if (!id) { d.transition = null; return; }
    const def = TRANSITION_MAP.get(id)!;
    d.transition = { type: id, duration: Math.min(tr?.duration ?? 0.6, maxD), sound: tr && tr.type !== id && tr.sound !== (TRANSITION_MAP.get(tr.type)?.sound ?? null) ? tr.sound : def.sound, soundVolume: tr?.soundVolume ?? 0.8 };
  });
  const previewSound = (id: string) => {
    const ctx = audioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const s = ctx.createBufferSource();
    s.buffer = sfxBuffer(ctx, id, tr?.duration ?? 0.6);
    const g = ctx.createGain(); g.gain.value = tr?.soundVolume ?? 0.8;
    s.connect(g); g.connect(ctx.destination); s.start();
  };
  const applyAll = () => useEditor.getState().edit((p) => {
    const ms = mainClips(p);
    ms.forEach((m, i) => { if (i > 0 && tr) m.transition = { ...tr, duration: Math.min(tr.duration, Math.min(ms[i - 1].duration, m.duration) * 0.9) }; });
  });
  return (
    <>
      <Tabs tabs={TRANSITION_CATEGORIES.map((t) => ({ id: t.id, label: t.name }))} value={cat} onChange={setCat} />
      <Grid cols={4}>
        <Tile label="Nenhuma" icon="🚫" active={!tr} onClick={() => apply(null)} />
        {list.map((t) => <Tile key={t.id} label={t.name} icon={<TransitionIcon id={t.id} />} active={tr?.type === t.id} onClick={() => apply(t.id)} badge={t.sound ? '♪' : undefined} />)}
      </Grid>
      {tr && (
        <>
          <Slider label="Duração" value={Math.min(tr.duration, maxD)} min={0.1} max={maxD} step={0.05} format={(v) => `${v.toFixed(2)}s`} onChange={(v) => upd(c.id, (d) => { if (d.transition) d.transition.duration = v; }, 'trd')} />
          <Section title="Som da transição">
            <Grid cols={5}>
              <Tile label="Mudo" icon="🔇" active={!tr.sound} onClick={() => upd(c.id, (d) => { if (d.transition) d.transition.sound = null; })} />
              {SFX.map((s) => <Tile key={s.id} label={s.name} icon={s.icon} active={tr.sound === s.id} onClick={() => { upd(c.id, (d) => { if (d.transition) d.transition.sound = s.id; }); previewSound(s.id); }} />)}
            </Grid>
            {tr.sound && <Slider label="Volume do som" value={tr.soundVolume} min={0} max={1.5} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd(c.id, (d) => { if (d.transition) d.transition.soundVolume = v; }, 'trv')} />}
          </Section>
          <button className="btn small block" onClick={applyAll}>Aplicar a todos os cortes</button>
        </>
      )}
    </>
  );
}

function TransitionIcon({ id }: { id: string }) {
  const icons: Record<string, string> = { fade: '◐', 'fade-black': '◼', 'fade-white': '◻', flash: '⚡', 'zoom-in': '⤢', 'zoom-out': '⤡', spin: '↻', 'cross-zoom': '✣', 'whip-left': '⇇', 'whip-up': '⇈', shake: '💥', glitch: '📺', 'rgb-split': '🌈', pixelize: '▦', blur: '◌', ripple: '💧', swirl: '🌀', burn: '🔥', 'light-leak': '☀', warp: '◍', 'film-roll': '🎞', 'tv-off': '📡', heart: '♥', star: '★', 'circle-open': '◯', 'circle-close': '◉', diamond: '◆', squares: '▩', hexagons: '⬢', clock: '🕐', blinds: '☰', stripes: '≡', split: '⫼', flip: '⇋', 'rotate-3d': '⧈', squeeze: '⇥' };
  const dir: Record<string, string> = { left: '←', right: '→', up: '↑', down: '↓', diag: '⤡' };
  const m = id.match(/-(left|right|up|down|diag)$/);
  return <span style={{ fontSize: 22 }}>{icons[id] ?? (m ? dir[m[1]] : '⧓')}</span>;
}
