import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildPages } from '../engine/textRender';
import { clipEnd, mainClips, mediaById, projectDuration, snapTime } from '../model/timeline';
import type { Clip, MediaAsset, Project, Track } from '../model/types';
import { useEditor } from '../store/editor';
import { importFiles, pickFiles } from './actions';
import { Icon } from './components/ui';

export default function Timeline() {
  const project = useEditor((s) => s.project)!;
  const zoom = useEditor((s) => s.zoom);
  const selectedId = useEditor((s) => s.selectedId);
  const snap = useEditor((s) => s.snap);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(360);
  const programmatic = useRef(false);
  const userScrolling = useRef(false);
  const dur = projectDuration(project);
  const half = viewW / 2;
  const innerW = Math.max(dur * zoom, 1) + viewW;

  useLayoutEffect(() => {
    const el = scrollRef.current!;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // time -> scroll
  useEffect(() => {
    const el = scrollRef.current!;
    const apply = (t: number, z: number) => {
      if (userScrolling.current) return;
      const target = t * z;
      if (Math.abs(el.scrollLeft - target) > 0.5) { programmatic.current = true; el.scrollLeft = target; }
    };
    apply(useEditor.getState().time, useEditor.getState().zoom);
    return useEditor.subscribe((s, prev) => { if (s.time !== prev.time || s.zoom !== prev.zoom || s.project !== prev.project) apply(s.time, s.zoom); });
  }, []);

  // scroll -> time
  const onScroll = () => {
    const el = scrollRef.current!;
    if (programmatic.current) { programmatic.current = false; return; }
    const s = useEditor.getState();
    if (s.playing) s.setPlaying(false);
    userScrolling.current = true;
    s.setTime(Math.max(0, Math.min(projectDuration(s.project!), el.scrollLeft / s.zoom)));
    clearTimeout((onScroll as unknown as { t?: number }).t);
    (onScroll as unknown as { t?: number }).t = window.setTimeout(() => { userScrolling.current = false; }, 120);
  };

  // pinch / ctrl+wheel zoom
  useEffect(() => {
    const el = scrollRef.current!;
    let startDist = 0, startZoom = 60;
    const ts = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        startZoom = useEditor.getState().zoom;
      }
    };
    const tm = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        useEditor.getState().setZoom(startZoom * (d / startDist));
      }
    };
    const te = () => { startDist = 0; };
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); const s = useEditor.getState(); s.setZoom(s.zoom * Math.exp(-e.deltaY * 0.01)); }
    };
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', te);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te); el.removeEventListener('wheel', wheel); };
  }, []);

  const mains = mainClips(project);
  const tracks = project.tracks.filter((t) => t.kind !== 'main');
  const order: Track['kind'][] = ['video', 'text', 'audio'];
  const sortedTracks = [...tracks].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const tall = sortedTracks.length > 1 || project.captions.words.length > 0;

  return (
    <div className={`timeline ${tall ? 'tall' : ''}`}>
      <div className="tl-scroll" ref={scrollRef} onScroll={onScroll} data-testid="timeline">
        <div className="tl-inner" style={{ width: innerW }} onClick={(e) => { if (e.target === e.currentTarget) useEditor.getState().select(null); }}>
          <Ruler dur={dur} zoom={zoom} offset={half} markers={project.markers} />
          <div className="tl-row main" style={{ marginLeft: half }}>
            {mains.map((c, i) => (
              <ClipView key={c.id} clip={c} project={project} zoom={zoom} selected={c.id === selectedId} index={i} mainCount={mains.length} />
            ))}
            {mains.slice(1).map((c) => (
              <button key={'tr' + c.id} className={`tr-btn ${c.transition ? 'has' : ''}`} style={{ left: c.start * zoom }}
                onClick={(e) => { e.stopPropagation(); const s = useEditor.getState(); s.select(c.id); useEditor.setState({ panel: 'transition' }); }}
                aria-label="Transição" data-testid="transition-btn">
                {c.transition ? '⧓' : '+'}
              </button>
            ))}
            <button className="add-main" style={{ left: dur > 0 ? mains.length ? clipEnd(mains[mains.length - 1]) * zoom + 10 : 0 : 0 }}
              onClick={async (e) => { e.stopPropagation(); importFiles(await pickFiles('video/*,image/*'), 'main'); }} aria-label="Adicionar" data-testid="add-main">
              <Icon name="plus" />
            </button>
          </div>
          {sortedTracks.map((t) => (
            <div key={t.id} className={`tl-row ${t.kind === 'audio' ? '' : 'small'}`} style={{ marginLeft: half, height: t.kind === 'audio' ? 40 : t.kind === 'text' ? 30 : 40 }} data-track={t.id} data-kind={t.kind}>
              {project.clips.filter((c) => c.trackId === t.id).map((c) => (
                <ClipView key={c.id} clip={c} project={project} zoom={zoom} selected={c.id === selectedId} />
              ))}
              <TrackLabel track={t} />
            </div>
          ))}
          {project.captions.words.length > 0 && <CaptionRow project={project} zoom={zoom} offset={half} />}
          <div style={{ height: 12 }} />
        </div>
      </div>
      <div className="playhead" />
      <div className="tl-tools">
        <button onClick={() => { const s = useEditor.getState(); s.setZoom(s.zoom / 1.5); }} aria-label="Afastar"><Icon name="zoomout" size={16} /></button>
        <button onClick={() => useEditor.getState().zoomToFit(scrollRef.current?.clientWidth ?? 360)} aria-label="Ajustar à tela" style={{ fontSize: 11, fontWeight: 700 }}>⟷</button>
        <button onClick={() => { const s = useEditor.getState(); s.setZoom(s.zoom * 1.5); }} aria-label="Aproximar"><Icon name="zoomin" size={16} /></button>
        <button className={snap ? 'on' : ''} onClick={() => useEditor.setState({ snap: !snap })} aria-label="Ímã" title="Ímã (encaixe)">🧲</button>
      </div>
    </div>
  );
}

function TrackLabel({ track }: { track: Track }) {
  const st = useEditor.getState;
  return (
    <div className="tl-row-label" style={{ position: 'absolute', left: -46, pointerEvents: 'auto' }}>
      {track.kind === 'audio' && (
        <button onClick={(e) => { e.stopPropagation(); st().edit((p) => { const t = p.tracks.find((x) => x.id === track.id)!; t.muted = !t.muted; }); }} aria-label="Silenciar faixa" style={{ opacity: 0.8 }}>
          <Icon name={track.muted ? 'mute' : 'volume'} size={16} />
        </button>
      )}
      {track.kind === 'video' && (
        <button onClick={(e) => { e.stopPropagation(); st().edit((p) => { const t = p.tracks.find((x) => x.id === track.id)!; t.hidden = !t.hidden; }); }} aria-label="Ocultar faixa" style={{ opacity: 0.8 }}>
          <Icon name={track.hidden ? 'eyeoff' : 'eye'} size={16} />
        </button>
      )}
    </div>
  );
}

const Ruler = memo(function Ruler({ dur, zoom, offset, markers }: { dur: number; zoom: number; offset: number; markers: number[] }) {
  const ticks = useMemo(() => {
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const major = steps.find((s) => s * zoom >= 70) ?? 600;
    const minor = steps.slice().reverse().find((s) => s < major && s * zoom >= 12) ?? major;
    const out: { t: number; major: boolean }[] = [];
    const end = dur + 10;
    for (let t = 0; t <= end; t += minor) {
      const r = Math.round(t * 1000) / 1000;
      out.push({ t: r, major: Math.abs(r / major - Math.round(r / major)) < 1e-6 });
      if (out.length > 3000) break;
    }
    return out;
  }, [dur, zoom]);
  const label = (t: number) => (t >= 60 ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : t % 1 ? `${t.toFixed(1)}s` : `${t}s`);
  return (
    <div className="tl-ruler">
      {ticks.map((k) => (
        <div key={k.t} className={`tl-tick ${k.major ? '' : 'minor'}`} style={{ left: offset + k.t * zoom }}>{k.major ? label(k.t) : ''}</div>
      ))}
      {markers.map((m, i) => <div key={i} className="marker" style={{ left: offset + m * zoom }} />)}
    </div>
  );
});

function CaptionRow({ project, zoom, offset }: { project: Project; zoom: number; offset: number }) {
  const pages = buildPages(project.captions.words, Math.max(1, project.captions.style.wordsPerPage), project.captions.style.pauseSplit);
  return (
    <div className="tl-row small" style={{ marginLeft: offset, height: 26 }} onClick={() => useEditor.setState({ panel: 'captions', selectedId: null })}>
      {pages.map((p, i) => (
        <div key={i} className="cap-chunk" style={{ left: p.start * zoom, width: Math.max(4, (p.end - p.start) * zoom - 2) }}>{p.words.map((w) => w.text).join(' ')}</div>
      ))}
      <div className="tl-row-label" style={{ position: 'absolute', left: -46 }}><Icon name="captions" size={16} /></div>
    </div>
  );
}

// ------------------------------------------------------------------ clip view
interface DragState {
  mode: 'move' | 'trimL' | 'trimR' | 'reorder';
  startX: number;
  startY: number;
  lastX: number;
  origStart: number;
  pointerId: number;
  moved: boolean;
}

const ClipView = memo(function ClipView({ clip, project, zoom, selected, index, mainCount }: { clip: Clip; project: Project; zoom: number; selected: boolean; index?: number; mainCount?: number }) {
  const m = mediaById(project, clip.mediaId);
  const isMain = clip.trackId === 'main';
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const lp = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ghost, setGhost] = useState<number | null>(null);
  const left = clip.start * zoom;
  const width = Math.max(4, clip.duration * zoom - (isMain ? 1 : 0));

  const snapPoints = () => {
    const s = useEditor.getState();
    const pts = [s.time, 0];
    for (const c of s.project!.clips) if (c.id !== clip.id) pts.push(c.start, clipEnd(c));
    pts.push(...s.project!.markers);
    return pts;
  };

  const onDown = (e: React.PointerEvent, mode: DragState['mode']) => {
    e.stopPropagation();
    const s = useEditor.getState();
    if (s.playing) s.setPlaying(false);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, lastX: e.clientX, origStart: clip.start, pointerId: e.pointerId, moved: false };
    if (mode !== 'move') (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    else if (selected && !isMain) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (mode === 'move' && isMain && (mainCount ?? 0) > 1) {
      lp.current = setTimeout(() => {
        if (drag.current && !drag.current.moved) {
          drag.current.mode = 'reorder';
          try { ref.current?.setPointerCapture(e.pointerId); } catch { /* */ }
          setGhost(0);
          navigator.vibrate?.(15);
        }
      }, 380);
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 5 || Math.abs(e.clientY - d.startY) > 5) {
      if (!d.moved && d.mode === 'move' && lp.current) { clearTimeout(lp.current); lp.current = null; }
      d.moved = true;
    }
    const s = useEditor.getState();
    if (d.mode === 'reorder') { e.preventDefault(); setGhost(dx); return; }
    if (d.mode === 'trimL' || d.mode === 'trimR') {
      const delta = (e.clientX - d.lastX) / s.zoom;
      d.lastX = e.clientX;
      if (delta !== 0) s.trimClip(clip.id, d.mode === 'trimL' ? 'start' : 'end', delta);
      return;
    }
    if (d.mode === 'move' && selected && !isMain && d.moved) {
      let ns = Math.max(0, d.origStart + dx / s.zoom);
      const thr = s.snap ? 8 / s.zoom : 0;
      const pts = snapPoints();
      const a = snapTime(ns, pts, thr);
      const b = snapTime(ns + clip.duration, pts, thr) - clip.duration;
      ns = Math.abs(a - ns) <= Math.abs(b - ns) ? a : b;
      // vertical: switch to another track of the same kind
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-track]') as HTMLElement | null;
      const tk = s.project!.tracks.find((t) => t.id === clip.trackId)?.kind;
      const target = el && el.dataset.kind === tk ? el.dataset.track : undefined;
      s.moveClip(clip.id, ns, target);
    }
  };

  const onUp = (e: React.PointerEvent) => {
    if (lp.current) { clearTimeout(lp.current); lp.current = null; }
    const d = drag.current;
    drag.current = null;
    const s = useEditor.getState();
    if (!d) return;
    if (d.mode === 'reorder') {
      setGhost(null);
      const mains = mainClips(s.project!);
      const centerT = (clip.start + clip.duration / 2) + (e.clientX - d.startX) / s.zoom;
      let idx = mains.filter((c) => c.id !== clip.id && c.start + c.duration / 2 < centerT).length;
      idx = Math.max(0, Math.min(mains.length - 1, idx));
      if (idx !== index) s.reorderMain(clip.id, idx);
      return;
    }
    if (!d.moved && d.mode === 'move') s.select(selected ? clip.id : clip.id);
  };

  const thumbs = m?.thumbs ?? (m?.thumb ? [m.thumb] : []);
  const stripH = isMain ? 52 : 36;
  const thumbW = m && m.width && m.height ? Math.max(20, (m.width / m.height) * stripH) : stripH;
  const count = clip.kind === 'video' || clip.kind === 'image' ? Math.min(60, Math.ceil(width / thumbW)) : 0;

  const badges: string[] = [];
  if (clip.speed !== 1) badges.push(`${clip.speed}x`);
  if (clip.effects.length) badges.push(`✦${clip.effects.length}`);
  if (clip.filter) badges.push('◑');
  if (clip.audio.muted && clip.kind !== 'image' && clip.kind !== 'text') badges.push('🔇');
  if (Object.values(clip.keyframes).some((k) => k && k.length)) badges.push('◆');
  if (clip.bgRemove) badges.push('✂');

  return (
    <div
      ref={ref}
      className={`clip ${clip.kind} ${selected ? 'sel' : ''} ${ghost !== null ? 'drag-ghost' : ''}`}
      style={{ left, width, transform: ghost !== null ? `translateX(${ghost}px) translateY(-6px) scale(0.92)` : undefined, touchAction: selected && !isMain ? 'none' : 'pan-x pan-y' }}
      onPointerDown={(e) => onDown(e, 'move')}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
      data-testid={`clip-${clip.kind}`}
      data-clip={clip.id}
    >
      {count > 0 && (
        <div className="clip-strip">
          {Array.from({ length: count }, (_, i) => {
            const srcT = clip.in + ((i + 0.5) * thumbW / zoom) * clip.speed;
            const ti = m && m.duration > 0 && thumbs.length > 1 ? Math.min(thumbs.length - 1, Math.max(0, Math.floor((srcT / m.duration) * thumbs.length))) : 0;
            return thumbs[ti] ? <img key={i} src={thumbs[ti]} style={{ width: thumbW }} alt="" draggable={false} /> : null;
          })}
        </div>
      )}
      {(clip.kind === 'audio' || (clip.kind === 'video' && !isMain)) && m?.waveform && <Wave media={m} clip={clip} width={width} />}
      <div className="clip-label">
        {clip.kind === 'motion' ? `✦ ${clip.name}` : clip.kind === 'text' ? `T  ${clip.text?.text.replace(/\n/g, ' ')}` : clip.kind === 'audio' ? `♪ ${clip.name}` : clip.kind === 'color' ? 'Cor sólida' : ''}
      </div>
      {badges.length > 0 && <div className="clip-badges">{badges.map((b) => <span key={b}>{b}</span>)}</div>}
      {selected && (
        <>
          <div className="handle l" onPointerDown={(e) => onDown(e, 'trimL')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-testid="trim-left" />
          <div className="handle r" onPointerDown={(e) => onDown(e, 'trimR')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-testid="trim-right" />
        </>
      )}
    </div>
  );
});

const Wave = memo(function Wave({ media, clip, width }: { media: MediaAsset; clip: Clip; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !media.waveform) return;
    const w = Math.min(4000, Math.max(1, Math.round(width)));
    const h = c.clientHeight || 36;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const wf = media.waveform;
    const s0 = clip.in / media.duration, s1 = (clip.in + clip.duration * clip.speed) / media.duration;
    ctx.fillStyle = clip.kind === 'audio' ? '#34d399' : 'rgba(255,255,255,.55)';
    const bars = Math.floor(w / 3);
    for (let i = 0; i < bars; i++) {
      const f = s0 + ((s1 - s0) * i) / bars;
      const v = wf[Math.min(wf.length - 1, Math.max(0, Math.floor(f * wf.length)))] ?? 0;
      const bh = Math.max(1, v * (h - 6) * Math.min(1.5, clip.audio.volume));
      ctx.fillRect(i * 3, (h - bh) / 2, 2, bh);
    }
  }, [media, clip.in, clip.duration, clip.speed, clip.audio.volume, clip.kind, width]);
  return <canvas ref={ref} className="clip-wave" style={{ width: '100%', height: '100%' }} />;
});
