/**
 * Color filter presets ("looks"). Each look is a parametric grade applied in the layer shader and mixed by intensity.
 * Values are in normalized units (-1..1 unless noted).
 */
export interface Look {
  id: string;
  name: string;
  cat: string;
  exposure?: number;
  contrast?: number;
  saturation?: number;
  temperature?: number;
  tint?: number;
  fade?: number;
  hue?: number;
  vibrance?: number;
  shadows?: [number, number, number]; // additive tint in shadows
  highlights?: [number, number, number]; // additive tint in highlights
  mode?: 0 | 1 | 2 | 3; // 0 color, 1 b&w, 2 sepia, 3 bleach bypass
  swatch: string; // UI color
}

export const FILTER_CATEGORIES = [
  { id: 'pop', name: 'Destaque' },
  { id: 'cine', name: 'Cinema' },
  { id: 'film', name: 'Filme' },
  { id: 'portrait', name: 'Retrato' },
  { id: 'food', name: 'Comida' },
  { id: 'land', name: 'Paisagem' },
  { id: 'bw', name: 'P&B' },
  { id: 'mood', name: 'Clima' },
];

export const LOOKS: Look[] = [
  { id: 'vivid', name: 'Vívido', cat: 'pop', contrast: 0.15, saturation: 0.35, vibrance: 0.3, swatch: '#ff4d6d' },
  { id: 'punch', name: 'Punch', cat: 'pop', contrast: 0.3, saturation: 0.25, exposure: 0.05, swatch: '#ff8c42' },
  { id: 'fresh', name: 'Fresh', cat: 'pop', saturation: 0.2, temperature: -0.1, exposure: 0.08, swatch: '#5eead4' },
  { id: 'glow-up', name: 'Glow', cat: 'pop', exposure: 0.12, contrast: -0.05, fade: 0.1, saturation: 0.1, highlights: [0.05, 0.03, 0.0], swatch: '#fde68a' },
  { id: 'hdr', name: 'HDR', cat: 'pop', contrast: 0.35, saturation: 0.2, vibrance: 0.4, swatch: '#60a5fa' },
  { id: 'candy', name: 'Candy', cat: 'pop', saturation: 0.4, tint: 0.12, exposure: 0.05, swatch: '#f472b6' },
  { id: 'teal-orange', name: 'Teal & Orange', cat: 'cine', contrast: 0.2, saturation: 0.1, shadows: [-0.04, 0.03, 0.08], highlights: [0.08, 0.03, -0.05], swatch: '#14b8a6' },
  { id: 'blockbuster', name: 'Blockbuster', cat: 'cine', contrast: 0.3, saturation: -0.05, shadows: [-0.03, 0.02, 0.07], highlights: [0.07, 0.04, -0.02], swatch: '#0ea5e9' },
  { id: 'noir-cine', name: 'Thriller', cat: 'cine', contrast: 0.25, saturation: -0.4, shadows: [0.0, 0.03, 0.04], temperature: -0.1, swatch: '#334155' },
  { id: 'matrix', name: 'Código', cat: 'cine', saturation: -0.2, tint: -0.25, shadows: [-0.02, 0.05, 0.0], contrast: 0.15, swatch: '#22c55e' },
  { id: 'dune', name: 'Deserto', cat: 'cine', temperature: 0.3, saturation: -0.1, contrast: 0.15, highlights: [0.06, 0.03, -0.04], swatch: '#d97706' },
  { id: 'blade', name: 'Neon Noir', cat: 'cine', tint: 0.2, temperature: -0.15, contrast: 0.25, shadows: [0.04, -0.02, 0.08], swatch: '#a855f7' },
  { id: 'epic', name: 'Épico', cat: 'cine', contrast: 0.35, exposure: -0.05, saturation: 0.05, fade: 0.04, shadows: [-0.02, 0.0, 0.05], swatch: '#1e3a8a' },
  { id: 'kodak', name: 'Portra', cat: 'film', temperature: 0.12, saturation: -0.05, fade: 0.08, highlights: [0.05, 0.02, -0.02], swatch: '#fdba74' },
  { id: 'fuji', name: 'Velvia', cat: 'film', saturation: 0.3, contrast: 0.15, tint: -0.06, swatch: '#16a34a' },
  { id: 'cinestill', name: 'Tungstênio', cat: 'film', temperature: -0.2, contrast: 0.12, highlights: [0.06, -0.01, -0.02], swatch: '#3b82f6' },
  { id: 'vintage', name: 'Vintage', cat: 'film', fade: 0.2, saturation: -0.2, temperature: 0.15, shadows: [0.04, 0.02, 0.0], swatch: '#a16207' },
  { id: '70s', name: 'Anos 70', cat: 'film', fade: 0.15, temperature: 0.25, tint: 0.08, saturation: -0.1, swatch: '#ea580c' },
  { id: '90s', name: 'Anos 90', cat: 'film', contrast: 0.1, saturation: 0.1, tint: 0.05, fade: 0.06, highlights: [0.04, 0.02, 0.05], swatch: '#c084fc' },
  { id: 'faded', name: 'Desbotado', cat: 'film', fade: 0.3, contrast: -0.15, saturation: -0.15, swatch: '#94a3b8' },
  { id: 'bleach', name: 'Bleach', cat: 'film', mode: 3, contrast: 0.2, swatch: '#cbd5e1' },
  { id: 'soft-skin', name: 'Pele suave', cat: 'portrait', exposure: 0.08, contrast: -0.08, temperature: 0.08, saturation: -0.05, swatch: '#fecaca' },
  { id: 'warm-portrait', name: 'Quente', cat: 'portrait', temperature: 0.2, exposure: 0.04, tint: 0.04, swatch: '#fb923c' },
  { id: 'rosy', name: 'Rosado', cat: 'portrait', tint: 0.12, exposure: 0.06, fade: 0.05, swatch: '#fda4af' },
  { id: 'porcelain', name: 'Porcelana', cat: 'portrait', exposure: 0.15, saturation: -0.2, contrast: -0.1, temperature: -0.05, swatch: '#f1f5f9' },
  { id: 'bronze', name: 'Bronze', cat: 'portrait', temperature: 0.3, contrast: 0.12, saturation: 0.05, swatch: '#b45309' },
  { id: 'delicious', name: 'Delícia', cat: 'food', saturation: 0.3, temperature: 0.12, contrast: 0.1, swatch: '#f59e0b' },
  { id: 'crisp', name: 'Crocante', cat: 'food', contrast: 0.2, exposure: 0.06, vibrance: 0.3, swatch: '#eab308' },
  { id: 'cafe', name: 'Café', cat: 'food', temperature: 0.18, fade: 0.1, saturation: -0.1, swatch: '#78350f' },
  { id: 'lush', name: 'Verde vivo', cat: 'land', vibrance: 0.45, saturation: 0.1, tint: -0.08, swatch: '#15803d' },
  { id: 'sky', name: 'Céu', cat: 'land', temperature: -0.15, saturation: 0.2, contrast: 0.1, swatch: '#38bdf8' },
  { id: 'golden', name: 'Hora dourada', cat: 'land', temperature: 0.35, exposure: 0.05, highlights: [0.07, 0.04, 0.0], swatch: '#fbbf24' },
  { id: 'arctic', name: 'Ártico', cat: 'land', temperature: -0.35, exposure: 0.06, saturation: -0.1, swatch: '#bae6fd' },
  { id: 'autumn', name: 'Outono', cat: 'land', hue: -0.03, temperature: 0.25, saturation: 0.15, swatch: '#c2410c' },
  { id: 'bw', name: 'P&B', cat: 'bw', mode: 1, swatch: '#737373' },
  { id: 'bw-contrast', name: 'Contraste', cat: 'bw', mode: 1, contrast: 0.4, swatch: '#171717' },
  { id: 'bw-soft', name: 'Suave', cat: 'bw', mode: 1, fade: 0.2, contrast: -0.1, swatch: '#a3a3a3' },
  { id: 'sepia', name: 'Sépia', cat: 'bw', mode: 2, swatch: '#92400e' },
  { id: 'noir', name: 'Noir', cat: 'bw', mode: 1, contrast: 0.55, exposure: -0.08, swatch: '#0a0a0a' },
  { id: 'selenium', name: 'Selênio', cat: 'bw', mode: 1, shadows: [0.02, 0.0, 0.05], highlights: [0.04, 0.02, 0.0], swatch: '#57534e' },
  { id: 'moody', name: 'Moody', cat: 'mood', exposure: -0.1, saturation: -0.25, contrast: 0.15, fade: 0.08, shadows: [0.0, 0.02, 0.04], swatch: '#475569' },
  { id: 'dreamy', name: 'Sonhador', cat: 'mood', exposure: 0.1, fade: 0.18, tint: 0.08, saturation: -0.05, swatch: '#e9d5ff' },
  { id: 'cold', name: 'Frio', cat: 'mood', temperature: -0.3, saturation: -0.05, swatch: '#7dd3fc' },
  { id: 'sunset', name: 'Pôr do sol', cat: 'mood', temperature: 0.3, tint: 0.12, contrast: 0.1, swatch: '#f97316' },
  { id: 'horror', name: 'Terror', cat: 'mood', saturation: -0.5, tint: -0.15, contrast: 0.3, exposure: -0.12, swatch: '#14532d' },
  { id: 'vaporwave', name: 'Vaporwave', cat: 'mood', hue: 0.08, tint: 0.25, saturation: 0.2, shadows: [0.05, 0.0, 0.1], swatch: '#e879f9' },
  { id: 'lofi', name: 'Lo-fi', cat: 'mood', fade: 0.22, saturation: -0.2, temperature: 0.1, contrast: -0.05, swatch: '#d6d3d1' },
];

export const LOOK_MAP = new Map(LOOKS.map((l) => [l.id, l]));
