import { clamp, ease } from '../model/timeline';
import type { CaptionStyle, CaptionWord, TextStyle } from '../model/types';
import { ensureFont, fontString } from './fonts';
import { emojiFor, emphasisOf } from './keywords';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function setSpacing(ctx: Ctx, px: number) {
  const c = ctx as unknown as { letterSpacing?: string };
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`;
}

/** Canvas letterSpacing is missing on older Safari: emulate wide tracking by inserting hair spaces between letters. */
const NATIVE_SPACING = typeof document === 'undefined' || 'letterSpacing' in (makeCanvasProbe() as object);
function makeCanvasProbe() {
  try { return (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas')).getContext('2d') ?? {}; } catch { return {}; }
}
export function emulateSpacing(text: string, spacingPx: number, sizePx: number): string {
  if (NATIVE_SPACING || spacingPx < sizePx * 0.06) return text;
  const hair = sizePx * 0.08; // approx width of U+200A
  const n = Math.min(8, Math.round(spacingPx / hair));
  return n > 0 ? Array.from(text).join('\u200A'.repeat(n)) : text;
}

function withAlpha(color: string, a: number): string {
  if (color.startsWith('#')) {
    let h = color.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  return color;
}

// ---------------------------------------------------------------- TEXT CLIPS
export interface TextRaster { canvas: AnyCanvas; w: number; h: number }
const textCache = new Map<string, TextRaster>();

export interface CharAnim { type: string; p: number; t: number }

const SCRAMBLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$';

/** Renders a text clip into a tight canvas. `scale` = output px per project px * (projectMin/1080).
 *  `chars` enables per-letter animation (entrance progress p 0..1 and loop time t). */
export function renderText(style: TextStyle, scale: number, reveal = 1, chars?: CharAnim | null): TextRaster {
  const r = Math.round(reveal * 60) / 60;
  const ck = chars ? `${chars.type}|${Math.round(chars.p * 60)}|${Math.round(chars.t * 30)}` : '';
  const key = JSON.stringify(style) + '|' + scale.toFixed(3) + '|' + r + '|' + ck;
  const hit = textCache.get(key);
  if (hit) return hit;
  ensureFont(style.font, style.weight, style.italic);
  const size = style.size * scale;
  const font = fontString(style.font, style.weight, size, style.italic);
  const meas = makeCanvas(4, 4).getContext('2d') as Ctx;
  meas.font = font;
  setSpacing(meas, style.letterSpacing * scale);
  const raw0 = style.uppercase ? style.text.toUpperCase() : style.text;
  const raw = raw0.split('\n').map((l) => emulateSpacing(l, style.letterSpacing, style.size)).join('\n');
  const lines = raw.split('\n');
  const total = raw.replace(/\n/g, '').length;
  let budget = Math.ceil(total * clamp(r, 0, 1));
  const shown = lines.map((l) => { const s = l.slice(0, Math.max(0, budget)); budget -= l.length; return s; });
  const widths = lines.map((l) => meas.measureText(l || ' ').width);
  const lh = size * style.lineHeight;
  const maxW = Math.max(1, ...widths);
  const motionPad = chars ? size * 0.9 : 0;
  const pad = (style.bgOpacity > 0 ? style.bgPadding * scale : 0) + style.strokeWidth * scale + Math.max(style.shadowBlur, style.glowSize) * scale * 1.5 + Math.abs(style.shadowX * scale) + Math.abs(style.shadowY * scale) + 4 + motionPad;
  const w = Math.ceil(maxW + pad * 2);
  const h = Math.ceil(lh * lines.length + pad * 2);
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d') as Ctx;
  ctx.font = font;
  setSpacing(ctx, style.letterSpacing * scale);
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const ax = style.align === 'left' ? pad : style.align === 'right' ? w - pad : w / 2;

  if (style.bgOpacity > 0) {
    const bp = style.bgPadding * scale;
    ctx.fillStyle = withAlpha(style.bgColor, style.bgOpacity);
    const bx = style.align === 'left' ? pad - bp : style.align === 'right' ? w - pad - maxW - bp : (w - maxW) / 2 - bp;
    roundRect(ctx, bx, pad - bp, maxW + bp * 2, lh * lines.length + bp * 2, style.bgRadius * scale);
    ctx.fill();
  }
  const fill = (() => {
    if (!style.gradient) return style.color;
    const g = ctx.createLinearGradient(0, pad, 0, h - pad);
    g.addColorStop(0, style.color);
    g.addColorStop(1, style.gradient);
    return g;
  })();
  let glowBoost = 1;
  if (chars?.type === 'glow-pulse') glowBoost = 1.6 + Math.sin(chars.t * 4) * 0.8;
  const paint = (str: string, x: number, y: number, col: string | CanvasGradient = fill) => {
    if (style.glowSize > 0 || chars?.type === 'neon-in' || chars?.type === 'neon-flicker' || chars?.type === 'glow-pulse') {
      ctx.save();
      ctx.shadowColor = style.glowSize > 0 ? style.glowColor : (typeof col === 'string' ? col : style.color);
      ctx.shadowBlur = Math.max(style.glowSize, 18) * scale * glowBoost;
      ctx.fillStyle = ctx.shadowColor;
      ctx.fillText(str, x, y);
      ctx.fillText(str, x, y);
      ctx.restore();
    }
    if (style.shadowBlur > 0 || style.shadowX || style.shadowY) {
      ctx.save();
      ctx.shadowColor = style.shadowColor;
      ctx.shadowBlur = style.shadowBlur * scale;
      ctx.shadowOffsetX = style.shadowX * scale;
      ctx.shadowOffsetY = style.shadowY * scale;
      ctx.fillStyle = style.strokeWidth > 0 ? style.strokeColor : (typeof col === 'string' ? col : style.color);
      if (style.strokeWidth > 0) { ctx.lineWidth = style.strokeWidth * scale * 2; ctx.strokeStyle = style.strokeColor; ctx.strokeText(str, x, y); }
      else ctx.fillText(str, x, y);
      ctx.restore();
    }
    if (style.strokeWidth > 0) {
      ctx.lineWidth = style.strokeWidth * scale * 2;
      ctx.strokeStyle = style.strokeColor;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = col;
    ctx.fillText(str, x, y);
  };

  if (!chars) {
    ctx.textAlign = style.align;
    shown.forEach((line, i) => { if (line) paint(line, ax, pad + lh * i + lh / 2); });
  } else {
    // ---- per-letter animation
    ctx.textAlign = 'left';
    const n = Math.max(1, total);
    let gi = 0;
    const wordsMode = chars.type === 'words-up';
    lines.forEach((line, li) => {
      const y = pad + lh * li + lh / 2;
      const lw = widths[li];
      let x = style.align === 'left' ? pad : style.align === 'right' ? w - pad - lw : (w - lw) / 2;
      const units = wordsMode ? line.split(/(\s+)/) : Array.from(line);
      const nUnits = wordsMode ? Math.max(1, lines.join(' ').split(/\s+/).length) : n;
      for (const u of units) {
        const uw = ctx.measureText(u).width;
        if (!u.trim()) { x += uw; if (!wordsMode) gi++; continue; }
        const start = (gi / nUnits) * 0.6;
        const pc = clamp((chars.p - start) / 0.4, 0, 1);
        const e = 1 - Math.pow(1 - pc, 3);
        let dx = 0, dy = 0, sc = 1, rot = 0, alpha = 1, txt = u;
        let col: string | CanvasGradient = fill;
        switch (chars.type) {
          case 'letters-rise': dy = (1 - e) * size * 0.7; alpha = e; break;
          case 'letters-fade': alpha = e; break;
          case 'letters-pop': { const c1 = 1.70158, c3 = c1 + 1, b = pc <= 0 ? 0 : 1 + c3 * Math.pow(pc - 1, 3) + c1 * Math.pow(pc - 1, 2); sc = Math.max(0.001, b); alpha = clamp(pc * 4, 0, 1); break; }
          case 'letters-drop': { const bo = ease('bounce', pc); dy = -(1 - bo) * size * 1.2; alpha = clamp(pc * 5, 0, 1); break; }
          case 'letters-spin': rot = (1 - e) * Math.PI * 1.2; sc = 0.3 + 0.7 * e; alpha = e; break;
          case 'letters-blur': sc = 1 + (1 - e) * 0.8; alpha = e * e; break;
          case 'words-up': dy = (1 - e) * size * 0.8; alpha = e; break;
          case 'scramble': if (pc < 1) txt = SCRAMBLE[Math.floor(Math.abs(Math.sin(gi * 12.9898 + Math.floor(chars.p * 40) * 78.233)) * 43758.5453) % SCRAMBLE.length]; alpha = pc > 0 ? 1 : 0.0; break;
          case 'glitch-in': if (pc < 1) { dx = (Math.sin(gi * 91.7 + chars.p * 80) * 0.5) * size * 0.3 * (1 - pc); col = pc < 0.5 ? '#22d3ee' : '#ff2d75'; } alpha = pc > 0 ? 1 : 0; break;
          case 'neon-in': alpha = pc <= 0 ? 0 : pc < 1 ? (Math.sin(gi * 7 + chars.p * 70) > 0 ? 1 : 0.25) : 1; break;
          // loops
          case 'letters-wave': dy = Math.sin(chars.t * 6 + gi * 0.55) * size * 0.1; break;
          case 'letters-bounce': dy = -Math.abs(Math.sin(chars.t * 5 + gi * 0.45)) * size * 0.14; break;
          case 'rainbow': col = `hsl(${(gi * 24 + chars.t * 140) % 360}, 95%, 62%)`; break;
          case 'shimmer': { const pos = ((chars.t * 0.8) % 1.6 - 0.3) * n; const k = Math.exp(-Math.pow((gi - pos) / 2.2, 2)); col = typeof fill === 'string' ? mixColor(fill, '#ffffff', k * 0.9) : fill; sc = 1 + k * 0.06; break; }
          case 'neon-flicker': alpha = Math.sin(chars.t * 37 + gi) > 0.93 ? 0.3 : 1; break;
          default: break;
        }
        if (alpha > 0.001) {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(x + uw / 2 + dx, y + dy);
          if (rot) ctx.rotate(rot);
          if (sc !== 1) ctx.scale(sc, sc);
          if (chars.type === 'letters-blur' && pc < 1 && 'filter' in ctx) (ctx as CanvasRenderingContext2D).filter = `blur(${((1 - e) * 10 * scale).toFixed(1)}px)`;
          paint(txt, -uw / 2, 0, col);
          ctx.restore();
        }
        x += uw;
        gi++;
      }
    });
  }
  const res = { canvas, w, h };
  if (textCache.size > 300) textCache.clear();
  textCache.set(key, res);
  return res;
}

export function clearTextCache() { textCache.clear(); pagesCache.clear(); }

// ---------------------------------------------------------------- CAPTIONS
export interface CaptionPage { words: CaptionWord[]; start: number; end: number }
const pagesCache = new Map<string, CaptionPage[]>();

export function buildPages(words: CaptionWord[], perPage: number, pauseSplit = 0.7): CaptionPage[] {
  const key = perPage + '|' + pauseSplit + '|' + words.length + '|' + words.map((w) => w.id + w.start.toFixed(2) + w.end.toFixed(2) + w.text + (w.styleId ?? '')).join(',');
  const hit = pagesCache.get(key);
  if (hit) return hit;
  const sorted = [...words].filter((w) => w.text.trim()).sort((a, b) => a.start - b.start);
  const pages: CaptionPage[] = [];
  let cur: CaptionWord[] = [];
  const flush = () => { if (cur.length) pages.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end }); cur = []; };
  for (let i = 0; i < sorted.length; i++) {
    const w = sorted[i];
    const prev = cur[cur.length - 1];
    // new phrase on long pause, full page, or when the per-phrase style changes
    if (prev && (w.start - prev.end > pauseSplit || cur.length >= perPage || (prev.styleId ?? '') !== (w.styleId ?? ''))) flush();
    cur.push(w);
    if (/[.!?…]$/.test(w.text) && cur.length >= Math.min(2, perPage)) flush();
  }
  flush();
  for (let i = 0; i < pages.length; i++) {
    const next = pages[i + 1];
    pages[i].end = next ? Math.min(next.start, pages[i].end + 0.6) : pages[i].end + 0.6;
  }
  if (pagesCache.size > 30) pagesCache.clear();
  pagesCache.set(key, pages);
  return pages;
}

export function pageAt(pages: CaptionPage[], t: number): CaptionPage | null {
  let lo = 0, hi = pages.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const p = pages[mid];
    if (t < p.start) hi = mid - 1;
    else if (t >= p.end) lo = mid + 1;
    else return p;
  }
  return null;
}

function cleanWord(w: string, st: CaptionStyle) {
  let s = st.removePunctuation ? w.replace(/[.,;:!?…"“”]/g, '') : w;
  if (st.uppercase) s = s.toUpperCase();
  else if (st.lowercase) s = s.toLowerCase();
  return emulateSpacing(s, st.letterSpacing, st.size);
}

interface Item { w: CaptionWord; text: string; width: number; emph: boolean; font: string; scale: number; idx: number }

function emphasisSet(page: CaptionPage, st: CaptionStyle): Set<string> {
  const set = new Set<string>();
  for (const w of page.words) if (w.highlight || (st.keywordColors && emphasisOf(w.text) > 0)) set.add(w.id);
  if (st.emphFirst && page.words.length > 1) set.add(page.words[0].id);
  if (st.emphAuto && set.size === 0 && page.words.length > 1) {
    const best = [...page.words].sort((a, b) => cleanWord(b.text, st).length - cleanWord(a.text, st).length)[0];
    if (best) set.add(best.id);
  }
  return set;
}

function usesEmphFont(st: CaptionStyle) {
  return !!st.emphFont || st.emphWeight !== st.weight || (st.emphScale ?? 1) !== 1 || st.emphItalic;
}

function wordFont(st: CaptionStyle, size: number, emph: boolean) {
  if (!emph || !usesEmphFont(st)) return { font: fontString(st.font, st.weight, size, st.italic), scale: 1 };
  const s = st.emphScale || 1;
  return { font: fontString(st.emphFont ?? st.font, st.emphWeight, size * s, st.emphFont ? st.emphItalic : st.emphItalic || st.italic), scale: s };
}

// color helpers for smooth active-word transitions
function parseColor(c: string): [number, number, number, number] | null {
  if (c.startsWith('#')) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16);
    if (isNaN(n)) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((x) => parseFloat(x));
  return [p[0], p[1], p[2], p[3] ?? 1];
}
function mixColor(a: string, b: string, k: number): string {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const A = parseColor(a), B = parseColor(b);
  if (!A || !B) return k < 0.5 ? a : b;
  const r = (i: number) => A[i] + (B[i] - A[i]) * k;
  return `rgba(${Math.round(r(0))},${Math.round(r(1))},${Math.round(r(2))},${r(3).toFixed(3)})`;
}

/** Greedy wrap, then rebalance so the last line isn't a lonely word */
function wrapBalanced(items: Item[], space: number, maxW: number): Item[][] {
  const lines: Item[][] = [];
  let line: Item[] = [];
  let lw = 0;
  for (const it of items) {
    const add = (line.length ? space : 0) + it.width;
    if (line.length && lw + add > maxW) { lines.push(line); line = []; lw = 0; }
    line.push(it);
    lw += (line.length > 1 ? space : 0) + it.width;
  }
  if (line.length) lines.push(line);
  const width = (l: Item[]) => l.reduce((a, it, i) => a + it.width + (i ? space : 0), 0);
  for (let pass = 0; pass < 3 && lines.length > 1; pass++) {
    for (let i = lines.length - 1; i > 0; i--) {
      const prev = lines[i - 1], cur = lines[i];
      while (prev.length > 1) {
        const moved = prev[prev.length - 1];
        const before = Math.max(width(prev), width(cur));
        const after = Math.max(width(prev.slice(0, -1)), moved.width + space + width(cur));
        if (after < before - 1 && moved.width + space + width(cur) <= maxW) { prev.pop(); cur.unshift(moved); } else break;
      }
    }
  }
  return lines;
}

/** Style of the phrase (per-phrase override or the global style) */
export function pageStyle(page: CaptionPage, st: CaptionStyle, overrides?: Record<string, CaptionStyle>) {
  const id = page.words[0]?.styleId;
  return (id && overrides?.[id]) || st;
}

/**
 * Draws captions for time t onto ctx (sized W x H output pixels). `scale` = output px per 1080-reference px.
 */
export function drawCaptions(ctx: Ctx, W: number, H: number, words: CaptionWord[], globalSt: CaptionStyle, t: number, scale: number, overrides?: Record<string, CaptionStyle>) {
  if (!words.length) return;
  const pages = buildPages(words, Math.max(1, globalSt.wordsPerPage), globalSt.pauseSplit ?? 0.7);
  const page = pageAt(pages, t);
  if (!page) return;
  const st = pageStyle(page, globalSt, overrides);
  ensureFont(st.font, st.weight, st.italic);
  if (st.emphFont) ensureFont(st.emphFont, st.emphWeight, st.emphItalic);
  const size = st.size * scale;
  const baseFont = fontString(st.font, st.weight, size, st.italic);
  ctx.save();
  ctx.font = baseFont;
  setSpacing(ctx, st.letterSpacing * scale);
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.textAlign = 'left';

  const space = ctx.measureText(' ').width;
  const emph = emphasisSet(page, st);
  let activeIdx = -1;
  for (let i = 0; i < page.words.length; i++) if (t >= page.words[i].start) activeIdx = i;
  const items: Item[] = page.words.map((w, i) => {
    const text = cleanWord(w.text, st) || w.text;
    const isEmph = emph.has(w.id) || (st.highlight === 'font' && i === activeIdx);
    const f = wordFont(st, size, isEmph);
    ctx.font = f.font;
    return { w, text, width: ctx.measureText(text).width, emph: isEmph, font: f.font, scale: f.scale, idx: i };
  });
  ctx.font = baseFont;
  const maxLineW = Math.min(W * 0.9, ctx.measureText('M').width * 0.62 * st.maxCharsPerLine + space * 2);
  const lines = wrapBalanced(items, space, maxLineW);

  const lineWidths = lines.map((l) => l.reduce((a, it, i) => a + it.width + (i ? space : 0), 0));
  const fitTarget = Math.min(W * 0.86, Math.max(...lineWidths));
  const lineScale = lines.map((_, i) => (st.fitLines ? Math.max(0.5, Math.min(2.6, fitTarget / Math.max(1, lineWidths[i]))) : 1));
  const lineH = lines.map((l, i) => size * st.lineHeight * Math.max(...l.map((it) => it.scale)) * lineScale[i] * (st.fitLines ? 0.92 : 1));
  const blockH = lineH.reduce((a, b) => a + b, 0);
  const blockW = Math.max(...lineWidths.map((w, i) => w * lineScale[i]));
  const spd = Math.max(0.2, st.animSpeed);
  const pageAge = (t - page.start) * spd;

  ctx.translate(st.x * W, st.y * H);
  if (st.rotation) ctx.rotate((st.rotation * Math.PI) / 180);
  let pageScale = 1;
  if (st.animation === 'zoom') pageScale = 0.6 + 0.4 * ease('back', clamp(pageAge / 0.25, 0, 1));
  ctx.scale(pageScale, pageScale);
  const pad = st.bgPadding * scale;

  // layout pass: absolute word rects (block coordinates)
  interface L { x0: number; y: number; ls: number; lh: number; lwid: number; items: { it: Item; x: number }[] }
  const layout: L[] = [];
  let yCursor = -blockH / 2;
  lines.forEach((ln, li) => {
    const ls = lineScale[li], lwid = lineWidths[li] * ls, lh = lineH[li];
    const y = yCursor + lh / 2;
    yCursor += lh;
    let align = st.align;
    if (align === 'stagger') align = lines.length === 1 ? 'center' : li === 0 ? 'left' : li === lines.length - 1 ? 'right' : 'center';
    const x0 = align === 'left' ? -blockW / 2 : align === 'right' ? blockW / 2 - lwid : -lwid / 2;
    let x = 0;
    const its = ln.map((it) => { const r = { it, x }; x += it.width + space; return r; });
    layout.push({ x0, y, ls, lh, lwid, items: its });
  });

  // backgrounds
  if (st.bgMode === 'block' && st.bgOpacity > 0) {
    ctx.fillStyle = withAlpha(st.bgColor, st.bgOpacity);
    roundRect(ctx, -blockW / 2 - pad, -blockH / 2 - pad * 0.6, blockW + pad * 2, blockH + pad * 1.2, st.bgRadius * scale);
    ctx.fill();
  }
  if (st.bgMode === 'line' && st.bgOpacity > 0) {
    for (const L of layout) {
      // when words appear as spoken, the line box grows with them
      const vis = st.showUpcoming ? L.items : L.items.filter((x) => t >= x.it.w.start);
      if (!vis.length) continue;
      const last = vis[vis.length - 1];
      const w = (last.x + last.it.width) * L.ls;
      ctx.fillStyle = withAlpha(st.bgColor, st.bgOpacity);
      roundRect(ctx, L.x0 - pad, L.y - L.lh / 2 - pad * 0.3, w + pad * 2, L.lh + pad * 0.6, st.bgRadius * scale);
      ctx.fill();
    }
  }
  // sliding highlight box (moves smoothly from the previous word to the active one)
  if (st.highlight === 'box' && activeIdx >= 0) {
    const rectOf = (idx: number) => {
      for (const L of layout) for (const r of L.items) if (r.it.idx === idx) return { x: L.x0 + r.x * L.ls, y: L.y, w: r.it.width * L.ls, h: L.lh };
      return null;
    };
    const cur = rectOf(activeIdx);
    const prev = activeIdx > 0 ? rectOf(activeIdx - 1) : null;
    if (cur) {
      const k = ease('easeOut', clamp(((t - page.words[activeIdx].start) * spd) / 0.14, 0, 1));
      const sameLine = prev && Math.abs(prev.y - cur.y) < 1;
      const R = sameLine && prev ? { x: prev.x + (cur.x - prev.x) * k, y: cur.y, w: prev.w + (cur.w - prev.w) * k, h: cur.h } : cur;
      const grow = sameLine ? 1 : 0.85 + 0.15 * ease('back', k);
      const p = Math.max(8, st.bgPadding * 0.6) * scale;
      ctx.save();
      ctx.translate(R.x + R.w / 2, R.y);
      ctx.scale(grow, grow);
      ctx.fillStyle = st.activeBg;
      roundRect(ctx, -R.w / 2 - p, -R.h * 0.46, R.w + p * 2, R.h * 0.92, Math.max(6, st.bgRadius) * scale);
      ctx.fill();
      ctx.restore();
    }
  }

  if (st.emoji) {
    const ew = page.words.find((w) => w.emoji) ?? page.words.find((w) => emojiFor(w.text));
    const emo = ew ? ew.emoji ?? emojiFor(ew.text) : undefined;
    if (emo && ew && t >= ew.start - 0.05) {
      const k = ease('back', clamp(((t - ew.start) * spd) / 0.3, 0, 1));
      ctx.save();
      ctx.font = `${Math.round(size * 1.3 * Math.max(0.01, k))}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(emo, 0, -blockH / 2 - size * 0.85);
      ctx.restore();
    }
  }

  const activeLine = layout.findIndex((L) => L.items.some((r) => r.it.idx === activeIdx));
  layout.forEach((L, li) => {
    ctx.save();
    ctx.translate(L.x0, L.y);
    ctx.scale(L.ls, L.ls);
    for (const r of L.items) {
      ctx.font = r.it.font;
      drawWord(ctx, r.it, r.x, L.lh / L.ls, size * r.it.scale, st, t, scale, spd, page, activeIdx, li === activeLine);
    }
    ctx.restore();
  });
  ctx.restore();
}

function scrambleText(text: string, k: number, seed: number) {
  if (k >= 1) return text;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@';
  let out = '';
  const n = Math.floor(text.length * k);
  for (let i = 0; i < text.length; i++) {
    if (i < n || text[i] === ' ') out += text[i];
    else out += chars[Math.floor(Math.abs(Math.sin((i + 1) * 12.9898 + seed * 78.233 + Math.floor(k * 20) * 3.1)) * 43758.5453) % chars.length];
  }
  return out;
}

function drawWord(
  ctx: Ctx, it: Item, x: number, lh: number, size: number,
  st: CaptionStyle, t: number, scale: number, spd: number, page: CaptionPage, activeIdx: number, onActiveLine: boolean,
) {
  const { w, width, emph } = it;
  const text = it.text;
  const index = it.idx;
  const spoken = t >= w.start;
  const active = index === activeIdx;
  if (!st.showUpcoming && !spoken) return;
  const age = (t - w.start) * spd;
  const k = clamp(age / 0.22, 0, 1);

  let sx = 1, sy = 1, dy = 0, dx = 0, alpha = 1, blur = 0, rot = 0, chars = text.length;
  let shown = text;
  let perLetter = false;
  const animApplies = !st.showUpcoming || ['wave', 'shake', 'spotlight', 'jelly'].includes(st.animation) ? true : spoken;
  if (animApplies) {
    switch (st.animation) {
      case 'pop': { const e = spoken ? ease('back', k) : 1; sx = sy = 0.55 + 0.45 * e; alpha = spoken ? clamp(k * 3, 0, 1) : 1; break; }
      case 'spring': { const kk = clamp(age / 0.45, 0, 1); const e = spoken ? 1 - Math.exp(-7 * kk) * Math.cos(12 * kk) : 1; sx = sy = 0.6 + 0.4 * e; alpha = spoken ? clamp(kk * 5, 0, 1) : 1; break; }
      case 'slam': { const kk = clamp(age / 0.16, 0, 1); sx = sy = spoken ? 1 + 1.2 * Math.pow(1 - kk, 3) : 1; alpha = spoken ? clamp(kk * 2.5, 0, 1) : 1; break; }
      case 'bounce': dy = spoken ? -size * 0.35 * (1 - ease('bounce', k)) : 0; break;
      case 'fade': alpha = spoken ? k : 1; break;
      case 'slide-up': dy = spoken ? size * 0.5 * (1 - ease('easeOut', k)) : 0; alpha = spoken ? k : 1; break;
      case 'typewriter': chars = spoken ? Math.ceil(text.length * clamp(age / 0.18, 0, 1)) : text.length; break;
      case 'scramble': shown = spoken ? scrambleText(text, clamp(age / 0.3, 0, 1), index) : text; break;
      case 'letters': perLetter = spoken && age < 0.5; break;
      case 'shake': if (active) { dx = Math.sin(t * 70) * size * 0.04; dy = Math.cos(t * 55) * size * 0.04; } break;
      case 'blur-in': blur = spoken ? (1 - k) * 12 * scale : 0; alpha = spoken ? clamp(k * 1.5, 0, 1) : 1; break;
      case 'wave': dy = Math.sin(t * 6 + index * 0.9) * size * 0.08; break;
      case 'drop': dy = spoken ? -size * 1.2 * (1 - ease('bounce', k)) : 0; alpha = spoken ? clamp(k * 4, 0, 1) : 1; break;
      case 'flip': sy = spoken ? Math.max(0.01, ease('back', k)) : 1; break;
      case 'roll': { const kk = ease('easeOut', clamp(age / 0.3, 0, 1)); sy = spoken ? Math.max(0.01, kk) : 1; dy = spoken ? size * 0.4 * (1 - kk) : 0; alpha = spoken ? kk : 1; break; }
      case 'stretch': sx = spoken ? 0.3 + 0.7 * ease('elastic', k) : 1; sy = spoken ? 1 + 0.5 * (1 - k) : 1; break;
      case 'rise': dy = spoken ? size * 0.25 * (1 - ease('easeOut', k)) : 0; alpha = spoken ? clamp(k * 2, 0, 1) : 1; break;
      case 'swing': rot = spoken ? (-0.5 * (1 - ease('elastic', clamp(age / 0.6, 0, 1)))) : 0; alpha = spoken ? clamp(k * 3, 0, 1) : 1; break;
      case 'spotlight': if (!active) alpha *= 0.35; else { sx = sy = 1.06; } break;
      case 'jelly': if (active) { const ph = age * 18; sx = 1 + 0.08 * Math.sin(ph) * Math.exp(-age * 3); sy = 1 - 0.08 * Math.sin(ph) * Math.exp(-age * 3); } break;
      default: break;
    }
  }
  if (!active && st.inactiveOpacity < 1) alpha *= st.inactiveOpacity;

  const kw = st.keywordColors ? (w.highlight ? 1 : emphasisOf(w.text)) : 0;
  let color: string | CanvasGradient = st.color;
  if (kw === 1) color = st.keywordColor;
  else if (kw === 2) color = st.keywordColor2;
  else if (emph && (st.emphAuto || st.emphFirst) && st.keywordColors) color = st.keywordColor;
  if (st.gradient && kw === 0) {
    const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
    g.addColorStop(0, st.color);
    g.addColorStop(1, st.gradient);
    color = g;
  }
  let stroke = st.strokeColor;
  let glow = st.glowSize > 0 ? st.glowColor : '';
  let glowSize = st.glowSize;
  if (st.emphGlow && emph && typeof color === 'string') { glow = color; glowSize = Math.max(18, st.glowSize); }
  let underline = false;
  // fast colour cross-fade into the active state (≈80 ms) for a smooth, premium feel
  const ak = active ? clamp(age / 0.08, 0, 1) : 0;
  if (active) {
    switch (st.highlight) {
      case 'color': color = typeof color === 'string' ? mixColor(color, st.activeColor, ak) : st.activeColor; break;
      case 'font': if (st.activeColor && st.activeColor !== st.color) color = st.activeColor; break;
      case 'box': color = typeof color === 'string' ? mixColor(color, st.activeColor, ak) : st.activeColor; break;
      case 'underline': underline = true; color = st.activeColor; break;
      case 'scale': { const e = ease('back', ak); sx *= 1 + (st.activeScale - 1) * e; sy *= 1 + (st.activeScale - 1) * e; color = kw ? color : st.activeColor; break; }
      case 'glow': glow = st.activeColor; glowSize = Math.max(20, st.glowSize * 1.4); color = st.activeColor; break;
      case 'outline': stroke = st.activeColor; color = st.activeColor; break;
      default: break;
    }
  }
  if (st.highlight === 'line' && onActiveLine) color = st.activeColor;
  const karaoke = st.highlight === 'karaoke';
  const fill = st.highlight === 'fill' && spoken;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + width / 2 + dx, dy);
  if (rot) ctx.rotate(rot);
  ctx.scale(sx, sy);
  const lx = -width / 2;
  const shownText = chars >= shown.length ? shown : shown.slice(0, chars);
  if (blur > 0.3 && 'filter' in ctx) (ctx as CanvasRenderingContext2D).filter = `blur(${blur.toFixed(1)}px)`;

  if ((st.bgMode === 'word' && st.bgOpacity > 0) || fill) {
    const p = st.bgPadding * scale;
    ctx.fillStyle = fill ? st.activeBg : withAlpha(st.bgColor, st.bgOpacity);
    roundRect(ctx, lx - p, -lh / 2 + lh * 0.06, width + p * 2, lh * 0.88, st.bgRadius * scale);
    ctx.fill();
  }
  const paint = (txt: string, px: number, col: string | CanvasGradient) => {
    if (glow) {
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = glowSize * scale;
      ctx.fillStyle = glow;
      ctx.fillText(txt, px, 0);
      if (glowSize > 15) ctx.fillText(txt, px, 0);
      ctx.restore();
    }
    if (st.shadowBlur > 0 || st.shadowX || st.shadowY) {
      ctx.save();
      ctx.shadowColor = st.shadowColor;
      ctx.shadowBlur = st.shadowBlur * scale;
      ctx.shadowOffsetX = st.shadowX * scale;
      ctx.shadowOffsetY = st.shadowY * scale;
      if (st.strokeWidth > 0) { ctx.lineWidth = st.strokeWidth * scale * 2; ctx.strokeStyle = stroke; ctx.strokeText(txt, px, 0); }
      else { ctx.fillStyle = typeof col === 'string' ? col : st.color; ctx.fillText(txt, px, 0); }
      ctx.restore();
    }
    if (st.strokeWidth > 0) {
      ctx.lineWidth = st.strokeWidth * scale * 2;
      ctx.strokeStyle = stroke;
      ctx.strokeText(txt, px, 0);
    }
    ctx.fillStyle = col;
    ctx.fillText(txt, px, 0);
  };

  if (perLetter) {
    // letters rise in one after another
    let px = lx;
    for (let i = 0; i < shownText.length; i++) {
      const ch = shownText[i];
      const cw = ctx.measureText(ch).width;
      const lk = ease('easeOut', clamp((age - i * 0.035) / 0.18, 0, 1));
      ctx.save();
      ctx.globalAlpha = alpha * lk;
      ctx.translate(0, size * 0.3 * (1 - lk));
      paint(ch, px, color);
      ctx.restore();
      px += cw;
    }
  } else if (karaoke) {
    paint(shownText, lx, st.color);
    const prog = spoken ? (active ? clamp((t - w.start) / Math.max(0.05, w.end - w.start), 0, 1) : 1) : 0;
    if (prog > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(lx, -lh, width * prog, lh * 2);
      ctx.clip();
      ctx.fillStyle = st.activeColor;
      ctx.fillText(shownText, lx, 0);
      ctx.restore();
    }
  } else {
    paint(shownText, lx, color);
  }
  if (st.animation === 'glitch' && active) {
    const o = Math.sin(t * 40) * 4 * scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,0,80,0.7)';
    ctx.fillText(shownText, lx + o, 0);
    ctx.fillStyle = 'rgba(0,220,255,0.7)';
    ctx.fillText(shownText, lx - o, 0);
    ctx.restore();
  }
  if (underline) {
    const e = ease('easeOut', clamp(age / 0.2, 0, 1));
    ctx.fillStyle = st.activeColor;
    roundRect(ctx, lx, size * 0.5, width * e, Math.max(4, size * 0.09), 4 * scale);
    ctx.fill();
  }
  ctx.restore();
}

/** Ensure caption font is requested */
export function captionFontReady(st: CaptionStyle) {
  return ensureFont(st.font, st.weight, st.italic);
}
