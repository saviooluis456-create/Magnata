import { clamp, ease, kfValue } from '../model/timeline';
import type { Clip } from '../model/types';

export interface AnimDef { id: string; name: string; icon: string }

export const IN_ANIMS: AnimDef[] = [
  { id: 'fade', name: 'Surgir', icon: '◐' },
  { id: 'zoom-in', name: 'Zoom in', icon: '⤢' },
  { id: 'zoom-out', name: 'Zoom out', icon: '⤡' },
  { id: 'slide-left', name: 'Deslizar ←', icon: '←' },
  { id: 'slide-right', name: 'Deslizar →', icon: '→' },
  { id: 'slide-up', name: 'Subir', icon: '↑' },
  { id: 'slide-down', name: 'Descer', icon: '↓' },
  { id: 'pop', name: 'Pop', icon: '✦' },
  { id: 'bounce', name: 'Quicar', icon: '⤒' },
  { id: 'spin', name: 'Girar', icon: '↻' },
  { id: 'spin-zoom', name: 'Redemoinho', icon: '🌀' },
  { id: 'blur', name: 'Desfoque', icon: '◌' },
  { id: 'drop', name: 'Cair', icon: '⬇' },
  { id: 'swing', name: 'Balanço', icon: '〰' },
  { id: 'flicker', name: 'Piscar', icon: '⚡' },
  { id: 'stretch', name: 'Esticar', icon: '↔' },
  { id: 'typewriter', name: 'Máquina de escrever', icon: '⌨' },
  { id: 'shake', name: 'Tremer', icon: '≋' },
];

export const OUT_ANIMS: AnimDef[] = IN_ANIMS.filter((a) => a.id !== 'typewriter');

export const LOOP_ANIMS: AnimDef[] = [
  { id: 'pulse', name: 'Pulsar', icon: '♥' },
  { id: 'float', name: 'Flutuar', icon: '☁' },
  { id: 'shake', name: 'Tremer', icon: '≋' },
  { id: 'wiggle', name: 'Balançar', icon: '〰' },
  { id: 'rotate', name: 'Rotação', icon: '↻' },
  { id: 'blink', name: 'Piscar', icon: '✧' },
  { id: 'heartbeat', name: 'Batimento', icon: '💓' },
  { id: 'zoom-slow', name: 'Ken Burns', icon: '🎞' },
  { id: 'swing', name: 'Pêndulo', icon: '⏲' },
  { id: 'jelly', name: 'Gelatina', icon: '🍮' },
];

export interface AnimState {
  x: number; y: number; scale: number; scaleX: number; scaleY: number; rotation: number; opacity: number; blur: number; reveal: number;
}

function applyAnim(id: string, p: number, s: AnimState, dirIn: boolean) {
  // p: 0 -> start of animation (hidden state for "in"), 1 -> fully visible
  const e = ease('easeOut', p);
  const inv = 1 - e;
  switch (id) {
    case 'fade': s.opacity *= e; break;
    case 'zoom-in': s.scale *= 0.4 + 0.6 * e; s.opacity *= clamp(p * 3, 0, 1); break;
    case 'zoom-out': s.scale *= 1 + 0.8 * inv; s.opacity *= clamp(p * 2, 0, 1); break;
    case 'slide-left': s.x += (dirIn ? 1 : -1) * 0.6 * inv; s.opacity *= clamp(p * 2, 0, 1); break;
    case 'slide-right': s.x -= (dirIn ? 1 : -1) * 0.6 * inv; s.opacity *= clamp(p * 2, 0, 1); break;
    case 'slide-up': s.y += (dirIn ? 1 : -1) * 0.4 * inv; s.opacity *= clamp(p * 2, 0, 1); break;
    case 'slide-down': s.y -= (dirIn ? 1 : -1) * 0.4 * inv; s.opacity *= clamp(p * 2, 0, 1); break;
    case 'pop': s.scale *= ease('back', p) || 0.001; s.opacity *= clamp(p * 4, 0, 1); break;
    case 'bounce': s.y -= 0.25 * (1 - ease('bounce', p)); s.opacity *= clamp(p * 4, 0, 1); break;
    case 'spin': s.rotation += 360 * inv; s.scale *= 0.3 + 0.7 * e; s.opacity *= clamp(p * 2, 0, 1); break;
    case 'spin-zoom': s.rotation -= 540 * inv; s.scale *= e || 0.001; break;
    case 'blur': s.blur += 1 - e; s.opacity *= clamp(p * 1.5, 0, 1); break;
    case 'drop': s.y -= 0.5 * (1 - ease('bounce', p)); break;
    case 'swing': s.rotation += 25 * Math.sin(p * Math.PI * 3) * inv; s.opacity *= clamp(p * 3, 0, 1); break;
    case 'flicker': s.opacity *= p >= 1 ? 1 : (Math.sin(p * 60) > 0 ? 1 : 0.15) * p; break;
    case 'stretch': s.scaleX *= 0.2 + 0.8 * ease('elastic', p); s.scaleY *= 1 + 0.6 * inv; break;
    case 'typewriter': s.reveal = Math.min(s.reveal, p); break;
    case 'shake': s.x += Math.sin(p * 70) * 0.04 * inv; s.opacity *= clamp(p * 4, 0, 1); break;
  }
}

function applyLoop(id: string, lt: number, cycle: number, s: AnimState) {
  const ph = (lt / Math.max(0.1, cycle)) * Math.PI * 2;
  switch (id) {
    case 'pulse': s.scale *= 1 + 0.06 * Math.sin(ph); break;
    case 'float': s.y += 0.015 * Math.sin(ph); break;
    case 'shake': s.x += 0.01 * Math.sin(ph * 7.3); s.y += 0.008 * Math.cos(ph * 9.1); break;
    case 'wiggle': s.rotation += 6 * Math.sin(ph); break;
    case 'rotate': s.rotation += (lt / Math.max(0.1, cycle)) * 360; break;
    case 'blink': s.opacity *= 0.55 + 0.45 * Math.cos(ph); break;
    case 'heartbeat': { const k = (ph / (Math.PI * 2)) % 1; s.scale *= 1 + 0.12 * Math.exp(-((k - 0.1) ** 2) / 0.003) + 0.08 * Math.exp(-((k - 0.3) ** 2) / 0.003); break; }
    case 'zoom-slow': s.scale *= 1 + 0.15 * clamp(lt / Math.max(0.5, cycle * 4), 0, 1); break;
    case 'swing': s.rotation += 12 * Math.sin(ph); break;
    case 'jelly': s.scaleX *= 1 + 0.08 * Math.sin(ph); s.scaleY *= 1 - 0.08 * Math.sin(ph); break;
  }
}

/** Final animated transform for a clip at timeline time t. */
export function animatedState(c: Clip, t: number): AnimState {
  const tf = c.transform;
  const s: AnimState = {
    x: kfValue(c, 'x', t, tf.x),
    y: kfValue(c, 'y', t, tf.y),
    scale: kfValue(c, 'scale', t, tf.scale),
    scaleX: 1,
    scaleY: 1,
    rotation: kfValue(c, 'rotation', t, tf.rotation),
    opacity: kfValue(c, 'opacity', t, tf.opacity),
    blur: kfValue(c, 'blur', t, 0),
    reveal: 1,
  };
  const lt = t - c.start;
  const { in: ain, out: aout, loop } = c.anims;
  if (ain && ain.duration > 0 && lt < ain.duration) applyAnim(ain.type, clamp(lt / ain.duration, 0, 1), s, true);
  if (aout && aout.duration > 0 && lt > c.duration - aout.duration) {
    applyAnim(aout.type, clamp((c.duration - lt) / aout.duration, 0, 1), s, false);
  }
  if (loop) applyLoop(loop.type, lt, loop.duration, s);
  s.opacity = clamp(s.opacity, 0, 1);
  return s;
}
