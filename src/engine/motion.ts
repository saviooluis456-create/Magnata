/**
 * Motion graphics templates (lower thirds, titles, callouts, social, data).
 * Each template draws one animated frame onto a full-frame 2D canvas. t = seconds since clip start, d = clip duration.
 */
import { ensureFont, fontString } from './fonts';

import type { MotionData } from '../model/types';
export type { MotionData };

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export interface DrawArgs { ctx: Ctx; W: number; H: number; t: number; d: number; m: MotionData; s: number; portrait: boolean }

export interface MotionTemplate {
  id: string; name: string; cat: string;
  fields: string[]; // labels for texts
  texts: string[]; colors: string[]; font: string;
  duration: number;
  draw: (a: DrawArgs) => void;
}

export const MOTION_CATEGORIES = [
  { id: 'lower', name: 'Lower thirds' }, { id: 'title', name: 'Títulos' }, { id: 'social', name: 'Redes sociais' },
  { id: 'callout', name: 'Chamadas' }, { id: 'data', name: 'Dados' }, { id: 'end', name: 'Encerramento' },
];

// ------------------------------------------------------------------ helpers
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const outCubic = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const outBack = (x: number) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const outExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x)));
/** 0→1 entrance progress over `dur`, starting at `delay` */
const enter = (t: number, delay: number, dur: number) => clamp((t - delay) / dur);
/** 1→0 exit progress over the last `dur` seconds */
const exit = (t: number, d: number, dur = 0.45) => clamp((d - t) / dur);

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function font(m: MotionData, weight: number, px: number, italic = false) {
  ensureFont(m.font, weight, italic);
  return fontString(m.font, weight, px, italic);
}

function text(ctx: Ctx, str: string, x: number, y: number, f: string, color: string, align: CanvasTextAlign = 'left', spacing = 0) {
  ctx.font = f;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const c = ctx as unknown as { letterSpacing?: string };
  if ('letterSpacing' in c) c.letterSpacing = `${spacing}px`;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  return ctx.measureText(str).width;
}

function measure(ctx: Ctx, str: string, f: string, spacing = 0) {
  ctx.font = f;
  const c = ctx as unknown as { letterSpacing?: string };
  if ('letterSpacing' in c) c.letterSpacing = `${spacing}px`;
  const w = ctx.measureText(str).width;
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  return w;
}

/** reveal text by a horizontal clip mask growing from left */
function clipReveal(ctx: Ctx, x: number, y: number, w: number, h: number, k: number, fn: () => void) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w * clamp(k), h);
  ctx.clip();
  fn();
  ctx.restore();
}

function shadow(ctx: Ctx, s: number, alpha = 0.35) {
  ctx.shadowColor = `rgba(0,0,0,${alpha})`;
  ctx.shadowBlur = 24 * s;
  ctx.shadowOffsetY = 8 * s;
}

/** lower-third anchor */
const lt = (a: DrawArgs) => ({ x: a.W * 0.07, y: a.H * (a.portrait ? 0.74 : 0.8) });

// ------------------------------------------------------------------ templates
export const MOTION_TEMPLATES: MotionTemplate[] = [
  // ======== LOWER THIRDS ========
  { id: 'lt-clean', name: 'Clássico', cat: 'lower', fields: ['Nome', 'Função'], texts: ['Ana Souza', 'Diretora de Criação'], colors: ['#ffffff', '#ec4899', '#111111'], font: 'Montserrat', duration: 5,
    draw: (a) => {
      const { ctx, t, d, m, s } = a; const { x, y } = lt(a);
      const k = outExpo(enter(t, 0, 0.6)), o = outCubic(exit(t, d));
      const f1 = font(m, 800, 54 * s), f2 = font(m, 500, 30 * s);
      const w = Math.max(measure(ctx, m.texts[0], f1), measure(ctx, m.texts[1], f2)) + 70 * s;
      ctx.save(); ctx.globalAlpha = o;
      shadow(ctx, s, 0.25);
      ctx.fillStyle = m.colors[0]; rr(ctx, x, y, w * k, 120 * s, 10 * s); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = m.colors[1]; ctx.fillRect(x, y, 10 * s, 120 * s * outCubic(enter(t, 0.15, 0.4)));
      clipReveal(ctx, x, y, w, 130 * s, outCubic(enter(t, 0.25, 0.6)), () => {
        text(ctx, m.texts[0], x + 36 * s, y + 42 * s, f1, m.colors[2]);
        text(ctx, m.texts[1], x + 36 * s, y + 86 * s, f2, m.colors[1]);
      });
      ctx.restore();
    } },
  { id: 'lt-block', name: 'Blocos', cat: 'lower', fields: ['Nome', 'Função'], texts: ['CARLOS LIMA', 'Fundador · Startup X'], colors: ['#7c3aed', '#ffffff', '#facc15'], font: 'Archivo Black', duration: 5,
    draw: (a) => {
      const { ctx, t, d, m, s } = a; const { x, y } = lt(a);
      const o = outCubic(exit(t, d));
      const f1 = font(m, 400, 50 * s), f2 = font({ ...m, font: 'Inter' }, 700, 28 * s);
      const w1 = measure(ctx, m.texts[0], f1) + 48 * s, w2 = measure(ctx, m.texts[1], f2) + 40 * s;
      ctx.save(); ctx.globalAlpha = o;
      const k1 = outExpo(enter(t, 0, 0.5)), k2 = outExpo(enter(t, 0.18, 0.5));
      ctx.fillStyle = m.colors[0]; ctx.fillRect(x, y, w1 * k1, 80 * s);
      ctx.fillStyle = m.colors[2]; ctx.fillRect(x, y + 80 * s, w2 * k2, 52 * s);
      clipReveal(ctx, x, y, w1, 80 * s, enter(t, 0.2, 0.4), () => text(ctx, m.texts[0], x + 24 * s, y + 42 * s, f1, m.colors[1]));
      clipReveal(ctx, x, y + 80 * s, w2, 52 * s, enter(t, 0.35, 0.4), () => text(ctx, m.texts[1], x + 20 * s, y + 107 * s, f2, '#111111'));
      ctx.restore();
    } },
  { id: 'lt-glass', name: 'Vidro', cat: 'lower', fields: ['Nome', 'Função'], texts: ['Marina Costa', 'Nutricionista'], colors: ['rgba(255,255,255,0.18)', '#ffffff', '#22d3ee'], font: 'Poppins', duration: 5,
    draw: (a) => {
      const { ctx, t, d, m, s } = a; const { x, y } = lt(a);
      const k = outBack(enter(t, 0, 0.55)), o = outCubic(exit(t, d)) * clamp(enter(t, 0, 0.2) * 3);
      const f1 = font(m, 700, 46 * s), f2 = font(m, 400, 28 * s);
      const w = Math.max(measure(ctx, m.texts[0], f1), measure(ctx, m.texts[1], f2)) + 120 * s;
      ctx.save(); ctx.globalAlpha = o;
      ctx.translate(x, y + 60 * s); ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k); ctx.translate(-x, -(y + 60 * s));
      ctx.fillStyle = m.colors[0]; rr(ctx, x, y, w, 120 * s, 60 * s); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2 * s; ctx.stroke();
      ctx.fillStyle = m.colors[2]; ctx.beginPath(); ctx.arc(x + 58 * s, y + 60 * s, 22 * s, 0, Math.PI * 2); ctx.fill();
      text(ctx, m.texts[0], x + 100 * s, y + 44 * s, f1, m.colors[1]);
      text(ctx, m.texts[1], x + 100 * s, y + 84 * s, f2, 'rgba(255,255,255,0.8)');
      ctx.restore();
    } },
  { id: 'lt-news', name: 'Jornal', cat: 'lower', fields: ['Etiqueta', 'Manchete', 'Rodapé'], texts: ['AO VIVO', 'Mercado bate recorde nesta semana', 'Atualizado agora · Fonte: redação'], colors: ['#dc2626', '#ffffff', '#0f172a'], font: 'Roboto', duration: 6,
    draw: (a) => {
      const { ctx, t, d, m, s, W } = a; const y = a.H * (a.portrait ? 0.76 : 0.8);
      const o = outCubic(exit(t, d)); const k = outExpo(enter(t, 0, 0.6));
      const f0 = font(m, 900, 30 * s), f1 = font(m, 900, 40 * s), f2 = font(m, 500, 24 * s);
      ctx.save(); ctx.globalAlpha = o;
      ctx.fillStyle = m.colors[1]; ctx.fillRect(0, y, W * k, 86 * s);
      ctx.fillStyle = m.colors[2]; ctx.fillRect(0, y + 86 * s, W * outExpo(enter(t, 0.15, 0.6)), 44 * s);
      const lw = measure(ctx, m.texts[0], f0, 2 * s) + 40 * s;
      ctx.fillStyle = m.colors[0]; ctx.fillRect(0, y, (lw + 30 * s) * outBack(enter(t, 0.25, 0.4)), 86 * s);
      if (Math.sin(t * 6) > -0.2) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(22 * s, y + 43 * s, 7 * s, 0, Math.PI * 2); ctx.fill(); }
      text(ctx, m.texts[0], 38 * s, y + 44 * s, f0, '#fff', 'left', 2 * s);
      clipReveal(ctx, lw + 40 * s, y, W, 86 * s, enter(t, 0.4, 0.5), () => text(ctx, m.texts[1], lw + 50 * s, y + 44 * s, f1, m.colors[2]));
      // ticker
      ctx.save(); ctx.beginPath(); ctx.rect(0, y + 86 * s, W, 44 * s); ctx.clip();
      const tw = measure(ctx, m.texts[2], f2) + 120 * s;
      for (let xx = W - ((t * 120 * s) % tw) - tw; xx < W; xx += tw) text(ctx, m.texts[2] + '   •', xx, y + 108 * s, f2, '#fff');
      ctx.restore();
      ctx.restore();
    } },
  { id: 'lt-pill', name: 'Gradiente', cat: 'lower', fields: ['Nome', 'Função'], texts: ['Lucas Prado', 'Personal Trainer'], colors: ['#f97316', '#ec4899', '#ffffff'], font: 'Poppins', duration: 5,
    draw: (a) => {
      const { ctx, t, d, m, s } = a; const { x, y } = lt(a);
      const o = outCubic(exit(t, d)); const k = outExpo(enter(t, 0, 0.6));
      const f1 = font(m, 800, 44 * s), f2 = font(m, 500, 26 * s);
      const w = Math.max(measure(ctx, m.texts[0], f1), measure(ctx, m.texts[1], f2)) + 80 * s;
      ctx.save(); ctx.globalAlpha = o;
      const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, m.colors[0]); g.addColorStop(1, m.colors[1]);
      shadow(ctx, s, 0.3); ctx.fillStyle = g; rr(ctx, x, y, Math.max(116 * s, w * k), 116 * s, 58 * s); ctx.fill(); ctx.shadowColor = 'transparent';
      const tk = outCubic(enter(t, 0.3, 0.5));
      ctx.globalAlpha = o * tk;
      text(ctx, m.texts[0], x + 40 * s, y + 44 * s + (1 - tk) * 20 * s, f1, m.colors[2]);
      text(ctx, m.texts[1], x + 40 * s, y + 82 * s + (1 - tk) * 20 * s, f2, m.colors[2]);
      ctx.restore();
    } },
  { id: 'lt-line', name: 'Linha fina', cat: 'lower', fields: ['Nome', 'Função'], texts: ['Beatriz Alves', 'Arquiteta'], colors: ['#ffffff', '#facc15', '#ffffff'], font: 'Raleway', duration: 5,
    draw: (a) => {
      const { ctx, t, d, m, s } = a; const { x, y } = lt(a);
      const o = outCubic(exit(t, d));
      const f1 = font(m, 800, 52 * s), f2 = font(m, 500, 28 * s);
      const w = Math.max(measure(ctx, m.texts[0], f1), measure(ctx, m.texts[1], f2, 4 * s)) + 20 * s;
      ctx.save(); ctx.globalAlpha = o;
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10 * s;
      ctx.fillStyle = m.colors[1]; ctx.fillRect(x, y + 62 * s, w * outExpo(enter(t, 0, 0.7)), 4 * s);
      clipReveal(ctx, x, y - 10 * s, w + 20 * s, 70 * s, 1, () => text(ctx, m.texts[0], x, y + 30 * s + (1 - outCubic(enter(t, 0.2, 0.5))) * 60 * s, f1, m.colors[0]));
      clipReveal(ctx, x, y + 68 * s, w + 20 * s, 60 * s, 1, () => text(ctx, m.texts[1].toUpperCase(), x, y + 96 * s - (1 - outCubic(enter(t, 0.35, 0.5))) * 50 * s, f2, m.colors[2], 'left', 4 * s));
      ctx.restore();
    } },
  { id: 'lt-handle', name: '@ Perfil', cat: 'social', fields: ['Perfil', 'Chamada'], texts: ['@seuperfil', 'Siga para mais dicas'], colors: ['#111111', '#ffffff', '#ec4899'], font: 'Poppins', duration: 5,
    draw: (a) => {
      const { ctx, t, d, m, s } = a; const { x, y } = lt(a);
      const o = outCubic(exit(t, d)); const k = outBack(enter(t, 0, 0.5));
      const f1 = font(m, 700, 42 * s), f2 = font(m, 500, 24 * s);
      const w = Math.max(measure(ctx, m.texts[0], f1), measure(ctx, m.texts[1], f2)) + 150 * s;
      ctx.save(); ctx.globalAlpha = o;
      ctx.fillStyle = m.colors[0]; rr(ctx, x, y, Math.max(110 * s, w * outExpo(enter(t, 0.1, 0.6))), 110 * s, 55 * s); ctx.fill();
      const g = ctx.createLinearGradient(x, y, x + 110 * s, y + 110 * s); g.addColorStop(0, '#f59e0b'); g.addColorStop(0.5, m.colors[2]); g.addColorStop(1, '#7c3aed');
      ctx.save(); ctx.translate(x + 55 * s, y + 55 * s); ctx.scale(k, k);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 42 * s, 0, Math.PI * 2); ctx.fill();
      text(ctx, '@', 0, 2 * s, font(m, 800, 44 * s), '#fff', 'center');
      ctx.restore();
      clipReveal(ctx, x + 110 * s, y, w, 110 * s, enter(t, 0.3, 0.5), () => {
        text(ctx, m.texts[0], x + 120 * s, y + 42 * s, f1, m.colors[1]);
        text(ctx, m.texts[1], x + 120 * s, y + 76 * s, f2, 'rgba(255,255,255,0.75)');
      });
      ctx.restore();
    } },
  { id: 'lt-tech', name: 'Tech', cat: 'lower', fields: ['Nome', 'Função'], texts: ['DR. RAFAEL', 'NEUROCIENTISTA'], colors: ['#22d3ee', '#ffffff', 'rgba(0,0,0,0.55)'], font: 'Space Grotesk', duration: 5,
    draw: (a) => {
      const { ctx, t, d, m, s } = a; const { x, y } = lt(a);
      const o = outCubic(exit(t, d));
      const f1 = font(m, 700, 46 * s), f2 = font(m, 400, 26 * s);
      const full1 = m.texts[0], full2 = m.texts[1];
      const n1 = Math.ceil(full1.length * enter(t, 0.3, 0.6)), n2 = Math.ceil(full2.length * enter(t, 0.7, 0.6));
      const w = Math.max(measure(ctx, full1, f1, 3 * s), measure(ctx, full2, f2, 3 * s)) + 60 * s, h = 120 * s;
      ctx.save(); ctx.globalAlpha = o;
      const kb = outExpo(enter(t, 0, 0.5));
      ctx.fillStyle = m.colors[2]; ctx.fillRect(x, y, w * kb, h);
      ctx.strokeStyle = m.colors[0]; ctx.lineWidth = 3 * s; const c = 22 * s;
      ctx.beginPath(); ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y); ctx.moveTo(x + w * kb - c, y + h); ctx.lineTo(x + w * kb, y + h); ctx.lineTo(x + w * kb, y + h - c); ctx.stroke();
      text(ctx, full1.slice(0, n1) + (n1 < full1.length && Math.sin(t * 20) > 0 ? '▌' : ''), x + 28 * s, y + 44 * s, f1, m.colors[1], 'left', 3 * s);
      text(ctx, full2.slice(0, n2), x + 28 * s, y + 86 * s, f2, m.colors[0], 'left', 3 * s);
      ctx.restore();
    } },
  // ======== TITLES ========
  { id: 'title-cine', name: 'Cinematográfico', cat: 'title', fields: ['Título', 'Subtítulo'], texts: ['A JORNADA', 'Um filme de Magnata'], colors: ['#ffffff', '#d4d4d4'], font: 'Cinzel', duration: 5,
    draw: (a) => {
      const { ctx, t, d, m, s, W, H } = a;
      const k = outCubic(enter(t, 0, 1.4)), o = outCubic(exit(t, d, 0.8));
      ctx.save(); ctx.globalAlpha = o * clamp(enter(t, 0, 0.8));
      const sp = (8 + 18 * k) * s;
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20 * s;
      text(ctx, m.texts[0], W / 2, H / 2 - 20 * s, font(m, 700, 92 * s), m.colors[0], 'center', sp);
      ctx.globalAlpha = o * clamp(enter(t, 0.6, 0.8));
      ctx.fillStyle = m.colors[1];
      const lw = 260 * s * outCubic(enter(t, 0.5, 1));
      ctx.fillRect(W / 2 - lw, H / 2 + 50 * s, lw * 2, 2 * s);
      text(ctx, m.texts[1].toUpperCase(), W / 2, H / 2 + 90 * s, font({ ...m, font: 'Inter' }, 400, 26 * s), m.colors[1], 'center', 6 * s);
      ctx.restore();
    } },
  { id: 'title-pop', name: 'Pop impacto', cat: 'title', fields: ['Texto'], texts: ['NÃO ERRE ISSO'], colors: ['#facc15', '#111111', '#ffffff'], font: 'Archivo Black', duration: 3,
    draw: (a) => {
      const { ctx, t, d, m, s, W, H } = a;
      const k = outBack(enter(t, 0, 0.35)), o = outCubic(exit(t, d, 0.3));
      const f = font(m, 400, 92 * s); const w = measure(ctx, m.texts[0], f) + 70 * s;
      ctx.save(); ctx.globalAlpha = o; ctx.translate(W / 2, H / 2); ctx.rotate(-0.05); ctx.scale(k, k);
      ctx.fillStyle = m.colors[1]; ctx.fillRect(-w / 2 + 12 * s, -64 * s + 12 * s, w, 128 * s);
      ctx.fillStyle = m.colors[0]; ctx.fillRect(-w / 2, -64 * s, w, 128 * s);
      text(ctx, m.texts[0], 0, 4 * s, f, m.colors[1], 'center');
      ctx.restore();
    } },
  { id: 'title-glitch', name: 'Glitch', cat: 'title', fields: ['Texto'], texts: ['ATENÇÃO'], colors: ['#ffffff', '#ff0055', '#00e5ff'], font: 'Orbitron', duration: 3,
    draw: (a) => {
      const { ctx, t, d, m, s, W, H } = a;
      const o = outCubic(exit(t, d, 0.3)) * clamp(enter(t, 0, 0.15) * 2);
      const f = font(m, 900, 100 * s);
      const j = (t < 0.5 || Math.sin(t * 13) > 0.92) ? (Math.sin(t * 90) * 14 * s) : 0;
      ctx.save(); ctx.globalAlpha = o;
      ctx.globalCompositeOperation = 'lighter';
      text(ctx, m.texts[0], W / 2 + j, H / 2, f, m.colors[1], 'center');
      text(ctx, m.texts[0], W / 2 - j, H / 2, f, m.colors[2], 'center');
      ctx.globalCompositeOperation = 'source-over';
      text(ctx, m.texts[0], W / 2, H / 2, f, m.colors[0], 'center');
      if (j) { ctx.fillStyle = m.colors[2]; ctx.fillRect(W / 2 - 300 * s, H / 2 + Math.sin(t * 50) * 40 * s, 600 * s, 6 * s); }
      ctx.restore();
    } },
  { id: 'title-stack', name: 'Empilhado', cat: 'title', fields: ['Linha pequena', 'Linha grande'], texts: ['COMO EU', 'FIQUEI RICO'], colors: ['#ffffff', '#22c55e'], font: 'Anton', duration: 4,
    draw: (a) => {
      const { ctx, t, d, m, s, W, H } = a;
      const o = outCubic(exit(t, d, 0.35));
      const f1 = font(m, 400, 60 * s), f2 = font(m, 400, 140 * s);
      ctx.save(); ctx.globalAlpha = o; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16 * s;
      const w2 = measure(ctx, m.texts[1], f2);
      clipReveal(ctx, W / 2 - w2, H / 2 - 120 * s, w2 * 2, 70 * s, 1, () => text(ctx, m.texts[0], W / 2, H / 2 - 82 * s + (1 - outCubic(enter(t, 0, 0.5))) * 70 * s, f1, m.colors[0], 'center', 6 * s));
      clipReveal(ctx, W / 2 - w2, H / 2 - 50 * s, w2 * 2, 150 * s, 1, () => text(ctx, m.texts[1], W / 2, H / 2 + 22 * s + (1 - outExpo(enter(t, 0.15, 0.6))) * 150 * s, f2, m.colors[1], 'center'));
      ctx.restore();
    } },
  { id: 'title-neon', name: 'Neon', cat: 'title', fields: ['Texto'], texts: ['ABERTO'], colors: ['#ff4fd8', '#ffffff'], font: 'Monoton', duration: 4,
    draw: (a) => {
      const { ctx, t, d, m, s, W, H } = a;
      const flick = t < 0.8 ? (Math.sin(t * 60) > 0.2 ? 1 : 0.15) : (Math.sin(t * 40) > 0.97 ? 0.4 : 1);
      ctx.save(); ctx.globalAlpha = outCubic(exit(t, d, 0.4)) * flick;
      const f = font(m, 400, 110 * s);
      ctx.shadowColor = m.colors[0]; ctx.shadowBlur = 40 * s;
      text(ctx, m.texts[0], W / 2, H / 2, f, m.colors[0], 'center');
      ctx.shadowBlur = 12 * s;
      text(ctx, m.texts[0], W / 2, H / 2, f, m.colors[1], 'center');
      ctx.restore();
    } },
  { id: 'title-chapter', name: 'Capítulo', cat: 'title', fields: ['Número', 'Título'], texts: ['01', 'O começo de tudo'], colors: ['#ffffff', '#f97316'], font: 'Playfair Display', duration: 4,
    draw: (a) => {
      const { ctx, t, d, m, s, W, H } = a;
      const o = outCubic(exit(t, d, 0.5));
      ctx.save(); ctx.globalAlpha = o; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14 * s;
      ctx.globalAlpha = o * clamp(enter(t, 0, 0.6));
      text(ctx, 'CAPÍTULO', W / 2, H / 2 - 120 * s, font({ ...m, font: 'Inter' }, 600, 26 * s), m.colors[1], 'center', 10 * s);
      const k = outBack(enter(t, 0.1, 0.6));
      ctx.save(); ctx.translate(W / 2, H / 2 - 30 * s); ctx.scale(k, k);
      text(ctx, m.texts[0], 0, 0, font(m, 900, 130 * s, true), m.colors[0], 'center');
      ctx.restore();
      ctx.globalAlpha = o * clamp(enter(t, 0.5, 0.6));
      text(ctx, m.texts[1], W / 2, H / 2 + 80 * s, font(m, 700, 46 * s, true), m.colors[0], 'center');
      ctx.restore();
    } },
  // ======== SOCIAL ========
  { id: 'subscribe', name: 'Inscreva-se', cat: 'social', fields: ['Botão', 'Nome do canal'], texts: ['INSCREVA-SE', 'Seu Canal'], colors: ['#ff0000', '#ffffff', '#272727'], font: 'Roboto', duration: 4,
    draw: (a) => {
      const { ctx, t, d, m, s, W, H } = a;
      const o = outCubic(exit(t, d, 0.4)); const k = outBack(enter(t, 0, 0.5));
      const cx = W / 2, cy = H * (a.portrait ? 0.7 : 0.75);
      const clicked = t > 1.4;
      const f = font(m, 700, 36 * s); const bw = measure(ctx, clicked ? 'INSCRITO' : m.texts[0], f) + 70 * s;
      ctx.save(); ctx.globalAlpha = o; ctx.translate(cx, cy); ctx.scale(k, k);
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; rr(ctx, -bw / 2 - 150 * s, -55 * s, bw + 300 * s, 110 * s, 55 * s); ctx.fill();
      ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(-bw / 2 - 95 * s, 0, 38 * s, 0, Math.PI * 2); ctx.fill();
      text(ctx, m.texts[1].slice(0, 1).toUpperCase(), -bw / 2 - 95 * s, 2 * s, font(m, 700, 36 * s), '#555', 'center');
      const press = clicked && t < 1.6 ? 0.92 : 1;
      ctx.save(); ctx.translate(bw / 2 - 40 * s, 0); ctx.scale(press, press);
      ctx.fillStyle = clicked ? m.colors[2] : m.colors[0]; rr(ctx, -bw / 2, -36 * s, bw, 72 * s, 36 * s); ctx.fill();
      text(ctx, clicked ? 'INSCRITO' : m.texts[0], 0, 2 * s, f, m.colors[1], 'center');
      ctx.restore();
      // bell
      const bx = bw + 40 * s - bw / 2 + 20 * s;
      ctx.save(); ctx.translate(bx, 0); if (t > 1.8) ctx.rotate(Math.sin((t - 1.8) * 30) * 0.4 * Math.exp(-(t - 1.8) * 3));
      text(ctx, '🔔', 0, 0, `${Math.round(44 * s)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji"`, '#000', 'center');
      ctx.restore();
      // cursor
      const cp = outCubic(enter(t, 0.6, 0.7));
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2 * s;
      const px = bw / 2 - 40 * s + (1 - cp) * 220 * s, py = 10 * s + (1 - cp) * 160 * s;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 26 * s, py + 30 * s); ctx.lineTo(px + 12 * s, py + 30 * s); ctx.lineTo(px + 20 * s, py + 46 * s); ctx.lineTo(px + 12 * s, py + 50 * s); ctx.lineTo(px + 4 * s, py + 34 * s); ctx.lineTo(px - 6 * s, py + 42 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    } },
  { id: 'follow-heart', name: 'Curta e siga', cat: 'social', fields: ['Texto'], texts: ['Curta e siga para mais'], colors: ['#ff2d55', '#ffffff'], font: 'Poppins', duration: 3.5,
    draw: (a) => {
      const { ctx, t, d, m, s, W, H } = a;
      const o = outCubic(exit(t, d, 0.4)); const cx = W / 2, cy = H * 0.68;
      ctx.save(); ctx.globalAlpha = o;
      const k = outBack(enter(t, 0, 0.45));
      const beat = 1 + 0.12 * Math.max(0, Math.sin(t * 7)) * (t > 0.6 ? 1 : 0);
      ctx.save(); ctx.translate(cx, cy - 70 * s); ctx.scale(k * beat, k * beat);
      ctx.fillStyle = m.colors[0]; ctx.beginPath();
      const r = 46 * s; ctx.moveTo(0, r * 0.9); ctx.bezierCurveTo(-r * 1.6, -r * 0.2, -r * 0.6, -r * 1.3, 0, -r * 0.45); ctx.bezierCurveTo(r * 0.6, -r * 1.3, r * 1.6, -r * 0.2, 0, r * 0.9); ctx.fill();
      ctx.restore();
      for (let i = 0; i < 10; i++) { const a2 = (i / 10) * Math.PI * 2, pr = enter(t, 0.15, 0.6); if (pr <= 0 || pr >= 1) continue; ctx.globalAlpha = o * (1 - pr); ctx.fillStyle = m.colors[0]; ctx.beginPath(); ctx.arc(cx + Math.cos(a2) * 120 * s * pr, cy - 70 * s + Math.sin(a2) * 120 * s * pr, 8 * s, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = o * clamp(enter(t, 0.35, 0.4));
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12 * s;
      text(ctx, m.texts[0], cx, cy + 40 * s, font(m, 700, 44 * s), m.colors[1], 'center');
      ctx.restore();
    } },
  // ======== CALLOUTS ========
  { id: 'callout-circle', name: 'Destaque com seta', cat: 'callout', fields: ['Texto'], texts: ['Olha isso!'], colors: ['#facc15', '#111111'], font: 'Permanent Marker', duration: 3.5,
    draw: (a) => {
      const { ctx, t, d, m, s, W, H } = a;
      const o = outCubic(exit(t, d, 0.4)); const cx = W * 0.5, cy = H * 0.45, r = 130 * s;
      ctx.save(); ctx.globalAlpha = o; ctx.strokeStyle = m.colors[0]; ctx.lineWidth = 9 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.25, r, -0.15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2.1 * outCubic(enter(t, 0, 0.6))); ctx.stroke();
      const ak = outCubic(enter(t, 0.45, 0.4));
      const ax0 = cx + r * 2.1, ay0 = cy + r * 1.7, ax1 = cx + r * 1.3, ay1 = cy + r * 0.8;
      const ex = ax0 + (ax1 - ax0) * ak, ey = ay0 + (ay1 - ay0) * ak;
      ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.quadraticCurveTo(ax0 - 10 * s, ay1 + 60 * s, ex, ey); ctx.stroke();
      if (ak > 0.95) { ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + 34 * s, ey + 6 * s); ctx.moveTo(ex, ey); ctx.lineTo(ex + 6 * s, ey + 34 * s); ctx.stroke(); }
      const tk = outBack(enter(t, 0.7, 0.4));
      ctx.save(); ctx.translate(ax0, ay0 + 50 * s); ctx.scale(tk, tk); ctx.rotate(-0.06);
      const f = font(m, 400, 50 * s); const w = measure(ctx, m.texts[0], f) + 40 * s;
      ctx.fillStyle = m.colors[0]; rr(ctx, -w / 2, -40 * s, w, 80 * s, 14 * s); ctx.fill();
      text(ctx, m.texts[0], 0, 2 * s, f, m.colors[1], 'center');
      ctx.restore(); ctx.restore();
    } },
  { id: 'location', name: 'Localização', cat: 'callout', fields: ['Lugar', 'Detalhe'], texts: ['Rio de Janeiro', 'Brasil'], colors: ['#ef4444', '#ffffff'], font: 'Montserrat', duration: 4,
    draw: (a) => {
      const { ctx, t, d, m, s } = a; const x = a.W * 0.08, y = a.H * (a.portrait ? 0.12 : 0.15);
      const o = outCubic(exit(t, d, 0.4)); const drop = outBack(enter(t, 0, 0.5));
      ctx.save(); ctx.globalAlpha = o;
      ctx.save(); ctx.translate(x + 30 * s, y + 40 * s - (1 - drop) * 80 * s);
      ctx.fillStyle = m.colors[0]; ctx.beginPath(); ctx.arc(0, -10 * s, 26 * s, Math.PI, 0); ctx.lineTo(0, 34 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -10 * s, 10 * s, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10 * s;
      clipReveal(ctx, x + 70 * s, y - 10 * s, 900 * s, 120 * s, enter(t, 0.3, 0.6), () => {
        text(ctx, m.texts[0], x + 76 * s, y + 24 * s, font(m, 800, 44 * s), m.colors[1]);
        text(ctx, m.texts[1].toUpperCase(), x + 78 * s, y + 66 * s, font(m, 500, 24 * s), 'rgba(255,255,255,0.8)', 'left', 4 * s);
      });
      ctx.restore();
    } },
  { id: 'quote', name: 'Citação', cat: 'callout', fields: ['Frase', 'Autor'], texts: ['A disciplina é a ponte entre metas e conquistas.', 'Jim Rohn'], colors: ['#ffffff', '#facc15', 'rgba(0,0,0,0.55)'], font: 'Playfair Display', duration: 6,
    draw: (a) => {
      const { ctx, t, d, m, s, W, H } = a;
      const o = outCubic(exit(t, d, 0.5));
      ctx.save(); ctx.globalAlpha = o * clamp(enter(t, 0, 0.5));
      const f = font(m, 700, 52 * s, true);
      // wrap
      const words = m.texts[0].split(' '); const lines: string[] = []; let line = '';
      for (const w of words) { const tst = line ? line + ' ' + w : w; if (measure(ctx, tst, f) > W * 0.74 && line) { lines.push(line); line = w; } else line = tst; }
      if (line) lines.push(line);
      const lh = 66 * s, h = lines.length * lh + 160 * s;
      ctx.fillStyle = m.colors[2]; rr(ctx, W * 0.06, H / 2 - h / 2, W * 0.88, h, 24 * s); ctx.fill();
      text(ctx, '“', W * 0.12, H / 2 - h / 2 + 50 * s, font(m, 900, 140 * s), m.colors[1]);
      lines.forEach((l, i) => { const k = outCubic(enter(t, 0.2 + i * 0.15, 0.5)); ctx.globalAlpha = o * k; text(ctx, l, W / 2, H / 2 - h / 2 + 100 * s + i * lh + (1 - k) * 20 * s, f, m.colors[0], 'center'); });
      ctx.globalAlpha = o * clamp(enter(t, 0.6 + lines.length * 0.15, 0.5));
      text(ctx, '— ' + m.texts[1], W / 2, H / 2 + h / 2 - 40 * s, font({ ...m, font: 'Inter' }, 600, 28 * s), m.colors[1], 'center');
      ctx.restore();
    } },
  { id: 'sale', name: 'Oferta', cat: 'callout', fields: ['Destaque', 'Texto'], texts: ['50%', 'OFF HOJE'], colors: ['#ef4444', '#ffffff', '#facc15'], font: 'Archivo Black', duration: 3.5,
    draw: (a) => {
      const { ctx, t, d, m, s, W, H } = a;
      const o = outCubic(exit(t, d, 0.4)); const k = outBack(enter(t, 0, 0.5));
      ctx.save(); ctx.globalAlpha = o; ctx.translate(W * 0.72, H * 0.3); ctx.rotate((1 - k) * -2 + 0.15 + Math.sin(t * 3) * 0.03); ctx.scale(k, k);
      ctx.fillStyle = m.colors[0]; ctx.beginPath();
      for (let i = 0; i < 32; i++) { const r = (i % 2 ? 120 : 140) * s, an = (i / 32) * Math.PI * 2; i ? ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r) : ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r); }
      ctx.closePath(); ctx.fill();
      text(ctx, m.texts[0], 0, -14 * s, font(m, 400, 76 * s), m.colors[1], 'center');
      text(ctx, m.texts[1], 0, 50 * s, font(m, 400, 26 * s), m.colors[2], 'center');
      ctx.restore();
    } },
  // ======== DATA ========
  { id: 'counter', name: 'Contador', cat: 'data', fields: ['Número final', 'Legenda'], texts: ['10000', 'seguidores em 30 dias'], colors: ['#ffffff', '#22c55e'], font: 'Inter Tight', duration: 4,
    draw: (a) => {
      const { ctx, t, d, m, s, W, H } = a;
      const o = outCubic(exit(t, d, 0.4)); const target = parseFloat(m.texts[0].replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
      const v = target * outExpo(enter(t, 0.1, 1.6));
      const str = (Number.isInteger(target) ? Math.round(v).toLocaleString('pt-BR') : v.toFixed(1)) + m.texts[0].replace(/[\d.,\s-]/g, '');
      ctx.save(); ctx.globalAlpha = o * clamp(enter(t, 0, 0.3)); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16 * s;
      text(ctx, '+' + str, W / 2, H / 2 - 20 * s, font(m, 900, 130 * s), m.colors[1], 'center');
      text(ctx, m.texts[1], W / 2, H / 2 + 80 * s, font(m, 600, 40 * s), m.colors[0], 'center');
      ctx.restore();
    } },
  { id: 'progress', name: 'Barra de progresso', cat: 'data', fields: ['Rótulo'], texts: [''], colors: ['#ec4899', 'rgba(255,255,255,0.25)'], font: 'Inter', duration: 10,
    draw: (a) => {
      const { ctx, t, d, m, s, W } = a;
      const y = 26 * s, h = 12 * s;
      ctx.save();
      ctx.fillStyle = m.colors[1]; rr(ctx, 30 * s, y, W - 60 * s, h, h / 2); ctx.fill();
      ctx.fillStyle = m.colors[0]; rr(ctx, 30 * s, y, (W - 60 * s) * clamp(t / Math.max(0.1, d)), h, h / 2); ctx.fill();
      if (m.texts[0]) text(ctx, m.texts[0], 30 * s, y + 40 * s, font(m, 700, 26 * s), '#fff');
      ctx.restore();
    } },
  { id: 'countdown', name: 'Contagem 3-2-1', cat: 'data', fields: ['Texto final'], texts: ['VAI!'], colors: ['#ffffff', '#7c3aed'], font: 'Archivo Black', duration: 4,
    draw: (a) => {
      const { ctx, t, m, s, W, H } = a;
      const n = 3 - Math.floor(t); const ph = t % 1;
      ctx.save();
      const cx = W / 2, cy = H / 2, r = 150 * s;
      ctx.lineWidth = 14 * s; ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      if (n > 0) {
        ctx.strokeStyle = m.colors[1]; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ph); ctx.stroke();
        const k = outBack(clamp(ph * 3));
        ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); text(ctx, String(n), 0, 6 * s, font(m, 400, 160 * s), m.colors[0], 'center'); ctx.restore();
      } else {
        const k = outBack(clamp(ph * 3));
        ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); text(ctx, m.texts[0], 0, 6 * s, font(m, 400, 110 * s), m.colors[1], 'center'); ctx.restore();
      }
      ctx.restore();
    } },
  { id: 'checklist', name: 'Checklist', cat: 'data', fields: ['Item 1', 'Item 2', 'Item 3'], texts: ['Roteiro pronto', 'Luz e áudio', 'Postar às 19h'], colors: ['#ffffff', '#22c55e', 'rgba(0,0,0,0.5)'], font: 'Poppins', duration: 5,
    draw: (a) => {
      const { ctx, t, d, m, s, W, H } = a;
      const o = outCubic(exit(t, d, 0.4));
      ctx.save(); ctx.globalAlpha = o;
      const items = m.texts.filter(Boolean);
      const x = W * 0.12, y0 = H / 2 - items.length * 55 * s;
      items.forEach((it, i) => {
        const k = outBack(enter(t, 0.2 + i * 0.5, 0.4)); const ck = outCubic(enter(t, 0.45 + i * 0.5, 0.3));
        const y = y0 + i * 110 * s;
        ctx.save(); ctx.globalAlpha = o * clamp(k); ctx.translate((1 - k) * -60 * s, 0);
        ctx.fillStyle = m.colors[2]; rr(ctx, x, y, W * 0.76, 90 * s, 20 * s); ctx.fill();
        ctx.fillStyle = ck > 0 ? m.colors[1] : 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(x + 46 * s, y + 45 * s, 24 * s, 0, Math.PI * 2); ctx.fill();
        if (ck > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 6 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 34 * s, y + 46 * s); ctx.lineTo(x + 34 * s + 8 * s * Math.min(1, ck * 2), y + 46 * s + 8 * s * Math.min(1, ck * 2)); if (ck > 0.5) ctx.lineTo(x + 42 * s + 14 * s * (ck - 0.5) * 2, y + 54 * s - 20 * s * (ck - 0.5) * 2); ctx.stroke(); }
        text(ctx, it, x + 90 * s, y + 47 * s, font(m, 600, 38 * s), m.colors[0]);
        ctx.restore();
      });
      ctx.restore();
    } },
  { id: 'rec', name: 'Carimbo REC', cat: 'data', fields: ['Data'], texts: ['24 NOV 2026'], colors: ['#ef4444', '#ffffff'], font: 'Space Grotesk', duration: 6,
    draw: (a) => {
      const { ctx, t, m, s, W, H } = a;
      ctx.save();
      if (Math.floor(t * 1.5) % 2 === 0) { ctx.fillStyle = m.colors[0]; ctx.beginPath(); ctx.arc(60 * s, 70 * s, 14 * s, 0, Math.PI * 2); ctx.fill(); }
      text(ctx, 'REC', 86 * s, 72 * s, font(m, 700, 34 * s), m.colors[1]);
      const sec = Math.floor(t); const tc = `00:${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}:${String(Math.floor((t % 1) * 30)).padStart(2, '0')}`;
      text(ctx, tc, W - 50 * s, 72 * s, font(m, 500, 30 * s), m.colors[1], 'right');
      text(ctx, m.texts[0], W - 50 * s, H - 60 * s, font(m, 500, 30 * s), m.colors[1], 'right');
      ctx.strokeStyle = m.colors[1]; ctx.lineWidth = 3 * s; const c = 50 * s, p = 30 * s;
      ctx.beginPath();
      ctx.moveTo(p, p + c); ctx.lineTo(p, p); ctx.lineTo(p + c, p);
      ctx.moveTo(W - p - c, p); ctx.lineTo(W - p, p); ctx.lineTo(W - p, p + c);
      ctx.moveTo(p, H - p - c); ctx.lineTo(p, H - p); ctx.lineTo(p + c, H - p);
      ctx.moveTo(W - p - c, H - p); ctx.lineTo(W - p, H - p); ctx.lineTo(W - p, H - p - c);
      ctx.stroke();
      ctx.restore();
    } },
  // ======== END ========
  { id: 'end-thanks', name: 'Obrigado', cat: 'end', fields: ['Título', 'Chamada'], texts: ['Obrigado por assistir!', 'Veja também:'], colors: ['#ffffff', '#7c3aed', 'rgba(255,255,255,0.12)'], font: 'Poppins', duration: 6,
    draw: (a) => {
      const { ctx, t, d, m, s, W, H } = a;
      const o = outCubic(exit(t, d, 0.6));
      ctx.save(); ctx.globalAlpha = o;
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0f0c29'); g.addColorStop(1, m.colors[1]);
      ctx.globalAlpha = o * clamp(enter(t, 0, 0.6)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const k = outBack(enter(t, 0.3, 0.6));
      ctx.globalAlpha = o;
      ctx.save(); ctx.translate(W / 2, H * 0.28); ctx.scale(k, k); text(ctx, m.texts[0], 0, 0, font(m, 800, 56 * s), m.colors[0], 'center'); ctx.restore();
      ctx.globalAlpha = o * clamp(enter(t, 0.7, 0.5));
      text(ctx, m.texts[1], W / 2, H * 0.38, font(m, 500, 32 * s), 'rgba(255,255,255,0.8)', 'center');
      const bw = Math.min(W * 0.4, 420 * s), bh = bw * 0.5625, gap = 30 * s;
      const two = a.portrait ? [[W / 2 - bw / 2, H * 0.45], [W / 2 - bw / 2, H * 0.45 + bh + gap]] : [[W / 2 - bw - gap / 2, H * 0.48], [W / 2 + gap / 2, H * 0.48]];
      two.forEach(([bx, by], i) => {
        const kk = outBack(enter(t, 0.9 + i * 0.2, 0.5));
        ctx.save(); ctx.globalAlpha = o * clamp(kk); ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(kk, kk);
        ctx.fillStyle = m.colors[2]; rr(ctx, -bw / 2, -bh / 2, bw, bh, 20 * s); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3 * s; ctx.setLineDash([12 * s, 10 * s]); ctx.stroke(); ctx.setLineDash([]);
        text(ctx, '▶', 0, 0, font(m, 700, 50 * s), 'rgba(255,255,255,0.7)', 'center');
        ctx.restore();
      });
      ctx.restore();
    } },
  { id: 'end-logo', name: 'Logo final', cat: 'end', fields: ['Marca', 'Slogan'], texts: ['MAGNATA', 'criado no celular'], colors: ['#ffffff', '#ec4899', '#000000'], font: 'Montserrat', duration: 4,
    draw: (a) => {
      const { ctx, t, d, m, s, W, H } = a;
      const o = outCubic(exit(t, d, 0.6));
      ctx.save(); ctx.globalAlpha = o * clamp(enter(t, 0, 0.4)); ctx.fillStyle = m.colors[2]; ctx.fillRect(0, 0, W, H);
      const r = 90 * s * outBack(enter(t, 0.2, 0.6));
      ctx.globalAlpha = o; ctx.fillStyle = m.colors[1]; ctx.beginPath(); ctx.arc(W / 2, H / 2 - 70 * s, Math.max(0, r), 0, Math.PI * 2); ctx.fill();
      text(ctx, m.texts[0].slice(0, 1), W / 2, H / 2 - 66 * s, font(m, 900, 90 * s * clamp(r / (90 * s))), m.colors[0], 'center');
      clipReveal(ctx, 0, H / 2 + 20 * s, W, 80 * s, 1, () => text(ctx, m.texts[0], W / 2, H / 2 + 60 * s + (1 - outCubic(enter(t, 0.6, 0.5))) * 80 * s, font(m, 900, 60 * s), m.colors[0], 'center', 12 * s));
      ctx.globalAlpha = o * clamp(enter(t, 1, 0.5));
      text(ctx, m.texts[1], W / 2, H / 2 + 120 * s, font(m, 500, 28 * s), 'rgba(255,255,255,0.75)', 'center', 4 * s);
      ctx.restore();
    } },
];

export const MOTION_MAP = new Map(MOTION_TEMPLATES.map((m) => [m.id, m]));

export function defaultMotion(id: string): MotionData {
  const tpl = MOTION_MAP.get(id) ?? MOTION_TEMPLATES[0];
  return { template: tpl.id, texts: [...tpl.texts], colors: [...tpl.colors], font: tpl.font };
}

/** Draw a motion graphic frame onto a canvas of W x H (output pixels); projectW/H give the frame shape. */
export function drawMotion(ctx: Ctx, W: number, H: number, m: MotionData, t: number, d: number) {
  const tpl = MOTION_MAP.get(m.template);
  if (!tpl) return;
  ctx.clearRect(0, 0, W, H);
  const s = Math.min(W, H) / 1080;
  ctx.save();
  try { tpl.draw({ ctx, W, H, t: Math.max(0, t), d: Math.max(0.1, d), m, s, portrait: H > W }); } catch (e) { console.warn('motion', e); }
  ctx.restore();
}
