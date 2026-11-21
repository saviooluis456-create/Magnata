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

/** Renders a text clip into a tight canvas. `scale` = output px per project px * (projectMin/1080). */
export function renderText(style: TextStyle, scale: number, reveal = 1): TextRaster {
  const r = Math.round(reveal * 60) / 60;
  const key = JSON.stringify(style) + '|' + scale.toFixed(3) + '|' + r;
  const hit = textCache.get(key);
  if (hit) return hit;
  ensureFont(style.font, style.weight, style.italic);
  const size = style.size * scale;
  const font = fontString(style.font, style.weight, size, style.italic);
  const meas = makeCanvas(4, 4).getContext('2d') as Ctx;
  meas.font = font;
  setSpacing(meas, style.letterSpacing * scale);
  const raw = style.uppercase ? style.text.toUpperCase() : style.text;
  const lines = raw.split('\n');
  const total = raw.replace(/\n/g, '').length;
  let budget = Math.ceil(total * clamp(r, 0, 1));
  const shown = lines.map((l) => { const s = l.slice(0, Math.max(0, budget)); budget -= l.length; return s; });
  const widths = lines.map((l) => meas.measureText(l || ' ').width);
  const lh = size * style.lineHeight;
  const maxW = Math.max(1, ...widths);
  const pad = (style.bgOpacity > 0 ? style.bgPadding * scale : 0) + style.strokeWidth * scale + Math.max(style.shadowBlur, style.glowSize) * scale * 1.5 + Math.abs(style.shadowX * scale) + Math.abs(style.shadowY * scale) + 4;
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
  ctx.textAlign = style.align;

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
  shown.forEach((line, i) => {
    if (!line) return;
    const y = pad + lh * i + lh / 2;
    if (style.glowSize > 0) {
      ctx.save();
      ctx.shadowColor = style.glowColor;
      ctx.shadowBlur = style.glowSize * scale;
      ctx.fillStyle = style.glowColor;
      ctx.fillText(line, ax, y);
      ctx.fillText(line, ax, y);
      ctx.restore();
    }
    if (style.shadowBlur > 0 || style.shadowX || style.shadowY) {
      ctx.save();
      ctx.shadowColor = style.shadowColor;
      ctx.shadowBlur = style.shadowBlur * scale;
      ctx.shadowOffsetX = style.shadowX * scale;
      ctx.shadowOffsetY = style.shadowY * scale;
      ctx.fillStyle = style.strokeWidth > 0 ? style.strokeColor : (typeof fill === 'string' ? fill : style.color);
      if (style.strokeWidth > 0) { ctx.lineWidth = style.strokeWidth * scale * 2; ctx.strokeStyle = style.strokeColor; ctx.strokeText(line, ax, y); }
      else ctx.fillText(line, ax, y);
      ctx.restore();
    }
    if (style.strokeWidth > 0) {
      ctx.lineWidth = style.strokeWidth * scale * 2;
      ctx.strokeStyle = style.strokeColor;
      ctx.strokeText(line, ax, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(line, ax, y);
  });
  const res = { canvas, w, h };
  if (textCache.size > 300) textCache.clear();
  textCache.set(key, res);
  return res;
}

export function clearTextCache() { textCache.clear(); pagesCache.clear(); }

// ---------------------------------------------------------------- CAPTIONS
export interface CaptionPage { words: CaptionWord[]; start: number; end: number }
const pagesCache = new Map<string, CaptionPage[]>();

export function buildPages(words: CaptionWord[], perPage: number): CaptionPage[] {
  const key = perPage + '|' + words.length + '|' + words.map((w) => w.id + w.start.toFixed(2) + w.end.toFixed(2) + w.text).join(',');
  const hit = pagesCache.get(key);
  if (hit) return hit;
  const sorted = [...words].filter((w) => w.text.trim()).sort((a, b) => a.start - b.start);
  const pages: CaptionPage[] = [];
  let cur: CaptionWord[] = [];
  const flush = () => { if (cur.length) pages.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end }); cur = []; };
  for (let i = 0; i < sorted.length; i++) {
    const w = sorted[i];
    const prev = cur[cur.length - 1];
    if (prev && (w.start - prev.end > 0.7 || cur.length >= perPage)) flush();
    cur.push(w);
    if (/[.!?…]$/.test(w.text) && cur.length >= Math.min(2, perPage)) flush();
  }
  flush();
  // extend page end until next page start (max linger 0.6s)
  for (let i = 0; i < pages.length; i++) {
    const next = pages[i + 1];
    pages[i].end = next ? Math.min(next.start, pages[i].end + 0.6) : pages[i].end + 0.6;
  }
  if (pagesCache.size > 20) pagesCache.clear();
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
  return s;
}

/**
 * Draws captions for time t onto ctx (sized W x H output pixels). `scale` = output px per 1080-reference px.
 */
export function drawCaptions(ctx: Ctx, W: number, H: number, words: CaptionWord[], st: CaptionStyle, t: number, scale: number) {
  if (!words.length) return;
  const pages = buildPages(words, Math.max(1, st.wordsPerPage));
  const page = pageAt(pages, t);
  if (!page) return;
  ensureFont(st.font, st.weight, st.italic);
  const size = st.size * scale;
  const font = fontString(st.font, st.weight, size, st.italic);
  ctx.save();
  ctx.font = font;
  setSpacing(ctx, st.letterSpacing * scale);
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.textAlign = 'left';

  const space = ctx.measureText(' ').width;
  const items = page.words.map((w) => {
    const text = cleanWord(w.text, st) || w.text;
    return { w, text, width: ctx.measureText(text).width };
  });
  // wrap lines
  const maxLineW = Math.min(W * 0.9, ctx.measureText('M').width * 0.62 * st.maxCharsPerLine + space * 2);
  const lines: (typeof items)[] = [];
  let line: typeof items = [];
  let lw = 0;
  for (const it of items) {
    const add = (line.length ? space : 0) + it.width;
    if (line.length && lw + add > maxLineW) { lines.push(line); line = []; lw = 0; }
    line.push(it);
    lw += (line.length > 1 ? space : 0) + it.width;
  }
  if (line.length) lines.push(line);

  const lh = size * st.lineHeight;
  const blockH = lh * lines.length;
  const cx = st.x * W;
  const cy = st.y * H;
  const spd = Math.max(0.2, st.animSpeed);
  const pageAge = (t - page.start) * spd;

  ctx.translate(cx, cy);
  if (st.rotation) ctx.rotate((st.rotation * Math.PI) / 180);
  // page-level animation
  let pageScale = 1;
  if (st.animation === 'zoom') pageScale = 0.6 + 0.4 * ease('back', clamp(pageAge / 0.25, 0, 1));
  ctx.scale(pageScale, pageScale);

  const lineWidths = lines.map((l) => l.reduce((a, it, i) => a + it.width + (i ? space : 0), 0));
  const blockW = Math.max(...lineWidths);
  const pad = st.bgPadding * scale;

  if (st.bgMode === 'block' && st.bgOpacity > 0) {
    ctx.fillStyle = withAlpha(st.bgColor, st.bgOpacity);
    const bx = st.align === 'left' ? -blockW / 2 : st.align === 'right' ? -blockW / 2 : -blockW / 2;
    roundRect(ctx, bx - pad, -blockH / 2 - pad * 0.6, blockW + pad * 2, blockH + pad * 1.2, st.bgRadius * scale);
    ctx.fill();
  }

  // emoji above block
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
      ctx.font = font;
    }
  }

  let wordIndex = 0;
  lines.forEach((ln, li) => {
    const lwid = lineWidths[li];
    let x = st.align === 'left' ? -blockW / 2 : st.align === 'right' ? blockW / 2 - lwid : -lwid / 2;
    const y = -blockH / 2 + lh * li + lh / 2;
    if (st.bgMode === 'line' && st.bgOpacity > 0) {
      ctx.fillStyle = withAlpha(st.bgColor, st.bgOpacity);
      roundRect(ctx, x - pad, y - lh / 2 - pad * 0.3, lwid + pad * 2, lh + pad * 0.6, st.bgRadius * scale);
      ctx.fill();
    }
    for (const it of ln) {
      drawWord(ctx, it.text, it.width, it.w, x, y, lh, size, st, t, scale, spd, wordIndex, page);
      x += it.width + space;
      wordIndex++;
    }
  });
  ctx.restore();
}

function drawWord(
  ctx: Ctx, text: string, width: number, w: CaptionWord, x: number, y: number, lh: number, size: number,
  st: CaptionStyle, t: number, scale: number, spd: number, index: number, page: CaptionPage,
) {
  const spoken = t >= w.start;
  const nextIdx = page.words.indexOf(w) + 1;
  const next = page.words[nextIdx];
  const active = spoken && (t < w.end || (next ? t < next.start : true)) && (!next || t < next.start);
  if (!st.showUpcoming && !spoken) return;
  const age = (t - w.start) * spd;
  const k = clamp(age / 0.22, 0, 1);

  let sx = 1, sy = 1, dy = 0, dx = 0, alpha = 1, rot = 0, blur = 0, chars = text.length;
  const animApplies = !st.showUpcoming || st.animation === 'wave' || st.animation === 'shake' ? true : spoken;
  if (animApplies) {
    switch (st.animation) {
      case 'pop': { const e = spoken ? ease('back', k) : 1; sx = sy = 0.5 + 0.5 * e; alpha = spoken ? clamp(k * 3, 0, 1) : 1; break; }
      case 'bounce': dy = spoken ? -size * 0.35 * (1 - ease('bounce', k)) : 0; break;
      case 'fade': alpha = spoken ? k : 1; break;
      case 'slide-up': dy = spoken ? size * 0.5 * (1 - ease('easeOut', k)) : 0; alpha = spoken ? k : 1; break;
      case 'typewriter': chars = spoken ? Math.ceil(text.length * clamp(age / 0.18, 0, 1)) : text.length; break;
      case 'shake': if (active) { dx = Math.sin(t * 70) * size * 0.04; dy = Math.cos(t * 55) * size * 0.04; } break;
      case 'blur-in': blur = spoken ? (1 - k) * 12 * scale : 0; alpha = spoken ? clamp(k * 1.5, 0, 1) : 1; break;
      case 'glitch': break;
      case 'wave': dy = Math.sin(t * 6 + index * 0.9) * size * 0.08; break;
      case 'drop': dy = spoken ? -size * 1.2 * (1 - ease('bounce', k)) : 0; alpha = spoken ? clamp(k * 4, 0, 1) : 1; break;
      case 'flip': sy = spoken ? Math.max(0.01, ease('back', k)) : 1; break;
      case 'stretch': sx = spoken ? 0.3 + 0.7 * ease('elastic', k) : 1; sy = spoken ? 1 + 0.5 * (1 - k) : 1; break;
      case 'rise': dy = spoken ? size * 0.25 * (1 - ease('easeOut', k)) : 0; alpha = spoken ? clamp(k * 2, 0, 1) : 1; rot = 0; break;
      default: break;
    }
  }
  if (!active && spoken === false && st.inactiveOpacity < 1) alpha *= st.inactiveOpacity;
  if (!active && st.inactiveOpacity < 1 && spoken) alpha *= st.inactiveOpacity;

  const emph = st.keywordColors ? (w.highlight ? 1 : emphasisOf(w.text)) : (w.highlight ? 1 : 0);
  let color: string | CanvasGradient = st.color;
  if (emph === 1) color = st.keywordColor;
  else if (emph === 2) color = st.keywordColor2;
  if (st.gradient && emph === 0) {
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, st.color);
    g.addColorStop(1, st.gradient);
    color = g;
  }
  let stroke = st.strokeColor;
  let glow = st.glowSize > 0 ? st.glowColor : '';
  let glowSize = st.glowSize;
  let boxBg = '';
  let underline = false;
  if (active) {
    switch (st.highlight) {
      case 'color': color = st.activeColor; break;
      case 'box': boxBg = st.activeBg; color = st.activeColor; break;
      case 'underline': underline = true; color = st.activeColor; break;
      case 'scale': sx *= st.activeScale; sy *= st.activeScale; color = emph ? color : st.activeColor; break;
      case 'glow': glow = st.activeColor; glowSize = Math.max(20, st.glowSize * 1.4); color = st.activeColor; break;
      case 'outline': stroke = st.activeColor; color = st.activeColor; break;
      default: break;
    }
  }
  const karaoke = st.highlight === 'karaoke';

  ctx.save();
  ctx.globalAlpha = alpha;
  const cxw = x + width / 2;
  ctx.translate(cxw + dx, y + dy);
  if (rot) ctx.rotate(rot);
  ctx.scale(sx, sy);
  const lx = -width / 2;
  const shownText = chars >= text.length ? text : text.slice(0, chars);
  if (blur > 0.3 && 'filter' in ctx) (ctx as CanvasRenderingContext2D).filter = `blur(${blur.toFixed(1)}px)`;

  if (st.bgMode === 'word' && st.bgOpacity > 0) {
    const p = st.bgPadding * scale;
    ctx.fillStyle = withAlpha(st.bgColor, st.bgOpacity);
    roundRect(ctx, lx - p, -lh / 2 + lh * 0.06, width + p * 2, lh * 0.88, st.bgRadius * scale);
    ctx.fill();
  }
  if (boxBg) {
    const p = Math.max(8, st.bgPadding * 0.6) * scale;
    const e = ease('back', clamp(age / 0.15, 0, 1));
    ctx.save();
    ctx.scale(0.8 + 0.2 * e, 0.8 + 0.2 * e);
    ctx.fillStyle = boxBg;
    roundRect(ctx, lx - p, -lh / 2 + lh * 0.04, width + p * 2, lh * 0.92, Math.max(6, st.bgRadius) * scale);
    ctx.fill();
    ctx.restore();
  }
  if (glow) {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = glowSize * scale;
    ctx.fillStyle = glow;
    ctx.fillText(shownText, lx, 0);
    ctx.restore();
  }
  if (st.shadowBlur > 0 || st.shadowX || st.shadowY) {
    ctx.save();
    ctx.shadowColor = st.shadowColor;
    ctx.shadowBlur = st.shadowBlur * scale;
    ctx.shadowOffsetX = st.shadowX * scale;
    ctx.shadowOffsetY = st.shadowY * scale;
    if (st.strokeWidth > 0) { ctx.lineWidth = st.strokeWidth * scale * 2; ctx.strokeStyle = stroke; ctx.strokeText(shownText, lx, 0); }
    else { ctx.fillStyle = typeof color === 'string' ? color : st.color; ctx.fillText(shownText, lx, 0); }
    ctx.restore();
  }
  if (st.strokeWidth > 0) {
    ctx.lineWidth = st.strokeWidth * scale * 2;
    ctx.strokeStyle = stroke;
    ctx.strokeText(shownText, lx, 0);
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
  if (karaoke) {
    ctx.fillStyle = st.color;
    ctx.fillText(shownText, lx, 0);
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
    ctx.fillStyle = color;
    ctx.fillText(shownText, lx, 0);
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
