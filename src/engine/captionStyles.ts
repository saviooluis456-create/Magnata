import { defaultCaptionStyle } from '../model/defaults';
import type { CaptionStyle } from '../model/types';

export interface CaptionPreset { id: string; name: string; tag?: string; style: Partial<CaptionStyle> }

/** Caption presets covering the popular short-form styles (word highlight, karaoke, boxes, neon, minimal...). */
export const CAPTION_PRESETS: CaptionPreset[] = [
  { id: 'impacto', name: 'Impacto', tag: 'Viral', style: {} },
  { id: 'criador', name: 'Criador', tag: 'Viral', style: { font: 'Montserrat', weight: 900, uppercase: true, strokeWidth: 12, highlight: 'color', activeColor: '#4ade80', animation: 'pop', wordsPerPage: 3, keywordColors: true, keywordColor: '#facc15' } },
  { id: 'beast', name: 'Explosivo', tag: 'Viral', style: { font: 'Luckiest Guy', weight: 400, uppercase: true, size: 96, strokeWidth: 14, shadowBlur: 0, shadowY: 8, shadowColor: '#000000', highlight: 'scale', activeColor: '#ff3b30', activeScale: 1.25, animation: 'bounce', wordsPerPage: 2 } },
  { id: 'karaoke', name: 'Karaokê', style: { font: 'Poppins', weight: 800, uppercase: false, size: 72, strokeWidth: 0, shadowBlur: 16, highlight: 'karaoke', activeColor: '#38bdf8', animation: 'none', wordsPerPage: 6, maxCharsPerLine: 22, color: '#ffffff' } },
  { id: 'caixa', name: 'Caixa ativa', tag: 'Popular', style: { font: 'Montserrat', weight: 800, uppercase: true, size: 76, strokeWidth: 0, shadowBlur: 0, highlight: 'box', activeBg: '#7c3aed', activeColor: '#ffffff', animation: 'pop', wordsPerPage: 4 } },
  { id: 'caixa-verde', name: 'Caixa verde', style: { font: 'Poppins', weight: 900, uppercase: true, size: 74, strokeWidth: 0, shadowBlur: 0, highlight: 'box', activeBg: '#22c55e', activeColor: '#000000', animation: 'pop', wordsPerPage: 3 } },
  { id: 'faixa', name: 'Faixa preta', style: { font: 'Inter', weight: 700, uppercase: false, size: 60, strokeWidth: 0, shadowBlur: 0, bgMode: 'line', bgColor: '#000000', bgOpacity: 0.85, bgPadding: 16, bgRadius: 8, highlight: 'color', activeColor: '#facc15', animation: 'fade', wordsPerPage: 7, maxCharsPerLine: 26 } },
  { id: 'bloco', name: 'Bloco branco', style: { font: 'Inter', weight: 800, uppercase: false, size: 62, color: '#111111', strokeWidth: 0, shadowBlur: 0, bgMode: 'block', bgColor: '#ffffff', bgOpacity: 1, bgPadding: 22, bgRadius: 20, highlight: 'color', activeColor: '#e11d48', animation: 'zoom', wordsPerPage: 6, maxCharsPerLine: 22 } },
  { id: 'palavra', name: 'Uma palavra', tag: 'Viral', style: { font: 'Anton', weight: 400, uppercase: true, size: 130, strokeWidth: 12, highlight: 'none', animation: 'pop', wordsPerPage: 1, keywordColors: true } },
  { id: 'neon', name: 'Neon', style: { font: 'Righteous', weight: 400, uppercase: true, size: 84, color: '#ffffff', strokeWidth: 0, shadowBlur: 0, glowColor: '#22d3ee', glowSize: 28, highlight: 'glow', activeColor: '#f0abfc', animation: 'fade', wordsPerPage: 3 } },
  { id: 'minimal', name: 'Minimalista', style: { font: 'Inter', weight: 600, uppercase: false, size: 56, strokeWidth: 0, shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.6)', highlight: 'none', animation: 'fade', wordsPerPage: 8, maxCharsPerLine: 30, keywordColors: false } },
  { id: 'elegante', name: 'Elegante', style: { font: 'Playfair Display', weight: 700, italic: true, uppercase: false, size: 70, strokeWidth: 0, shadowBlur: 14, highlight: 'color', activeColor: '#fcd34d', animation: 'rise', wordsPerPage: 5, keywordColors: false } },
  { id: 'cinema', name: 'Cinema', style: { font: 'Cinzel', weight: 700, uppercase: true, size: 58, letterSpacing: 6, strokeWidth: 0, shadowBlur: 8, highlight: 'none', animation: 'fade', wordsPerPage: 6, maxCharsPerLine: 26, y: 0.85, keywordColors: false } },
  { id: 'quadrinho', name: 'Quadrinho', style: { font: 'Bangers', weight: 400, uppercase: true, size: 100, letterSpacing: 2, color: '#fde047', strokeWidth: 12, shadowColor: '#000000', shadowBlur: 0, shadowX: 6, shadowY: 6, highlight: 'scale', activeColor: '#ffffff', activeScale: 1.2, animation: 'shake', wordsPerPage: 3 } },
  { id: 'glitch', name: 'Glitch', style: { font: 'Orbitron', weight: 900, uppercase: true, size: 74, strokeWidth: 0, shadowBlur: 0, highlight: 'color', activeColor: '#22d3ee', animation: 'glitch', wordsPerPage: 3 } },
  { id: 'gamer', name: 'Gamer', style: { font: 'Press Start 2P', weight: 400, uppercase: true, size: 50, strokeWidth: 8, highlight: 'color', activeColor: '#a3e635', animation: 'typewriter', wordsPerPage: 3, maxCharsPerLine: 16 } },
  { id: 'onda', name: 'Onda', style: { font: 'Fredoka', weight: 700, uppercase: false, size: 82, strokeWidth: 10, strokeColor: '#1e1b4b', highlight: 'color', activeColor: '#fb7185', animation: 'wave', wordsPerPage: 4 } },
  { id: 'sublinhado', name: 'Sublinhado', style: { font: 'Poppins', weight: 800, uppercase: false, size: 72, strokeWidth: 0, shadowBlur: 12, highlight: 'underline', activeColor: '#f97316', animation: 'slide-up', wordsPerPage: 4 } },
  { id: 'contorno', name: 'Contorno', style: { font: 'Archivo Black', weight: 400, uppercase: true, size: 86, color: 'rgba(255,255,255,0)', strokeColor: '#ffffff', strokeWidth: 5, shadowBlur: 0, highlight: 'outline', activeColor: '#facc15', animation: 'pop', wordsPerPage: 3, keywordColors: false } },
  { id: 'gradiente', name: 'Gradiente', style: { font: 'Montserrat', weight: 900, uppercase: true, size: 88, color: '#f472b6', gradient: '#8b5cf6', strokeWidth: 0, shadowBlur: 18, highlight: 'scale', activeScale: 1.15, animation: 'pop', wordsPerPage: 3, keywordColors: false } },
  { id: 'podcast', name: 'Podcast', style: { font: 'Inter', weight: 800, uppercase: false, size: 64, strokeWidth: 0, shadowBlur: 0, bgMode: 'word', bgColor: '#000000', bgOpacity: 0.7, bgPadding: 10, bgRadius: 10, highlight: 'box', activeBg: '#facc15', activeColor: '#000000', animation: 'none', wordsPerPage: 5, maxCharsPerLine: 22 } },
  { id: 'aparecer', name: 'Aparecer', style: { font: 'Kanit', weight: 800, uppercase: true, size: 84, strokeWidth: 10, highlight: 'color', activeColor: '#facc15', showUpcoming: false, animation: 'pop', wordsPerPage: 4 } },
  { id: 'maquina', name: 'Máquina', style: { font: 'Space Grotesk', weight: 700, uppercase: false, size: 64, strokeWidth: 0, shadowBlur: 10, bgMode: 'block', bgColor: '#0f172a', bgOpacity: 0.8, highlight: 'none', showUpcoming: false, animation: 'typewriter', wordsPerPage: 7, maxCharsPerLine: 24 } },
  { id: 'cair', name: 'Cair', style: { font: 'Titan One', weight: 400, uppercase: true, size: 92, strokeWidth: 12, strokeColor: '#111827', highlight: 'color', activeColor: '#60a5fa', showUpcoming: false, animation: 'drop', wordsPerPage: 3 } },
  { id: 'esticar', name: 'Esticar', style: { font: 'Bebas Neue', weight: 400, uppercase: true, size: 130, letterSpacing: 2, strokeWidth: 0, shadowBlur: 14, highlight: 'color', activeColor: '#ef4444', animation: 'stretch', wordsPerPage: 2 } },
  { id: 'desfoque', name: 'Foco', style: { font: 'Raleway', weight: 900, uppercase: true, size: 80, strokeWidth: 0, shadowBlur: 20, highlight: 'color', activeColor: '#c4b5fd', animation: 'blur-in', wordsPerPage: 3 } },
  { id: 'girar', name: 'Virar', style: { font: 'Rubik', weight: 900, uppercase: true, size: 84, strokeWidth: 10, highlight: 'color', activeColor: '#34d399', animation: 'flip', wordsPerPage: 3 } },
  { id: 'terror', name: 'Terror', style: { font: 'Creepster', weight: 400, uppercase: true, size: 100, color: '#dc2626', strokeWidth: 6, strokeColor: '#000000', glowColor: '#7f1d1d', glowSize: 16, highlight: 'scale', activeScale: 1.2, animation: 'shake', wordsPerPage: 2, keywordColors: false } },
  { id: 'manuscrito', name: 'Manuscrito', style: { font: 'Caveat', weight: 700, uppercase: false, size: 96, strokeWidth: 0, shadowBlur: 10, highlight: 'color', activeColor: '#fde68a', animation: 'fade', wordsPerPage: 5, keywordColors: false } },
  { id: 'emoji', name: 'Emoji', tag: 'Novo', style: { font: 'Montserrat', weight: 900, uppercase: true, size: 84, strokeWidth: 10, highlight: 'color', activeColor: '#facc15', animation: 'pop', wordsPerPage: 3, emoji: true } },
  { id: 'noticia', name: 'Notícia', style: { font: 'Roboto', weight: 900, uppercase: true, size: 58, color: '#ffffff', strokeWidth: 0, shadowBlur: 0, bgMode: 'line', bgColor: '#dc2626', bgOpacity: 1, bgPadding: 14, bgRadius: 0, highlight: 'color', activeColor: '#fde047', animation: 'slide-up', wordsPerPage: 6, maxCharsPerLine: 24, y: 0.82 } },
  { id: 'retro', name: 'Retrô', style: { font: 'Monoton', weight: 400, uppercase: true, size: 80, color: '#fb923c', strokeWidth: 0, glowColor: '#f97316', glowSize: 18, shadowBlur: 0, highlight: 'color', activeColor: '#fef08a', animation: 'zoom', wordsPerPage: 2, keywordColors: false } },
];

export function applyPreset(base: CaptionStyle, id: string): CaptionStyle {
  const p = CAPTION_PRESETS.find((x) => x.id === id);
  // reset to defaults first so presets are predictable, keep user placement
  const d = defaultCaptionStyle();
  return { ...d, ...(p?.style ?? {}), preset: id, x: p?.style.x ?? base.x, y: p?.style.y ?? base.y };
}
