import { useMemo, useRef, useState } from 'react';
import { LANGUAGES, WHISPER_MODELS, alignScript, finalizeWords, parseSubtitles, transcribeProject } from '../../ai/transcribe';
import { CAPTION_PRESETS, applyPreset } from '../../engine/captionStyles';
import { captionsToSrt } from '../../engine/exporter';
import { FONTS } from '../../engine/fonts';
import { emojiFor } from '../../engine/keywords';
import { defaultCaptionStyle, uid } from '../../model/defaults';
import { formatTime, projectDuration } from '../../model/timeline';
import type { CaptionAnim, CaptionHighlight, CaptionStyle } from '../../model/types';
import { useEditor } from '../../store/editor';
import { downloadBlob, pickFiles } from '../actions';
import { Chips, Grid, PALETTE, Section, Slider, Swatches, Tabs, Toggle } from '../components/ui';

type Tab = 'generate' | 'styles' | 'custom' | 'edit';

export function CaptionsPanel() {
  const hasWords = useEditor((s) => s.project!.captions.words.length > 0);
  const [tab, setTab] = useState<Tab>(hasWords ? 'styles' : 'generate');
  return (
    <>
      <Tabs tabs={[{ id: 'generate', label: 'Gerar' }, { id: 'styles', label: 'Estilos' }, { id: 'custom', label: 'Personalizar' }, { id: 'edit', label: 'Editar texto' }]} value={tab} onChange={setTab} />
      {tab === 'generate' && <Generate onDone={() => setTab('styles')} />}
      {tab === 'styles' && <Styles />}
      {tab === 'custom' && <Custom />}
      {tab === 'edit' && <EditWords />}
    </>
  );
}

function Generate({ onDone }: { onDone: () => void }) {
  const lang = useEditor((s) => s.project!.captions.language);
  const words = useEditor((s) => s.project!.captions.words.length);
  const enabled = useEditor((s) => s.project!.captions.enabled);
  const [model, setModel] = useState(WHISPER_MODELS[0].id);
  const [script, setScript] = useState('');
  const abort = useRef<AbortController | null>(null);
  const st = useEditor.getState;

  const run = async () => {
    const s = st();
    if (projectDuration(s.project!) <= 0) { s.notify('Adicione um vídeo com fala primeiro', 'error'); return; }
    s.setPlaying(false);
    abort.current = new AbortController();
    try {
      s.setBusy({ msg: 'Preparando…' });
      const w = await transcribeProject(s.project!, model, lang, { onStatus: (msg, progress) => s.setBusy({ msg, progress }) }, abort.current.signal);
      if (!w.length) { s.notify('Nenhuma fala detectada', 'error'); return; }
      s.setCaptions(w);
      s.notify(`${w.length} palavras transcritas ✨`, 'ok');
      onDone();
    } catch (e) {
      s.notify('Falha na transcrição: ' + (e as Error).message + ' — verifique sua conexão (o modelo de IA é baixado na 1ª vez) ou use “Do roteiro”.', 'error');
    } finally { s.setBusy(null); }
  };

  const fromScript = async () => {
    const s = st();
    if (!script.trim()) return;
    s.setBusy({ msg: 'Sincronizando texto com a fala…' });
    try {
      const w = await alignScript(s.project!, script);
      s.setCaptions(w);
      s.notify('Legendas sincronizadas', 'ok');
      onDone();
    } finally { s.setBusy(null); }
  };

  const importSrt = async () => {
    const files = await pickFiles('.srt,.vtt,text/vtt,application/x-subrip', false);
    if (!files.length) return;
    const w = parseSubtitles(await files[0].text());
    if (!w.length) { st().notify('Arquivo de legenda inválido', 'error'); return; }
    st().setCaptions(w);
    onDone();
  };

  return (
    <>
      <Section title="Legendas automáticas (IA)">
        <div className="row">
          <select className="field" value={lang} onChange={(e) => st().edit((p) => { p.captions.language = e.target.value; })} aria-label="Idioma">
            {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select className="field" value={model} onChange={(e) => setModel(e.target.value)} aria-label="Modelo">
            {WHISPER_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.size}</option>)}
          </select>
        </div>
        <button className="btn primary block" style={{ marginTop: 10 }} onClick={run} data-testid="auto-captions">✨ Gerar legendas automáticas</button>
        <p className="hint">Reconhecimento de fala com IA (Whisper) roda no seu aparelho, com tempo por palavra. O modelo é baixado só na primeira vez.</p>
      </Section>
      <Section title="Do roteiro (sem internet)">
        <textarea className="field" placeholder="Cole aqui o texto falado no vídeo…" value={script} onChange={(e) => setScript(e.target.value)} />
        <button className="btn block" style={{ marginTop: 8 }} onClick={fromScript} disabled={!script.trim()}>Sincronizar com a fala</button>
      </Section>
      <div className="row">
        <button className="btn small" onClick={importSrt}>Importar SRT/VTT</button>
        {words > 0 && <button className="btn small" onClick={() => downloadBlob(new Blob([captionsToSrt(st().project!)], { type: 'text/plain' }), 'legendas.srt')}>Baixar SRT</button>}
      </div>
      {words > 0 && (
        <>
          <Toggle label="Mostrar legendas" value={enabled} onChange={(v) => st().edit((p) => { p.captions.enabled = v; })} />
          <button className="btn small danger" onClick={() => { if (confirm('Apagar todas as legendas?')) st().setCaptions([]); }}>Apagar legendas</button>
        </>
      )}
    </>
  );
}

function PresetPreview({ s }: { s: CaptionStyle }) {
  const words = ['ISSO', 'MUDA', 'TUDO'];
  return (
    <div className="cap-preset" style={{ fontFamily: `"${s.font}"`, fontWeight: s.weight, fontStyle: s.italic ? 'italic' : 'normal', fontSize: 13, letterSpacing: s.letterSpacing / 6 }}>
      <span style={{ background: s.bgMode === 'block' || s.bgMode === 'line' ? hexA(s.bgColor, s.bgOpacity) : undefined, padding: s.bgMode !== 'none' ? '2px 4px' : 0, borderRadius: 4 }}>
        {words.map((w, i) => {
          const active = i === 1;
          const isKw = s.keywordColors && i === 2;
          const color = active && s.highlight !== 'none' && s.highlight !== 'karaoke' && s.highlight !== 'box' ? s.activeColor : active && s.highlight === 'box' ? s.activeColor : isKw ? s.keywordColor : s.color === 'rgba(255,255,255,0)' ? 'transparent' : s.color;
          const text = s.uppercase ? w : w.charAt(0) + w.slice(1).toLowerCase();
          return (
            <span key={i} style={{
              color, margin: '0 2px', display: 'inline-block',
              transform: active && s.highlight === 'scale' ? `scale(${s.activeScale})` : undefined,
              background: active && s.highlight === 'box' ? s.activeBg : s.bgMode === 'word' ? hexA(s.bgColor, s.bgOpacity) : undefined,
              padding: (active && s.highlight === 'box') || s.bgMode === 'word' ? '1px 3px' : 0, borderRadius: 3,
              WebkitTextStroke: s.strokeWidth ? `${Math.min(2, s.strokeWidth / 6)}px ${active && s.highlight === 'outline' ? s.activeColor : s.strokeColor}` : undefined,
              textShadow: s.glowSize ? `0 0 6px ${active && s.highlight === 'glow' ? s.activeColor : s.glowColor}` : s.shadowBlur ? '0 1px 3px rgba(0,0,0,.8)' : undefined,
              textDecoration: active && s.highlight === 'underline' ? `underline 2px ${s.activeColor}` : undefined,
              backgroundImage: s.gradient && !active ? `linear-gradient(${s.color}, ${s.gradient})` : undefined,
              WebkitBackgroundClip: s.gradient && !active ? 'text' : undefined,
            } as React.CSSProperties}>{s.highlight === 'karaoke' && i === 0 ? <span style={{ color: s.activeColor }}>{text}</span> : text}</span>
          );
        })}
      </span>
    </div>
  );
}

function hexA(hex: string, a: number) {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function Styles() {
  const style = useEditor((s) => s.project!.captions.style);
  const st = useEditor.getState;
  return (
    <>
      <Grid cols={3}>
        {CAPTION_PRESETS.map((p) => {
          const s = { ...defaultCaptionStyle(), ...p.style };
          return (
            <button key={p.id} className={`tile ${style.preset === p.id ? 'active' : ''}`} onClick={() => st().edit((d) => { d.captions.style = applyPreset(d.captions.style, p.id); d.captions.enabled = true; })} data-testid={`cap-preset-${p.id}`}>
              <div className="tile-icon" style={{ aspectRatio: '1.4' }}><PresetPreview s={s} /></div>
              <div className="tile-label">{p.name}</div>
              {p.tag && <span className="tile-badge">{p.tag}</span>}
            </button>
          );
        })}
      </Grid>
      <p className="hint">Arraste as legendas na pré-visualização (com este painel aberto) para reposicionar.</p>
    </>
  );
}

const ANIMS: { v: CaptionAnim; label: string }[] = [
  { v: 'none', label: 'Nenhuma' }, { v: 'pop', label: 'Pop' }, { v: 'bounce', label: 'Quicar' }, { v: 'fade', label: 'Surgir' }, { v: 'slide-up', label: 'Subir' },
  { v: 'typewriter', label: 'Digitar' }, { v: 'zoom', label: 'Zoom' }, { v: 'shake', label: 'Tremer' }, { v: 'blur-in', label: 'Foco' }, { v: 'glitch', label: 'Glitch' },
  { v: 'wave', label: 'Onda' }, { v: 'drop', label: 'Cair' }, { v: 'flip', label: 'Virar' }, { v: 'stretch', label: 'Esticar' }, { v: 'rise', label: 'Elevar' },
];
const HIGHLIGHTS: { v: CaptionHighlight; label: string }[] = [
  { v: 'none', label: 'Nenhum' }, { v: 'color', label: 'Cor' }, { v: 'box', label: 'Caixa' }, { v: 'underline', label: 'Sublinhado' },
  { v: 'scale', label: 'Aumentar' }, { v: 'karaoke', label: 'Karaokê' }, { v: 'glow', label: 'Brilho' }, { v: 'outline', label: 'Contorno' },
];

function Custom() {
  const s = useEditor((x) => x.project!.captions.style);
  const [tab, setTab] = useState<'text' | 'highlight' | 'anim' | 'layout' | 'effects'>('text');
  const set = (fn: (c: CaptionStyle) => void, key = 'cs') => useEditor.getState().edit((p) => fn(p.captions.style), key);
  return (
    <>
      <Chips options={[{ v: 'text', label: 'Fonte' }, { v: 'highlight', label: 'Destaque' }, { v: 'anim', label: 'Animação' }, { v: 'layout', label: 'Layout' }, { v: 'effects', label: 'Efeitos' }]} value={tab} onChange={(v) => setTab(v as typeof tab)} />
      {tab === 'text' && (
        <>
          <div className="font-list" style={{ marginTop: 10 }}>
            {FONTS.map((f) => <button key={f.family} className={s.font === f.family ? 'on' : ''} style={{ fontFamily: `"${f.family}"` }} onClick={() => set((c) => { c.font = f.family; }, 'cf')}>{f.family}</button>)}
          </div>
          <Slider label="Tamanho" value={s.size} min={24} max={220} step={1} onChange={(v) => set((c) => { c.size = v; }, 'csz')} />
          <Chips options={[400, 600, 700, 800, 900].map((v) => ({ v, label: String(v) }))} value={s.weight} onChange={(v) => set((c) => { c.weight = v; })} />
          <Toggle label="MAIÚSCULAS" value={s.uppercase} onChange={(v) => set((c) => { c.uppercase = v; })} />
          <Toggle label="Itálico" value={s.italic} onChange={(v) => set((c) => { c.italic = v; })} />
          <Toggle label="Remover pontuação" value={s.removePunctuation} onChange={(v) => set((c) => { c.removePunctuation = v; })} />
          <Section title="Cor do texto"><Swatches colors={PALETTE} value={s.color} onChange={(v) => set((c) => { c.color = v; }, 'cc')} /></Section>
          <Section title="Gradiente" right={s.gradient ? <button className="btn small ghost" onClick={() => set((c) => { c.gradient = null; })}>Remover</button> : undefined}>
            <Swatches colors={PALETTE} value={s.gradient ?? ''} onChange={(v) => set((c) => { c.gradient = v; }, 'cg')} />
          </Section>
          <Slider label="Espaçamento" value={s.letterSpacing} min={-5} max={30} step={0.5} onChange={(v) => set((c) => { c.letterSpacing = v; }, 'cls')} />
          <Slider label="Altura da linha" value={s.lineHeight} min={0.8} max={2} step={0.05} onChange={(v) => set((c) => { c.lineHeight = v; }, 'clh')} />
        </>
      )}
      {tab === 'highlight' && (
        <>
          <Section title="Palavra falada"><Chips options={HIGHLIGHTS} value={s.highlight} onChange={(v) => set((c) => { c.highlight = v; })} /></Section>
          <Section title="Cor de destaque"><Swatches colors={PALETTE} value={s.activeColor} onChange={(v) => set((c) => { c.activeColor = v; }, 'cac')} /></Section>
          {s.highlight === 'box' && <Section title="Cor da caixa"><Swatches colors={PALETTE} value={s.activeBg} onChange={(v) => set((c) => { c.activeBg = v; }, 'cab')} /></Section>}
          {s.highlight === 'scale' && <Slider label="Aumento" value={s.activeScale} min={1} max={1.8} step={0.01} onChange={(v) => set((c) => { c.activeScale = v; }, 'cas')} />}
          <Slider label="Opacidade das outras palavras" value={s.inactiveOpacity} min={0.1} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set((c) => { c.inactiveOpacity = v; }, 'cio')} />
          <Toggle label="Mostrar palavras futuras" hint="Desligado: as palavras aparecem conforme são faladas" value={s.showUpcoming} onChange={(v) => set((c) => { c.showUpcoming = v; })} />
          <Section title="Palavras-chave automáticas">
            <Toggle label="Colorir palavras importantes" hint="Números, palavras de impacto e negações" value={s.keywordColors} onChange={(v) => set((c) => { c.keywordColors = v; })} />
            {s.keywordColors && (
              <>
                <div className="hint">Positivas / impacto</div>
                <Swatches colors={PALETTE} value={s.keywordColor} onChange={(v) => set((c) => { c.keywordColor = v; }, 'ckc')} />
                <div className="hint">Negativas</div>
                <Swatches colors={PALETTE} value={s.keywordColor2} onChange={(v) => set((c) => { c.keywordColor2 = v; }, 'ckc2')} />
              </>
            )}
            <Toggle label="Emojis automáticos" hint="Adiciona emoji contextual acima da frase" value={s.emoji} onChange={(v) => set((c) => { c.emoji = v; })} />
          </Section>
        </>
      )}
      {tab === 'anim' && (
        <>
          <Chips options={ANIMS} value={s.animation} onChange={(v) => set((c) => { c.animation = v; })} />
          <Slider label="Velocidade da animação" value={s.animSpeed} min={0.3} max={3} step={0.05} format={(v) => `${v.toFixed(2)}x`} onChange={(v) => set((c) => { c.animSpeed = v; }, 'casp')} />
        </>
      )}
      {tab === 'layout' && (
        <>
          <Slider label="Palavras por vez" value={s.wordsPerPage} min={1} max={12} step={1} onChange={(v) => set((c) => { c.wordsPerPage = v; }, 'cwp')} />
          <Slider label="Caracteres por linha" value={s.maxCharsPerLine} min={6} max={40} step={1} onChange={(v) => set((c) => { c.maxCharsPerLine = v; }, 'cmc')} />
          <Slider label="Posição vertical" value={s.y} min={0.05} max={0.95} step={0.005} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set((c) => { c.y = v; }, 'cy')} />
          <Slider label="Posição horizontal" value={s.x} min={0.05} max={0.95} step={0.005} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set((c) => { c.x = v; }, 'cx')} />
          <Slider label="Rotação" value={s.rotation} min={-30} max={30} step={0.5} center={0} format={(v) => `${v}°`} onChange={(v) => set((c) => { c.rotation = v; }, 'cr')} />
          <Chips options={[{ v: 'left', label: 'Esquerda' }, { v: 'center', label: 'Centro' }, { v: 'right', label: 'Direita' }]} value={s.align} onChange={(v) => set((c) => { c.align = v as CaptionStyle['align']; })} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn small" onClick={() => set((c) => { c.y = 0.2; })}>Topo</button>
            <button className="btn small" onClick={() => set((c) => { c.y = 0.5; })}>Meio</button>
            <button className="btn small" onClick={() => set((c) => { c.y = 0.72; })}>Inferior</button>
          </div>
        </>
      )}
      {tab === 'effects' && (
        <>
          <Section title="Contorno">
            <Swatches colors={PALETTE} value={s.strokeColor} onChange={(v) => set((c) => { c.strokeColor = v; }, 'csc')} />
            <Slider label="Espessura" value={s.strokeWidth} min={0} max={24} step={0.5} onChange={(v) => set((c) => { c.strokeWidth = v; }, 'csw')} />
          </Section>
          <Section title="Sombra">
            <Slider label="Desfoque" value={s.shadowBlur} min={0} max={50} step={1} onChange={(v) => set((c) => { c.shadowBlur = v; }, 'csb')} />
            <Slider label="Deslocamento Y" value={s.shadowY} min={-20} max={20} step={1} center={0} onChange={(v) => set((c) => { c.shadowY = v; }, 'csy')} />
            <Slider label="Deslocamento X" value={s.shadowX} min={-20} max={20} step={1} center={0} onChange={(v) => set((c) => { c.shadowX = v; }, 'csx')} />
          </Section>
          <Section title="Brilho (glow)">
            <Swatches colors={PALETTE} value={s.glowColor} onChange={(v) => set((c) => { c.glowColor = v; if (!c.glowSize) c.glowSize = 20; }, 'cgc')} />
            <Slider label="Intensidade" value={s.glowSize} min={0} max={60} step={1} onChange={(v) => set((c) => { c.glowSize = v; }, 'cgs')} />
          </Section>
          <Section title="Fundo">
            <Chips options={[{ v: 'none', label: 'Nenhum' }, { v: 'line', label: 'Por linha' }, { v: 'block', label: 'Bloco' }, { v: 'word', label: 'Por palavra' }]} value={s.bgMode} onChange={(v) => set((c) => { c.bgMode = v as CaptionStyle['bgMode']; })} />
            {s.bgMode !== 'none' && (
              <>
                <Swatches colors={PALETTE} value={s.bgColor} onChange={(v) => set((c) => { c.bgColor = v; }, 'cbc')} />
                <Slider label="Opacidade" value={s.bgOpacity} min={0} max={1} step={0.01} onChange={(v) => set((c) => { c.bgOpacity = v; }, 'cbo')} />
                <Slider label="Margem" value={s.bgPadding} min={0} max={60} step={1} onChange={(v) => set((c) => { c.bgPadding = v; }, 'cbp')} />
                <Slider label="Arredondamento" value={s.bgRadius} min={0} max={60} step={1} onChange={(v) => set((c) => { c.bgRadius = v; }, 'cbr')} />
              </>
            )}
          </Section>
        </>
      )}
    </>
  );
}

function EditWords() {
  const words = useEditor((s) => s.project!.captions.words);
  const time = useEditor((s) => s.time);
  const [limit, setLimit] = useState(150);
  const st = useEditor.getState;
  const sorted = useMemo(() => [...words].sort((a, b) => a.start - b.start), [words]);
  const setWord = (id: string, fn: (w: (typeof words)[number]) => void, key = 'w') => st().edit((p) => { const w = p.captions.words.find((x) => x.id === id); if (w) fn(w); }, key + id);
  if (!words.length) return <p className="hint">Gere ou importe legendas primeiro.</p>;
  return (
    <>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn small" onClick={() => {
          const t = st().time;
          st().edit((p) => { p.captions.words.push({ id: uid('w'), text: 'nova', start: t, end: t + 0.4 }); p.captions.words = finalizeWords(p.captions.words); });
        }}>+ Palavra no cursor</button>
        <button className="btn small" onClick={() => st().edit((p) => { p.captions.words.forEach((w) => { w.emoji = emojiFor(w.text); }); })}>Recalcular emojis</button>
        <button className="btn small" onClick={() => {
          const d = parseFloat(prompt('Deslocar todas as legendas (segundos, ex: -0.2)', '0') ?? '0');
          if (!isNaN(d) && d) st().edit((p) => { p.captions.words.forEach((w) => { w.start = Math.max(0, w.start + d); w.end = Math.max(w.start + 0.05, w.end + d); }); });
        }}>Sincronia ±</button>
      </div>
      <div className="list">
        {sorted.slice(0, limit).map((w) => {
          const active = time >= w.start && time < w.end;
          return (
            <div key={w.id} className={`word-row ${active ? 'active' : ''}`}>
              <input value={w.text} onChange={(e) => setWord(w.id, (x) => { x.text = e.target.value; })} onFocus={() => st().setTime(w.start + 0.01)} aria-label="Palavra" />
              <input type="number" step={0.05} value={w.start.toFixed(2)} onChange={(e) => setWord(w.id, (x) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { x.start = Math.max(0, v); if (x.end <= x.start) x.end = x.start + 0.1; } }, 'ws')} aria-label="Início" title={formatTime(w.start)} />
              <input type="number" step={0.05} value={w.end.toFixed(2)} onChange={(e) => setWord(w.id, (x) => { const v = parseFloat(e.target.value); if (!isNaN(v)) x.end = Math.max(x.start + 0.05, v); }, 'we')} aria-label="Fim" />
              <button className={`btn small ${w.highlight ? 'primary' : ''}`} onClick={() => setWord(w.id, (x) => { x.highlight = !x.highlight; })} title="Destacar palavra" aria-label="Destacar">★</button>
              <button className="btn small danger" onClick={() => st().edit((p) => { p.captions.words = p.captions.words.filter((x) => x.id !== w.id); })} aria-label="Remover">✕</button>
            </div>
          );
        })}
      </div>
      {sorted.length > limit && <button className="btn small block" style={{ marginTop: 8 }} onClick={() => setLimit(limit + 200)}>Mostrar mais ({sorted.length - limit})</button>}
    </>
  );
}
