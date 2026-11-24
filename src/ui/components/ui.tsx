import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Slider(props: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
  format?: (v: number) => string; center?: number; onReset?: () => void; keyframe?: { active: boolean; has: boolean; toggle: () => void };
}) {
  const { label, value, min, max, step = 1, onChange, format, center, onReset, keyframe } = props;
  const pct = ((value - min) / (max - min)) * 100;
  const c = center !== undefined ? ((center - min) / (max - min)) * 100 : 0;
  const lo = Math.min(pct, c), hi = Math.max(pct, c);
  return (
    <div className="slider">
      <div className="slider-head">
        <span>{label}</span>
        <span className="slider-val" onDoubleClick={onReset}>{format ? format(value) : Math.round(value * 100) / 100}</span>
        {keyframe && (
          <button className={`kf-btn ${keyframe.active ? 'on' : keyframe.has ? 'has' : ''}`} onClick={keyframe.toggle} title="Keyframe" aria-label="Keyframe">◆</button>
        )}
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        style={{ ['--lo' as string]: `${lo}%`, ['--hi' as string]: `${hi}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onDoubleClick={onReset}
        aria-label={label}
      />
    </div>
  );
}

export function Tabs<T extends string>(props: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {props.tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={props.value === t.id} className={props.value === t.id ? 'active' : ''} onClick={() => props.onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle(props: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="toggle">
      <span>
        {props.label}
        {props.hint && <small>{props.hint}</small>}
      </span>
      <input type="checkbox" checked={props.value} onChange={(e) => props.onChange(e.target.checked)} />
      <i />
    </label>
  );
}

export function Swatches(props: { colors: string[]; value: string; onChange: (c: string) => void; allowCustom?: boolean }) {
  return (
    <div className="swatches">
      {props.allowCustom !== false && (
        <label className="swatch custom" title="Personalizada">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(props.value) ? props.value : '#ffffff'} onChange={(e) => props.onChange(e.target.value)} />
          <span>+</span>
        </label>
      )}
      {props.colors.map((c) => (
        <button key={c} className={`swatch ${props.value.toLowerCase() === c.toLowerCase() ? 'on' : ''}`} style={{ background: c }} onClick={() => props.onChange(c)} aria-label={c} />
      ))}
    </div>
  );
}

export const PALETTE = ['#ffffff', '#000000', '#ffe500', '#facc15', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#7c3aed', '#3b82f6', '#22d3ee', '#22c55e', '#84cc16', '#94a3b8', '#78350f', '#fde68a'];

export function Section(props: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="section">
      {props.title && <div className="section-title"><span>{props.title}</span>{props.right}</div>}
      {props.children}
    </div>
  );
}

export function Grid(props: { children: ReactNode; cols?: number; className?: string }) {
  return <div className={`grid ${props.className ?? ''}`} style={{ ['--cols' as string]: props.cols ?? 4 }}>{props.children}</div>;
}

export function Tile(props: { label: string; icon?: ReactNode; active?: boolean; onClick: () => void; badge?: string; style?: React.CSSProperties; className?: string }) {
  return (
    <button className={`tile ${props.active ? 'active' : ''} ${props.className ?? ''}`} onClick={props.onClick} style={props.style}>
      <div className="tile-icon">{props.icon}</div>
      <div className="tile-label">{props.label}</div>
      {props.badge && <span className="tile-badge">{props.badge}</span>}
    </button>
  );
}

export function Chips<T extends string | number>(props: { options: { v: T; label: string; disabled?: boolean; hint?: string }[]; value: T; onChange: (v: T) => void; scroll?: boolean }) {
  return (
    <div className={`chips ${props.scroll ? 'scroll' : ''}`}>
      {props.options.map((o) => (
        <button key={String(o.v)} disabled={o.disabled} className={props.value === o.v ? 'on' : ''} onClick={() => props.onChange(o.v)} title={o.hint}>
          {o.label}{o.hint && <small>{o.hint}</small>}
        </button>
      ))}
    </div>
  );
}

export function useLongPress(cb: () => void, ms = 450) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  return {
    onPointerDown: () => { t.current = setTimeout(cb, ms); },
    onPointerUp: () => { if (t.current) clearTimeout(t.current); },
    onPointerLeave: () => { if (t.current) clearTimeout(t.current); },
  };
}

export function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => { const h = setTimeout(() => setV(value), ms); return () => clearTimeout(h); }, [value, ms]);
  return v;
}

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const p = ICONS[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  play: <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />,
  pause: <><rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 010 10h-3" /></>,
  redo: <><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 000 10h3" /></>,
  back: <path d="M15 18l-6-6 6-6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  split: <><path d="M12 3v18" /><path d="M8 7l-4 5 4 5M16 7l4 5-4 5" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" /></>,
  speed: <><path d="M12 13l4-4" /><path d="M4 18a9 9 0 1116 0" /></>,
  volume: <><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /></>,
  mute: <><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M22 9l-6 6M16 9l6 6" /></>,
  text: <><path d="M5 6V4h14v2M12 4v16M9 20h6" /></>,
  captions: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 12h4M13 12h4M7 15.5h7" /></>,
  effects: <><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" /><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8zM5 16l.6 1.4L7 18l-1.4.6L5 20l-.6-1.4L3 18l1.4-.6z" /></>,
  filters: <><circle cx="9" cy="10" r="5" /><circle cx="15" cy="10" r="5" /><circle cx="12" cy="15" r="5" /></>,
  adjust: <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  audio: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  media: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M10 9l5 3-5 3z" fill="currentColor" /></>,
  overlay: <><rect x="3" y="3" width="13" height="13" rx="2" /><rect x="8" y="8" width="13" height="13" rx="2" /></>,
  sticker: <><path d="M20 12a8 8 0 11-8-8h8z" /><path d="M9 10h.01M15 10h.01M9 15c1.5 1.5 4.5 1.5 6 0" /></>,
  ai: <><path d="M12 2l2.4 6.2L21 9.5l-5.2 3.8L17 20l-5-3.6L7 20l1.2-6.7L3 9.5l6.6-1.3z" /></>,
  format: <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M2 8h2M2 16h2M20 8h2M20 16h2" /></>,
  background: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 15l5-5 4 4 3-3 6 6" /></>,
  export: <><path d="M12 15V3M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" /></>,
  animation: <><circle cx="6" cy="12" r="2" /><circle cx="12" cy="12" r="3" /><circle cx="19" cy="12" r="4" /></>,
  transform: <><path d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4" /><rect x="9" y="9" width="6" height="6" /></>,
  mask: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 010 16z" fill="currentColor" /></>,
  chroma: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 17l4-6 3 4 2-2 3 4" /><circle cx="8.5" cy="8.5" r="1.5" /></>,
  blend: <><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /></>,
  keyframe: <path d="M12 3l7 9-7 9-7-9z" />,
  color: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" opacity=".4" /><circle cx="15.5" cy="8.5" r="2" fill="currentColor" /></>,
  motion: <><rect x="3" y="14" width="14" height="6" rx="1.5" /><path d="M3 10h9M3 6h5" /><path d="M18 4l3 3-3 3" /></>,
  trimL: <><path d="M12 3v18" /><path d="M9 8H4v8h5" strokeDasharray="2 2" /><path d="M15 8h5v8h-5" /></>,
  trimR: <><path d="M12 3v18" /><path d="M9 8H4v8h5" /><path d="M15 8h5v8h-5" strokeDasharray="2 2" /></>,
  brush: <><path d="M14 4l6 6-8 8H6v-6z" /><path d="M4 20h4" /></>,
  paste: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 11h6M9 15h4" /></>,
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /><path d="M2 6l2-2M4 9H1" /></>,
  voice: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></>,
  transition: <><rect x="2" y="6" width="9" height="12" rx="1.5" /><rect x="13" y="6" width="9" height="12" rx="1.5" /><path d="M10 12h4" /></>,
  freeze: <><path d="M12 2v20M4.9 7l14.2 10M4.9 17L19.1 7" /></>,
  replace: <><path d="M4 7h13l-3-3M20 17H7l3 3" /></>,
  crop: <><path d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14" /></>,
  record: <circle cx="12" cy="12" r="6" fill="currentColor" />,
  fullscreen: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  check: <path d="M5 12l5 5L20 7" />,
  zoomin: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M8 11h6M11 8v6" /></>,
  zoomout: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M8 11h6" /></>,
  detach: <><path d="M9 18V5l12-2v13" /><path d="M3 3l18 18" /></>,
  reverse: <><path d="M3 12a9 9 0 109-9" /><path d="M3 4v5h5" /></>,
  marker: <path d="M6 3h12v14l-6 4-6-4z" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeoff: <><path d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.2M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.7 9.7 0 005.4-1.6" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
};
