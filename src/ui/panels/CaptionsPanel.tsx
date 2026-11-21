import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGES, WHISPER_MODELS, alignScript, finalizeWords, parseSubtitles, transcribeProject } from '../../ai/transcribe';
import { CAPTION_CATEGORIES, CAPTION_PRESETS, PREVIEW_IDLE, applyPreset } from '../../engine/captionStyles';
import { drawCaptions } from '../../engine/textRender';
import { captionsToSrt } from '../../engine/exporter';
import { FONTS, onFontsChanged } from '../../engine/fonts';
import { emojiFor } from '../../engine/keywords';
import { uid } from '../../model/defaults';
import { formatTime, projectDuration } from '../../model/timeline';
import type { CaptionAnim, CaptionHighlight, CaptionStyle, CaptionWord } from '../../model/types';
import { useEditor } from '../../store/editor';
import { downloadBlob, pickFiles } from '../actions';
import { Chips, PALETTE, Section, Slider, Swatches, Tabs, Toggle } from '../components/ui';

type Tab = 'models' | 'color' | 'font' | 'emoji' | 'emph' | 'pause' | 'anim' | 'layout' | 'edit' | 'generate';

export function CaptionsPanel() {
  const hasWords = useEditor((s) => s.project!.captions.words.length > 0);
  const [tab, setTab] = useState<Tab>(hasWords ? 'models' : 'generate');
  return (
    <>
      <Tabs tabs={[
        { id: 'models', label: 'Modelos' }, { id: 'color', label: 'Cor' }, { id: 'font', label: 'Fonte' }, { id: 'emoji', label: 'Emojis' },
        { id: 'emph', label: 'Enfatizar' }, { id: 'pause', label: 'Pausas' }, { id: 'anim', label: 'Animação' }, { id: 'layout', label: 'Layout' },
        { id: 'edit', label: 'Editar texto' }, { id: 'generate', label: 'Gerar' },
      ]} value={tab} onChange={setTab} />
      {tab === 'generate' && <Generate onDone={() => setTab('models')} />}
      {tab === 'models' && <Models onEdit={() => setTab('font')} />}
      {tab !== 'generate' && tab !== 'models' && tab !== 'edit' && <Custom tab={tab} />}
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

const SAMPLE: CaptionWord[] = [
  { id: 's1', text: 'Quick', start: 0.5, end: 0.9 }, { id: 's2', text: 'brown', start: 0.9, end: 1.3 },
  { id: 's3', text: 'fox', start: 1.3, end: 1.7 }, { id: 's4', text: 'jumped', start: 1.7, end: 2.1, highlight: true },
];

/** Live preview rendered with the real caption engine (identical to the video output). */
function CaptionPreview({ style, height: h0 }: { style: CaptionStyle; height?: number }) {
  const height = h0 ?? (style.fitLines || (style.emphScale ?? 1) > 1.3 || style.wordsPerPage <= 2 ? 200 : 150);
  const ref = useRef<HTMLCanvasElement>(null);
  const [fontTick, setFontTick] = useState(0);
  useEffect(() => { const off = onFontsChanged(() => setFontTick((t) => t + 1)); return () => { off(); }; }, []);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round((c.clientWidth || 320) * dpr), H = Math.round(height * dpr);
    c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    const st: CaptionStyle = { ...style, x: 0.5, y: 0.5, rotation: 0, showUpcoming: true, animation: 'none', emoji: false, wordsPerPage: Math.max(style.wordsPerPage, 2), ...(PREVIEW_IDLE.has(style.preset) ? { highlight: 'none' as const } : {}) };
    drawCaptions(ctx, W, H, SAMPLE, st, 0.6, (W / 900) * (style.fitLines ? 0.8 : 1));
  }, [style, height, fontTick]);
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />;
}

const LS_KEY = 'magnata.captionStyles';
function loadSaved(): { id: string; name: string; style: CaptionStyle }[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
}

function swatchKeys(s: CaptionStyle): (keyof CaptionStyle)[] {
  return ['color', 'activeColor', s.bgMode !== 'none' ? 'bgColor' : s.strokeWidth > 0 ? 'strokeColor' : 'shadowColor', s.glowSize > 0 ? 'glowColor' : 'keywordColor'];
}
const toHex = (c: string) => {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('') : '#000000';
};

function Models({ onEdit }: { onEdit: () => void }) {
  const current = useEditor((s) => s.project!.captions.style);
  const [cat, setCat] = useState('featured');
  const [q, setQ] = useState('');
  const [saved, setSaved] = useState(loadSaved);
  const st = useEditor.getState;
  const apply = (style: CaptionStyle) => st().edit((d) => { d.captions.style = { ...style, x: d.captions.style.x, y: d.captions.style.y }; d.captions.enabled = true; });
  const list: { id: string; name: string; style: CaptionStyle; tag?: string; custom?: boolean }[] =
    cat === 'custom'
      ? saved.map((x) => ({ ...x, custom: true }))
      : CAPTION_PRESETS.filter((p) => cat === 'all' || p.cats?.includes(cat)).map((p) => ({ id: p.id, name: p.name, tag: p.tag, style: applyPreset(current, p.id) }));
  const shown = list.filter((x) => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase()));
  const saveCurrent = () => {
    const name = prompt('Nome do seu estilo', 'Meu estilo');
    if (!name) return;
    const next = [{ id: 'u' + Date.now(), name, style: { ...current, preset: 'u' + Date.now() } }, ...saved];
    setSaved(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* */ }
    setCat('custom');
  };
  return (
    <>
      <Chips scroll options={[{ v: 'custom', label: 'Personalizado' }, ...CAPTION_CATEGORIES.map((c) => ({ v: c.id, label: c.name }))]} value={cat} onChange={setCat} />
      <input className="field" style={{ margin: '10px 0' }} placeholder="🔍 Buscar estilos…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar estilos" />
      {cat === 'custom' && <button className="btn small block" style={{ marginBottom: 10 }} onClick={saveCurrent}>+ Salvar o estilo atual</button>}
      {cat === 'custom' && !saved.length && <p className="hint">Personalize um modelo e toque em “Salvar o estilo atual” para guardá-lo aqui.</p>}
      <div className="cap-cards">
        {shown.map((x) => {
          const active = current.preset === x.style.preset;
          return (
            <div key={x.id} className={`cap-card ${active ? 'active' : ''}`} data-testid={`cap-preset-${x.id}`}>
              <button className="cap-card-preview" onClick={() => apply(x.style)} aria-label={`Aplicar ${x.name}`}>
                <CaptionPreview style={x.style} />
              </button>
              <div className="cap-card-foot">
                <b>{x.name}</b>
                {x.tag && <span className="cap-tag">{x.tag}</span>}
                <div style={{ flex: 1 }} />
                <span className="cap-drop" aria-hidden="true">💧</span>
                {swatchKeys(x.style).map((k) => (
                  <label key={k} className="cap-sw" style={{ background: String(x.style[k]) }} title="Alterar cor">
                    <input type="color" value={toHex(String(x.style[k]))} onChange={(e) => { const v = e.target.value; st().edit((d) => { if (!active) d.captions.style = { ...x.style, x: d.captions.style.x, y: d.captions.style.y }; (d.captions.style as unknown as Record<string, unknown>)[k] = v; d.captions.enabled = true; }, 'capsw' + k); }} />
                  </label>
                ))}
                <button className="cap-edit" onClick={() => { if (!active) apply(x.style); onEdit(); }} aria-label={`Editar ${x.name}`}>✎</button>
                {x.custom && <button className="cap-edit" onClick={() => { const next = saved.filter((s) => s.id !== x.id); setSaved(next); try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* */ } }} aria-label="Excluir">✕</button>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="hint">A prévia usa o mesmo motor do vídeo final. Toque nas bolinhas para trocar as cores, ou no lápis para personalizar.</p>
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
  { v: 'scale', label: 'Aumentar' }, { v: 'font', label: 'Trocar fonte' }, { v: 'karaoke', label: 'Karaokê' }, { v: 'glow', label: 'Brilho' }, { v: 'outline', label: 'Contorno' },
];

function Custom({ tab }: { tab: Exclude<Tab, 'models' | 'edit' | 'generate'> }) {
  const s = useEditor((x) => x.project!.captions.style);
  const words = useEditor((x) => x.project!.captions.words);
  const set = (fn: (c: CaptionStyle) => void, key = 'cs') => useEditor.getState().edit((p) => fn(p.captions.style), key);
  return (
    <>
      <div style={{ borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg,#2a2340,#121220)', marginBottom: 10 }}><CaptionPreview style={s} height={120} /></div>
      {tab === 'font' && (
        <>
          <div className="font-list">
            {FONTS.map((f) => <button key={f.family} className={s.font === f.family ? 'on' : ''} style={{ fontFamily: `"${f.family}"` }} onClick={() => set((c) => { c.font = f.family; }, 'cf')}>{f.family}</button>)}
          </div>
          <Slider label="Tamanho" value={s.size} min={24} max={220} step={1} onChange={(v) => set((c) => { c.size = v; }, 'csz')} />
          <Chips options={[300, 400, 500, 600, 700, 800, 900].map((v) => ({ v, label: String(v) }))} value={s.weight} onChange={(v) => set((c) => { c.weight = v; })} />
          <Chips options={[{ v: 'none', label: 'Aa Normal' }, { v: 'upper', label: 'AA MAIÚSCULAS' }, { v: 'lower', label: 'aa minúsculas' }]} value={s.uppercase ? 'upper' : s.lowercase ? 'lower' : 'none'} onChange={(v) => set((c) => { c.uppercase = v === 'upper'; c.lowercase = v === 'lower'; })} />
          <Toggle label="Itálico" value={s.italic} onChange={(v) => set((c) => { c.italic = v; })} />
          <Toggle label="Remover pontuação" value={s.removePunctuation} onChange={(v) => set((c) => { c.removePunctuation = v; })} />
          <Slider label="Espaçamento entre letras" value={s.letterSpacing} min={-6} max={30} step={0.5} onChange={(v) => set((c) => { c.letterSpacing = v; }, 'cls')} />
          <Slider label="Altura da linha" value={s.lineHeight} min={0.8} max={2} step={0.02} onChange={(v) => set((c) => { c.lineHeight = v; }, 'clh')} />
        </>
      )}
      {tab === 'color' && (
        <>
          <Section title="Texto"><Swatches colors={PALETTE} value={s.color} onChange={(v) => set((c) => { c.color = v; }, 'cc')} /></Section>
          <Section title="Palavra falada (destaque)"><Swatches colors={PALETTE} value={s.activeColor} onChange={(v) => set((c) => { c.activeColor = v; if (c.highlight === 'none') c.highlight = 'color'; }, 'cac')} /></Section>
          {s.highlight === 'box' && <Section title="Caixa da palavra falada"><Swatches colors={PALETTE} value={s.activeBg} onChange={(v) => set((c) => { c.activeBg = v; }, 'cab')} /></Section>}
          <Section title="Gradiente" right={s.gradient ? <button className="btn small ghost" onClick={() => set((c) => { c.gradient = null; })}>Remover</button> : undefined}>
            <Swatches colors={PALETTE} value={s.gradient ?? ''} onChange={(v) => set((c) => { c.gradient = v; }, 'cg')} />
          </Section>
          <Section title="Contorno">
            <Swatches colors={PALETTE} value={s.strokeColor} onChange={(v) => set((c) => { c.strokeColor = v; if (!c.strokeWidth) c.strokeWidth = 6; }, 'csc')} />
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
            <Chips options={[{ v: 'none', label: 'Nenhum' }, { v: 'line', label: 'Por linha' }, { v: 'block', label: 'Bloco' }, { v: 'word', label: 'Por palavra' }]} value={s.bgMode} onChange={(v) => set((c) => { c.bgMode = v as CaptionStyle['bgMode']; if (c.bgOpacity === 0) c.bgOpacity = 0.85; })} />
            {s.bgMode !== 'none' && (
              <>
                <Swatches colors={PALETTE} value={s.bgColor} onChange={(v) => set((c) => { c.bgColor = v; }, 'cbc')} />
                <Slider label="Opacidade" value={s.bgOpacity} min={0} max={1} step={0.01} onChange={(v) => set((c) => { c.bgOpacity = v; }, 'cbo')} />
                <Slider label="Margem" value={s.bgPadding} min={0} max={60} step={1} onChange={(v) => set((c) => { c.bgPadding = v; }, 'cbp')} />
                <Slider label="Arredondamento" value={s.bgRadius} min={0} max={100} step={1} onChange={(v) => set((c) => { c.bgRadius = v; }, 'cbr')} />
              </>
            )}
          </Section>
        </>
      )}
      {tab === 'emoji' && (
        <>
          <Toggle label="Emojis automáticos" hint="Emoji contextual acima de cada frase" value={s.emoji} onChange={(v) => set((c) => { c.emoji = v; })} />
          <button className="btn small" onClick={() => useEditor.getState().edit((p) => { p.captions.words.forEach((w) => { w.emoji = emojiFor(w.text); }); })}>Recalcular emojis</button>
          <Section title="Emojis por palavra">
            <div className="list">
              {words.filter((w) => w.emoji).slice(0, 80).map((w) => (
                <div key={w.id} className="list-item">
                  <span style={{ fontSize: 22 }}>{w.emoji}</span>
                  <div className="grow">{w.text}</div>
                  <button className="btn small danger" onClick={() => useEditor.getState().edit((p) => { const x = p.captions.words.find((y) => y.id === w.id); if (x) x.emoji = undefined; })}>Remover</button>
                </div>
              ))}
              {!words.some((w) => w.emoji) && <p className="hint">Nenhum emoji ainda. Ative os emojis automáticos ou recalcule.</p>}
            </div>
          </Section>
        </>
      )}
      {tab === 'emph' && (
        <>
          <Section title="Palavra falada"><Chips options={HIGHLIGHTS} value={s.highlight} onChange={(v) => set((c) => { c.highlight = v; })} /></Section>
          {s.highlight === 'scale' && <Slider label="Aumento" value={s.activeScale} min={1} max={1.8} step={0.01} onChange={(v) => set((c) => { c.activeScale = v; }, 'cas')} />}
          <Slider label="Opacidade das outras palavras" value={s.inactiveOpacity} min={0.1} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set((c) => { c.inactiveOpacity = v; }, 'cio')} />
          <Toggle label="Mostrar palavras futuras" hint="Desligado: as palavras aparecem conforme são faladas" value={s.showUpcoming} onChange={(v) => set((c) => { c.showUpcoming = v; })} />
          <Section title="Palavras enfatizadas">
            <Toggle label="Enfatizar palavras importantes" hint="Números, palavras de impacto e as marcadas com ★" value={s.keywordColors} onChange={(v) => set((c) => { c.keywordColors = v; })} />
            <Toggle label="Escolher 1 palavra por frase automaticamente" value={s.emphAuto} onChange={(v) => set((c) => { c.emphAuto = v; })} />
            <div className="hint">Cor (positivas / negativas)</div>
            <Swatches colors={PALETTE} value={s.keywordColor} onChange={(v) => set((c) => { c.keywordColor = v; }, 'ckc')} />
            <div style={{ height: 8 }} />
            <Swatches colors={PALETTE} value={s.keywordColor2} onChange={(v) => set((c) => { c.keywordColor2 = v; }, 'ckc2')} />
            <div className="hint" style={{ marginTop: 10 }}>Fonte da ênfase</div>
            <div className="font-list">
              <button className={!s.emphFont ? 'on' : ''} onClick={() => set((c) => { c.emphFont = null; })}>Mesma</button>
              {FONTS.map((f) => <button key={f.family} className={s.emphFont === f.family ? 'on' : ''} style={{ fontFamily: `"${f.family}"` }} onClick={() => set((c) => { c.emphFont = f.family; }, 'cef')}>{f.family}</button>)}
            </div>
            <Chips options={[300, 400, 600, 700, 800, 900].map((v) => ({ v, label: String(v) }))} value={s.emphWeight} onChange={(v) => set((c) => { c.emphWeight = v; })} />
            <Toggle label="Ênfase em itálico" value={s.emphItalic} onChange={(v) => set((c) => { c.emphItalic = v; })} />
            <Slider label="Tamanho da ênfase" value={s.emphScale} min={0.8} max={2} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set((c) => { c.emphScale = v; }, 'ces')} />
            <p className="hint">Marque palavras específicas com ★ na aba “Editar texto”.</p>
          </Section>
        </>
      )}
      {tab === 'pause' && (
        <>
          <Slider label="Nova frase após pausa de" value={s.pauseSplit} min={0.2} max={2} step={0.05} format={(v) => `${v.toFixed(2)}s`} onChange={(v) => set((c) => { c.pauseSplit = v; }, 'cps')} />
          <Slider label="Máximo de palavras na tela" value={s.wordsPerPage} min={1} max={12} step={1} onChange={(v) => set((c) => { c.wordsPerPage = v; }, 'cwp')} />
          <p className="hint">As legendas trocam de frase sempre que há um silêncio maior que o valor acima — assim o texto acompanha o ritmo da fala.</p>
          <button className="btn small" onClick={() => useEditor.getState().openPanel('ai')}>✂️ Remover pausas do vídeo (IA)</button>
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
          <Slider label="Caracteres por linha" value={s.maxCharsPerLine} min={4} max={40} step={1} onChange={(v) => set((c) => { c.maxCharsPerLine = v; }, 'cmc')} />
          <Slider label="Posição vertical" value={s.y} min={0.05} max={0.95} step={0.005} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set((c) => { c.y = v; }, 'cy')} />
          <Slider label="Posição horizontal" value={s.x} min={0.05} max={0.95} step={0.005} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set((c) => { c.x = v; }, 'cx')} />
          <Slider label="Rotação" value={s.rotation} min={-30} max={30} step={0.5} center={0} format={(v) => `${v}°`} onChange={(v) => set((c) => { c.rotation = v; }, 'cr')} />
          <Chips options={[{ v: 'left', label: 'Esquerda' }, { v: 'center', label: 'Centro' }, { v: 'right', label: 'Direita' }, { v: 'stagger', label: 'Escalonado' }]} value={s.align} onChange={(v) => set((c) => { c.align = v as CaptionStyle['align']; })} />
          <Toggle label="Linhas com a mesma largura" hint="Estilo pôster: cada linha é ampliada para preencher" value={s.fitLines} onChange={(v) => set((c) => { c.fitLines = v; })} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn small" onClick={() => set((c) => { c.y = 0.2; })}>Topo</button>
            <button className="btn small" onClick={() => set((c) => { c.y = 0.5; })}>Meio</button>
            <button className="btn small" onClick={() => set((c) => { c.y = 0.72; })}>Inferior</button>
          </div>
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
