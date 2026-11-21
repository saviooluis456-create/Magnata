import { useCallback, useEffect, useRef, useState } from 'react';
import { Player } from '../engine/player';
import { animatedState } from '../engine/animations';
import { renderText } from '../engine/textRender';
import { onFontsChanged } from '../engine/fonts';
import { clearTextCache } from '../engine/textRender';
import { ensureUrl } from '../engine/media';
import { formatTime, mediaById, projectDuration, visualClipsAt } from '../model/timeline';
import type { Clip, Project } from '../model/types';
import { selectedClip, useEditor, type Panel } from '../store/editor';
import { importFiles, pickFiles, session } from './actions';
import { Icon } from './components/ui';
import Timeline from './Timeline';
import Panels from './panels/Panels';

export default function Editor() {
  const project = useEditor((s) => s.project)!;
  const playing = useEditor((s) => s.playing);
  const panel = useEditor((s) => s.panel);
  const toast = useEditor((s) => s.toast);
  const busy = useEditor((s) => s.busy);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const st = useEditor.getState;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [desk, setDesk] = useState(() => window.matchMedia('(min-width: 900px)').matches);

  // player lifecycle
  useEffect(() => {
    const canvas = canvasRef.current!;
    let player: Player;
    try {
      player = new Player(canvas, useEditor.getState().project!);
    } catch (e) {
      st().notify((e as Error).message, 'error');
      return;
    }
    session.player = player;
    player.onTime = (t) => useEditor.setState({ time: t });
    player.onEnded = () => useEditor.setState({ playing: false });
    player.onError = (m) => st().notify(m, 'error');
    // preload media blobs
    useEditor.getState().project!.media.forEach((m) => ensureUrl(m.id).then(() => player.invalidate()));
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.project && s.project !== prev.project) player.setProject(s.project);
      if (s.time !== prev.time && !player.playing && Math.abs(s.time - player.time) > 1e-4) player.seek(s.time);
      if (s.playing !== prev.playing) { if (s.playing) player.play(); else player.pause(); }
    });
    const offFonts = onFontsChanged(() => { clearTextCache(); player.invalidate(); });
    return () => { unsub(); offFonts(); player.dispose(); session.player = null; };
  }, [st]);

  // stage sizing (fit project aspect into preview area)
  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const p = useEditor.getState().project!;
      const ar = p.width / p.height;
      let w = r.width - 16, h = r.height - 16;
      if (w / h > ar) w = h * ar; else h = w / ar;
      setStage({ w: Math.max(10, Math.floor(w)), h: Math.max(10, Math.floor(h)) });
    });
    ro.observe(el);
    const mq = window.matchMedia('(min-width: 900px)');
    const onMq = () => setDesk(mq.matches);
    mq.addEventListener('change', onMq);
    return () => { ro.disconnect(); mq.removeEventListener('change', onMq); };
  }, [project.aspect]);

  useEffect(() => {
    if (!stage.w || !session.player) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // cap preview resolution for performance (render cost scales with pixels)
    const maxPx = 1280 * 720;
    let w = stage.w * dpr, h = stage.h * dpr;
    const k = Math.min(1, Math.sqrt(maxPx / (w * h)));
    w *= k; h *= k;
    session.player.resize(w, h);
  }, [stage]);

  // keyboard shortcuts (desktop / external keyboards)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const s = useEditor.getState();
      if (e.code === 'Space') { e.preventDefault(); s.setPlaying(!s.playing); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); s.redo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); s.duplicateSelected(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { if (s.selectedId) { e.preventDefault(); s.deleteSelected(); } }
      else if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) s.splitAtPlayhead();
      else if (e.key === 'ArrowLeft') { s.setPlaying(false); s.setTime(s.time - (e.shiftKey ? 1 : 1 / (s.project?.fps ?? 30))); }
      else if (e.key === 'ArrowRight') { s.setPlaying(false); s.setTime(s.time + (e.shiftKey ? 1 : 1 / (s.project?.fps ?? 30))); }
      else if (e.key === 'Escape') { if (s.panel) s.openPanel(null); else s.select(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // pause playback when app goes to background
  useEffect(() => {
    const onVis = () => { if (document.hidden) useEditor.getState().setPlaying(false); };
    document.addEventListener('visibilitychange', onVis);
    const onUnload = () => { useEditor.getState().setPlaying(false); };
    window.addEventListener('pagehide', onUnload);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', onUnload); };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => useEditor.setState({ toast: null }), toast.kind === 'error' ? 5000 : 2500);
    return () => clearTimeout(h);
  }, [toast]);

  const empty = project.clips.length === 0 && project.captions.words.length === 0;
  const addFirst = async () => importFiles(await pickFiles('video/*,image/*', true), 'main');

  const side = <Panels />;

  return (
    <div className="editor">
      <div className="topbar">
        <button className="icon-btn" onClick={() => st().close()} aria-label="Voltar"><Icon name="back" /></button>
        <div className="title">
          <input value={project.name} onChange={(e) => { const v = e.target.value; st().edit((p) => { p.name = v; }, 'rename'); }} aria-label="Nome do projeto" />
        </div>
        <button className="icon-btn" onClick={() => st().openPanel('format')} aria-label="Formato" title="Formato"><Icon name="format" /></button>
        <button className="export-btn" onClick={() => { st().setPlaying(false); st().openPanel('export'); }} data-testid="open-export"><Icon name="export" size={18} />Exportar</button>
      </div>

      <div className="preview-wrap" ref={wrapRef}>
        <div className="preview-stage" style={{ width: stage.w, height: stage.h }}>
          <canvas ref={canvasRef} data-testid="preview" />
          <Gestures project={project} w={stage.w} h={stage.h} />
        </div>
        {empty && (
          <div className="preview-empty">
            <div>
              <div style={{ fontSize: 40 }}>🎬</div>
              <div>Comece adicionando vídeos ou fotos</div>
              <button className="btn primary" onClick={addFirst} data-testid="add-media-empty"><Icon name="plus" /> Adicionar mídia</button>
            </div>
          </div>
        )}
      </div>

      <Transport playing={playing} canUndo={canUndo} canRedo={canRedo} compact={!desk && !!panel} />
      {(desk || !panel) && <Timeline />}
      {(desk || !panel) && <Toolbar panel={panel} />}
      {desk ? <div className="desk-side">{panel ? side : <div className="desk-side-empty">Selecione uma ferramenta abaixo<br />ou um clipe na linha do tempo.</div>}</div> : panel && side}

      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.msg}</div>}
      {busy && (
        <div className="busy">
          <div className="busy-card">
            <div className="spinner" />
            <div>{busy.msg}</div>
            {busy.progress !== undefined && <div className="progress" style={{ marginTop: 12 }}><i style={{ width: `${Math.round(busy.progress * 100)}%` }} /></div>}
          </div>
        </div>
      )}
    </div>
  );
}

function TimeDisplay() {
  const time = useEditor((s) => s.time);
  const dur = useEditor((s) => (s.project ? projectDuration(s.project) : 0));
  return <div className="time"><b>{formatTime(time)}</b> / {formatTime(dur)}</div>;
}

function Scrub() {
  const time = useEditor((s) => s.time);
  const dur = useEditor((s) => (s.project ? projectDuration(s.project) : 0));
  return (
    <input className="scrub" type="range" min={0} max={Math.max(0.01, dur)} step={0.01} value={Math.min(time, dur)} aria-label="Posição"
      style={{ ['--lo' as string]: '0%', ['--hi' as string]: `${dur ? (time / dur) * 100 : 0}%` }}
      onChange={(e) => { const s = useEditor.getState(); s.setPlaying(false); s.setTime(parseFloat(e.target.value)); }} />
  );
}

function Transport({ playing, canUndo, canRedo, compact }: { playing: boolean; canUndo: boolean; canRedo: boolean; compact?: boolean }) {
  const st = useEditor.getState;
  if (compact) {
    return (
      <div className="transport">
        <button className="play-btn" onClick={() => st().setPlaying(!playing)} aria-label={playing ? 'Pausar' : 'Reproduzir'} data-testid="play">
          <Icon name={playing ? 'pause' : 'play'} size={24} />
        </button>
        <Scrub />
        <TimeDisplay />
      </div>
    );
  }
  return (
    <div className="transport">
      <TimeDisplay />
      <div className="spacer" />
      <button className="play-btn" onClick={() => st().setPlaying(!playing)} aria-label={playing ? 'Pausar' : 'Reproduzir'} data-testid="play">
        <Icon name={playing ? 'pause' : 'play'} size={26} />
      </button>
      <div className="spacer" />
      <button className="icon-btn" disabled={!canUndo} onClick={() => st().undo()} aria-label="Desfazer" data-testid="undo"><Icon name="undo" /></button>
      <button className="icon-btn" disabled={!canRedo} onClick={() => st().redo()} aria-label="Refazer" data-testid="redo"><Icon name="redo" /></button>
      <button className="icon-btn" onClick={() => { const el = document.querySelector('.preview-wrap') as HTMLElement; if (document.fullscreenElement) document.exitFullscreen(); else el?.requestFullscreen?.().catch(() => {}); }} aria-label="Tela cheia"><Icon name="fullscreen" /></button>
    </div>
  );
}

// ------------------------------------------------------------------ preview gestures
function layerRect(p: Project, c: Clip, t: number, W: number, H: number) {
  const st = animatedState(c, t);
  let sw = p.width, sh = p.height;
  if (c.kind === 'text' && c.text) {
    const ref = Math.min(p.width, p.height) / 1080;
    const r = renderText(c.text, ref, 1);
    sw = r.w; sh = r.h;
  } else {
    const m = mediaById(p, c.mediaId);
    if (m && m.width && m.height) { sw = m.width; sh = m.height; }
  }
  const tf = c.transform;
  const cw = sw * (1 - tf.cropL - tf.cropR), ch = sh * (1 - tf.cropT - tf.cropB);
  let w: number, h: number;
  if (c.kind === 'text') { w = cw; h = ch; }
  else if (c.fit === 'fill') { w = p.width; h = p.height; }
  else { const s = c.fit === 'cover' ? Math.max(p.width / cw, p.height / ch) : Math.min(p.width / cw, p.height / ch); w = cw * s; h = ch * s; }
  w *= st.scale * st.scaleX; h *= st.scale * st.scaleY;
  const k = W / p.width;
  return { cx: (p.width / 2 + st.x * p.width) * k, cy: (p.height / 2 + st.y * p.height) * k, w: w * k, h: h * k * (H / W) / (p.height / p.width), rot: st.rotation, st };
}

function hit(r: ReturnType<typeof layerRect>, x: number, y: number) {
  const a = (-r.rot * Math.PI) / 180;
  const dx = x - r.cx, dy = y - r.cy;
  const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= r.w / 2 + 10 && Math.abs(ly) <= r.h / 2 + 10;
}

function Gestures({ project, w, h }: { project: Project; w: number; h: number }) {
  const sel = useEditor(selectedClip);
  const time = useEditor((s) => s.time);
  const [guides, setGuides] = useState({ h: false, v: false });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ x: number; y: number; scale: number; rot: number; dist: number; ang: number; mx: number; my: number; moved: boolean; id: string } | null>(null);
  const capRef = useRef<{ y: number; x: number; py: number; px: number } | null>(null);

  const visible = sel && time >= sel.start - 0.01 && time <= sel.start + sel.duration + 0.01 && (sel.kind === 'video' || sel.kind === 'image' || sel.kind === 'text' || sel.kind === 'color');
  const rect = visible ? layerRect(project, sel!, time, w, h) : null;

  const pos = (e: React.PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  const onDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = pos(e);
    pointers.current.set(e.pointerId, p);
    const s = useEditor.getState();
    if (s.playing) return;
    const proj = s.project!;
    let target = s.project!.clips.find((c) => c.id === s.selectedId);
    // tap selects the top-most layer under the finger
    if (pointers.current.size === 1) {
      const vis = visualClipsAt(proj, s.time).filter((c) => c.kind !== 'audio').reverse();
      const hitClip = vis.find((c) => hit(layerRect(proj, c, s.time, w, h), p.x, p.y));
      if (hitClip && hitClip.id !== s.selectedId && !(target && hit(layerRect(proj, target, s.time, w, h), p.x, p.y))) { s.select(hitClip.id); target = hitClip; }
      // captions drag (when panel open)
      if (!hitClip && s.panel === 'captions' && proj.captions.words.length) {
        capRef.current = { x: p.x, y: p.y, px: proj.captions.style.x, py: proj.captions.style.y };
        return;
      }
    }
    if (!target) return;
    const tf = target.transform;
    const pts = [...pointers.current.values()];
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    const ang = pts.length > 1 ? Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) : 0;
    start.current = { x: p.x, y: p.y, scale: tf.scale, rot: tf.rotation, dist, ang, mx: tf.x, my: tf.y, moved: false, id: target.id };
  }, [w, h]);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = pos(e);
    pointers.current.set(e.pointerId, p);
    const s = useEditor.getState();
    if (capRef.current) {
      const c = capRef.current;
      const nx = Math.max(0.05, Math.min(0.95, c.px + (p.x - c.x) / w));
      const ny = Math.max(0.05, Math.min(0.95, c.py + (p.y - c.y) / h));
      s.edit((d) => { d.captions.style.x = Math.abs(nx - 0.5) < 0.02 ? 0.5 : nx; d.captions.style.y = ny; }, 'capmove');
      return;
    }
    const st0 = start.current;
    if (!st0) return;
    const pts = [...pointers.current.values()];
    if (pts.length >= 2 && st0.dist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ang = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      let rot = st0.rot + ((ang - st0.ang) * 180) / Math.PI;
      for (const snap of [-180, -90, 0, 90, 180]) if (Math.abs(rot - snap) < 4) rot = snap;
      const scale = Math.max(0.05, Math.min(20, st0.scale * (dist / st0.dist)));
      s.updateClip(st0.id, (c) => { c.transform.scale = scale; c.transform.rotation = rot; }, 'gesture:' + st0.id);
      st0.moved = true;
      return;
    }
    if (pts.length === 2 && st0.dist === 0) {
      // second finger added after start: re-init pinch baseline
      const c = s.project!.clips.find((x) => x.id === st0.id);
      if (c) { st0.dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); st0.ang = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x); st0.scale = c.transform.scale; st0.rot = c.transform.rotation; }
      return;
    }
    const dx = (p.x - st0.x) / w, dy = (p.y - st0.y) / h;
    if (!st0.moved && Math.hypot(p.x - st0.x, p.y - st0.y) < 4) return;
    st0.moved = true;
    let nx = st0.mx + dx, ny = st0.my + dy;
    const gh = Math.abs(ny) < 0.015, gv = Math.abs(nx) < 0.015;
    if (gh) ny = 0;
    if (gv) nx = 0;
    setGuides({ h: gh, v: gv });
    s.updateClip(st0.id, (c) => { c.transform.x = nx; c.transform.y = ny; }, 'gesture:' + st0.id);
  }, [w, h]);

  const onUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      const s = useEditor.getState();
      if (start.current && !start.current.moved && !capRef.current) {
        // tap without movement on empty area: deselect / toggle play
        const p = pos(e);
        const proj = s.project!;
        const vis = visualClipsAt(proj, s.time).filter((c) => c.kind !== 'audio');
        if (!vis.some((c) => hit(layerRect(proj, c, s.time, w, h), p.x, p.y))) s.select(null);
      } else if (!start.current && !capRef.current) {
        s.setPlaying(!s.playing);
      }
      start.current = null;
      capRef.current = null;
      setGuides({ h: false, v: false });
    } else if (start.current) {
      // one finger remains: rebase drag
      const p = [...pointers.current.values()][0];
      const c = useEditor.getState().project!.clips.find((x) => x.id === start.current!.id);
      if (c) start.current = { ...start.current, x: p.x, y: p.y, mx: c.transform.x, my: c.transform.y, dist: 0 };
    }
  }, [w, h]);

  const onWheel = (e: React.WheelEvent) => {
    const s = useEditor.getState();
    const c = s.project!.clips.find((x) => x.id === s.selectedId);
    if (!c) return;
    const k = Math.exp(-e.deltaY * 0.001);
    s.updateClip(c.id, (d) => { d.transform.scale = Math.max(0.05, Math.min(20, d.transform.scale * k)); }, 'wheel:' + c.id);
  };

  return (
    <div className="gesture" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel} data-testid="gesture">
      {rect && (
        <div className="sel-box" style={{ left: rect.cx - rect.w / 2, top: rect.cy - rect.h / 2, width: rect.w, height: rect.h, transform: `rotate(${rect.rot}deg)` }}>
          <i /><i /><i /><i />
        </div>
      )}
      {(guides.h || guides.v) && (
        <div className="safe-guides">{guides.h && <div className="h" />}{guides.v && <div className="v" />}</div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ toolbar
interface ToolDef { id: string; label: string; icon: string; panel?: Panel; action?: () => void; on?: boolean }

function Toolbar({ panel }: { panel: Panel }) {
  const sel = useEditor(selectedClip);
  const st = useEditor.getState;
  const open = (p: Panel) => () => st().openPanel(p);

  let tools: ToolDef[];
  if (!sel) {
    tools = [
      { id: 'media', label: 'Mídia', icon: 'media', panel: 'media' },
      { id: 'audio', label: 'Áudio', icon: 'audio', panel: 'audio' },
      { id: 'text', label: 'Texto', icon: 'text', panel: 'text' },
      { id: 'captions', label: 'Legendas', icon: 'captions', panel: 'captions' },
      { id: 'effects', label: 'Efeitos', icon: 'effects', panel: 'effects' },
      { id: 'filters', label: 'Filtros', icon: 'filters', panel: 'filters' },
      { id: 'ai', label: 'IA', icon: 'ai', panel: 'ai' },
      { id: 'overlay', label: 'Sobrepor', icon: 'overlay', panel: 'overlay' },
      { id: 'stickers', label: 'Stickers', icon: 'sticker', panel: 'stickers' },
      { id: 'adjust', label: 'Ajustar', icon: 'adjust', panel: 'adjust' },
      { id: 'format', label: 'Formato', icon: 'format', panel: 'format' },
      { id: 'background', label: 'Fundo', icon: 'background', panel: 'background' },
      { id: 'record', label: 'Narrar', icon: 'voice', panel: 'record' },
    ];
  } else {
    const isVisual = sel.kind === 'video' || sel.kind === 'image' || sel.kind === 'color';
    const hasAudio = sel.kind === 'audio' || sel.kind === 'video';
    tools = [
      { id: 'back', label: '', icon: 'back', action: () => st().select(null) },
      { id: 'split', label: 'Dividir', icon: 'split', action: () => st().splitAtPlayhead() },
      ...(sel.kind === 'text' ? [{ id: 'textEdit', label: 'Editar', icon: 'text', panel: 'textEdit' as Panel }] : []),
      ...(sel.kind !== 'text' ? [{ id: 'speed', label: 'Velocidade', icon: 'speed', panel: 'speed' as Panel }] : []),
      ...(hasAudio ? [{ id: 'volume', label: 'Volume', icon: 'volume', panel: 'volume' as Panel }, { id: 'voice', label: 'Voz', icon: 'voice', panel: 'voice' as Panel }] : []),
      ...(sel.kind !== 'audio' ? [
        { id: 'animation', label: 'Animação', icon: 'animation', panel: 'animation' as Panel },
        { id: 'effects', label: 'Efeitos', icon: 'effects', panel: 'effects' as Panel },
        { id: 'transform', label: 'Transformar', icon: 'transform', panel: 'transform' as Panel },
        { id: 'keyframes', label: 'Keyframes', icon: 'keyframe', panel: 'keyframes' as Panel },
      ] : []),
      ...(isVisual ? [
        { id: 'filters', label: 'Filtros', icon: 'filters', panel: 'filters' as Panel },
        { id: 'adjust', label: 'Ajustar', icon: 'adjust', panel: 'adjust' as Panel },
        { id: 'mask', label: 'Máscara', icon: 'mask', panel: 'mask' as Panel },
        { id: 'chroma', label: 'Chroma', icon: 'chroma', panel: 'chroma' as Panel },
        { id: 'bgremove', label: 'Remover fundo', icon: 'ai', action: () => st().updateClip(sel.id, (c) => { c.bgRemove = !c.bgRemove; }), on: sel.bgRemove },
        { id: 'blend', label: 'Mesclar', icon: 'blend', panel: 'blend' as Panel },
      ] : []),
      ...(sel.trackId === 'main' ? [{ id: 'transition', label: 'Transição', icon: 'transition', panel: 'transition' as Panel }] : []),
      ...(sel.kind === 'video' ? [{ id: 'freeze', label: 'Congelar', icon: 'freeze', action: () => freezeFrame(sel.id) }] : []),
      ...(sel.kind === 'video' ? [{ id: 'detach', label: 'Extrair áudio', icon: 'detach', action: () => detachAudio(sel.id) }] : []),
      ...(sel.trackId === 'main' && isVisual ? [{ id: 'tooverlay', label: 'Sobrepor', icon: 'overlay', action: () => toOverlay(sel.id) }] : []),
      { id: 'dup', label: 'Duplicar', icon: 'copy', action: () => st().duplicateSelected() },
      ...(sel.mediaId ? [{ id: 'replace', label: 'Substituir', icon: 'replace', action: () => replaceMedia(sel.id) }] : []),
      { id: 'del', label: 'Excluir', icon: 'trash', action: () => st().deleteSelected() },
    ];
  }
  return (
    <div className="toolbar" role="toolbar">
      {tools.map((t) => (
        <button key={t.id} className={`tool ${t.id === 'back' ? 'back' : ''} ${(t.panel && panel === t.panel) || t.on ? 'on' : ''}`} onClick={t.action ?? open(t.panel!)} data-testid={`tool-${t.id}`}>
          <Icon name={t.icon} />
          {t.label && <span>{t.label}</span>}
        </button>
      ))}
    </div>
  );
}

async function freezeFrame(clipId: string) {
  const s = useEditor.getState();
  const player = session.player;
  if (!player) return;
  s.setPlaying(false);
  const p = s.project!;
  const c = p.clips.find((x) => x.id === clipId)!;
  if (s.time <= c.start || s.time >= c.start + c.duration) { s.notify('Posicione o cursor sobre o clipe'); return; }
  const el = player.elementFor(clipId) as HTMLVideoElement | null;
  if (!el || !el.videoWidth) { s.notify('Aguarde o vídeo carregar', 'error'); return; }
  const cv = document.createElement('canvas');
  cv.width = el.videoWidth; cv.height = el.videoHeight;
  cv.getContext('2d')!.drawImage(el, 0, 0);
  const blob: Blob = await new Promise((r) => cv.toBlob((b) => r(b!), 'image/jpeg', 0.95));
  const { importBlob } = await import('../engine/media');
  const asset = await importBlob(blob, 'congelado.jpg');
  const { makeClip } = await import('../model/defaults');
  const t = s.time;
  s.splitAtPlayhead();
  s.edit((d) => {
    if (!d.media.find((m) => m.id === asset.id)) d.media.push(asset);
    const orig = d.clips.find((x) => x.id === clipId)!;
    const fr = makeClip('image', orig.trackId, { mediaId: asset.id, name: 'Congelado', start: t - 0.0003, duration: 2, fit: orig.fit, transform: structuredClone(orig.transform), adjust: structuredClone(orig.adjust), filter: orig.filter });
    if (orig.trackId !== 'main') {
      // shift following clips on the same track
      d.clips.filter((x) => x.trackId === orig.trackId && x.start >= t - 0.001).forEach((x) => (x.start += 2));
      fr.start = t;
    }
    d.clips.push(fr);
  });
  s.notify('Quadro congelado por 2s', 'ok');
}

function detachAudio(clipId: string) {
  const s = useEditor.getState();
  const c = s.project!.clips.find((x) => x.id === clipId);
  const m = c && mediaById(s.project!, c.mediaId);
  if (!c || !m?.hasAudio) { s.notify('Este clipe não tem áudio'); return; }
  s.edit((d) => {
    const orig = d.clips.find((x) => x.id === clipId)!;
    orig.audio.muted = true;
    let track = d.tracks.find((t) => t.kind === 'audio' && !d.clips.some((x) => x.trackId === t.id && x.start < orig.start + orig.duration && x.start + x.duration > orig.start));
    if (!track) { track = { id: 'ta' + Date.now().toString(36), kind: 'audio', name: 'Áudio extraído', muted: false, hidden: false, locked: false }; d.tracks.push(track); }
    d.clips.push({ ...structuredClone(orig), id: 'c' + Math.random().toString(36).slice(2, 9), kind: 'audio', trackId: track.id, transition: null, audio: { ...orig.audio, muted: false }, effects: [], name: 'Áudio · ' + orig.name });
  });
  s.notify('Áudio extraído para uma faixa separada', 'ok');
}

function toOverlay(clipId: string) {
  const s = useEditor.getState();
  s.edit((d) => {
    const c = d.clips.find((x) => x.id === clipId)!;
    const start = c.start;
    let track = d.tracks.find((t) => t.kind === 'video' && !d.clips.some((x) => x.trackId === t.id && x.start < start + c.duration && x.start + x.duration > start));
    if (!track) { track = { id: 'tv' + Date.now().toString(36), kind: 'video', name: 'Sobreposição', muted: false, hidden: false, locked: false }; d.tracks.push(track); }
    c.trackId = track.id;
    c.start = start;
    c.transition = null;
    c.transform.scale = Math.min(c.transform.scale, 0.6);
  });
}

async function replaceMedia(clipId: string) {
  const files = await pickFiles('video/*,image/*,audio/*', false);
  if (!files.length) return;
  const s = useEditor.getState();
  const { importFile } = await import('../engine/media');
  try {
    s.setBusy({ msg: 'Substituindo…' });
    const a = await importFile(files[0]);
    s.edit((d) => {
      if (!d.media.find((m) => m.id === a.id)) d.media.push(a);
      const c = d.clips.find((x) => x.id === clipId)!;
      if ((c.kind === 'audio') !== (a.kind === 'audio')) throw new Error('Tipo de mídia incompatível');
      c.mediaId = a.id; c.kind = a.kind; c.name = a.name; c.in = 0;
      if (a.kind !== 'image') c.duration = Math.min(c.duration, a.duration / c.speed);
    });
  } catch (e) { s.notify((e as Error).message, 'error'); }
  finally { s.setBusy(null); }
}
