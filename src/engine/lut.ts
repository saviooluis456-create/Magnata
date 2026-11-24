/**
 * 3D LUT engine: built-in creative LUTs and camera LOG→Rec.709 conversions (baked procedurally to 33³),
 * plus .cube file import. LUTs are stored as an RGBA atlas: width = size*size (blue slices), height = size.
 */
import { db } from '../store/db';

export interface LutData { size: number; data: Uint8Array }
type V3 = [number, number, number];
type Fn = (c: V3) => V3;

export interface LutDef { id: string; name: string; cat: string; fn: Fn; swatch: string; note?: string }

// ------------------------------------------------------------------ primitives
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const luma = (c: V3) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const sat = (c: V3, s: number): V3 => { const l = luma(c); return [mix(l, c[0], s), mix(l, c[1], s), mix(l, c[2], s)]; };
const sCurve = (x: number, k: number) => { const y = x < 0.5 ? 0.5 * Math.pow(2 * x, 1 + k) : 1 - 0.5 * Math.pow(2 * (1 - x), 1 + k); return y; };
const curve = (c: V3, k: number): V3 => [sCurve(clamp01(c[0]), k), sCurve(clamp01(c[1]), k), sCurve(clamp01(c[2]), k)];
const lift = (c: V3, l: V3, g: V3 = [1, 1, 1]): V3 => [c[0] * g[0] + l[0] * (1 - c[0]), c[1] * g[1] + l[1] * (1 - c[1]), c[2] * g[2] + l[2] * (1 - c[2])];
const gamma = (c: V3, g: V3): V3 => [Math.pow(clamp01(c[0]), 1 / g[0]), Math.pow(clamp01(c[1]), 1 / g[1]), Math.pow(clamp01(c[2]), 1 / g[2])];
const split = (c: V3, sh: V3, hi: V3, amt = 1): V3 => {
  const l = luma(c), ws = Math.pow(1 - l, 2) * amt, wh = Math.pow(l, 2) * amt;
  return [c[0] + sh[0] * ws + hi[0] * wh, c[1] + sh[1] * ws + hi[1] * wh, c[2] + sh[2] * ws + hi[2] * wh];
};
const fade = (c: V3, f: number): V3 => [c[0] * (1 - f) + f * 0.5 * 0.6, c[1] * (1 - f) + f * 0.5 * 0.6, c[2] * (1 - f) + f * 0.5 * 0.6];
const mono = (c: V3, w: V3 = [0.2126, 0.7152, 0.0722]): V3 => { const l = c[0] * w[0] + c[1] * w[1] + c[2] * w[2]; return [l, l, l]; };
const mul = (c: V3, m: V3): V3 => [c[0] * m[0], c[1] * m[1], c[2] * m[2]];
const hueRot = (c: V3, deg: number): V3 => {
  const a = (deg * Math.PI) / 180, k = 0.57735, ca = Math.cos(a), sa = Math.sin(a);
  const d = k * (c[0] + c[1] + c[2]) * k * (1 - ca);
  return [c[0] * ca + (k * c[2] - k * c[1]) * sa + d, c[1] * ca + (k * c[0] - k * c[2]) * sa + d, c[2] * ca + (k * c[1] - k * c[0]) * sa + d];
};
/** pushes skin-ish hues toward orange and the rest toward teal */
const tealOrange = (c: V3, amt: number): V3 => {
  const l = luma(c);
  const warm = clamp01((c[0] - c[2]) * 2 + 0.5);
  const t: V3 = [mix(l * 0.85, l * 1.15, warm), l * mix(1.02, 0.98, warm), mix(l * 1.18, l * 0.82, warm)];
  return [mix(c[0], t[0], amt), mix(c[1], t[1], amt), mix(c[2], t[2], amt)];
};

// ------------------------------------------------------------------ camera log curves → linear
const slog3 = (x: number) => (x >= 171.2102946929 / 1023 ? Math.pow(10, (x * 1023 - 420) / 261.5) * (0.18 + 0.01) - 0.01 : ((x * 1023 - 95) * 0.01125) / (171.2102946929 - 95));
const vlog = (x: number) => (x < 0.181 ? (x - 0.125) / 5.6 : Math.pow(10, (x - 0.598206) / 0.241514) - 0.00873);
const clog3 = (x: number) => (x < 0.097465473 ? -(Math.pow(10, (0.12783901 - x) / 0.36726845) - 1) / 14.98325 : x <= 0.15277891 ? (x - 0.12512219) / 1.9754798 : (Math.pow(10, (x - 0.12240537) / 0.36726845) - 1) / 14.98325);
const appleLog = (x: number) => { const R0 = -0.05641088, Rt = 0.01, c = 47.28711236, b = 0.00964052, g = 0.08550479, be = 0.69336945; const Pt = c * Math.pow(Rt - R0, 2); return x >= Pt ? Math.pow(2, (x - be) / g) - b : x > 0 ? Math.sqrt(x / c) + R0 : R0; };
const flog = (x: number) => (x >= 0.100537775223865 ? (Math.pow(10, (x - 0.790453) / 0.344676) - 0.009468) / 0.555556 : (x - 0.092864) / 8.735631);
const nlog = (x: number) => (x < 452 / 1023 ? Math.pow(x * 1023 / 650, 3) - 0.0075 : Math.exp((x * 1023 - 619) / 150));
const dlog = (x: number) => (x <= 0.14 ? (x - 0.0929) / 6.025 : (Math.pow(10, 3.89616 * x - 2.27752) - 0.0108) / 0.9892);
const protune = (x: number) => (Math.pow(113, x) - 1) / 112;
const hlg = (x: number) => { const a = 0.17883277, b = 0.28466892, c = 0.55991073; return x <= 0.5 ? (x * x) / 3 : (Math.exp((x - c) / a) + b) / 12; };
const genericLog = (x: number) => (Math.pow(10, (x - 0.6) / 0.25) * 0.18);

/** Filmic display transform (ACES-like approximation) → gamma-encoded Rec.709 */
function display(lin: V3, exposure = 1, satBoost = 1.25): V3 {
  const tm = (x: number) => { x = Math.max(0, x * exposure); return clamp01((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)); };
  const c: V3 = [tm(lin[0]), tm(lin[1]), tm(lin[2])];
  return sat([Math.pow(c[0], 1 / 2.2), Math.pow(c[1], 1 / 2.2), Math.pow(c[2], 1 / 2.2)], satBoost);
}
const fromLog = (f: (x: number) => number, exposure = 1.6, s = 1.3): Fn => (c) => display([f(c[0]), f(c[1]), f(c[2])], exposure, s);

// ------------------------------------------------------------------ definitions
export const LUT_CATEGORIES = [
  { id: 'camera', name: 'Câmera / LOG' },
  { id: 'film', name: 'Película' },
  { id: 'cine', name: 'Cinema' },
  { id: 'creative', name: 'Criativo' },
  { id: 'bw', name: 'P&B' },
  { id: 'creator', name: 'Criadores' },
  { id: 'mood', name: 'Climas' },
  { id: 'custom', name: 'Meus LUTs' },
];

export const LUTS: LutDef[] = [
  // camera conversions (approximations of manufacturer transforms)
  { id: 'cam-slog3', name: 'Sony S-Log3 → 709', cat: 'camera', fn: fromLog(slog3), swatch: '#3b82f6', note: 'Sony A7S/FX3/FX30/ZV' },
  { id: 'cam-vlog', name: 'Panasonic V-Log → 709', cat: 'camera', fn: fromLog(vlog), swatch: '#14b8a6', note: 'Lumix GH/S' },
  { id: 'cam-clog3', name: 'Canon C-Log3 → 709', cat: 'camera', fn: fromLog(clog3), swatch: '#ef4444', note: 'Canon EOS R/C' },
  { id: 'cam-applelog', name: 'Apple Log → 709', cat: 'camera', fn: fromLog(appleLog, 1.4, 1.2), swatch: '#e5e7eb', note: 'iPhone 15 Pro+' },
  { id: 'cam-dlog', name: 'DJI D-Log → 709', cat: 'camera', fn: fromLog(dlog), swatch: '#64748b', note: 'Drones, Osmo, Action' },
  { id: 'cam-flog', name: 'Fujifilm F-Log → 709', cat: 'camera', fn: fromLog(flog), swatch: '#22c55e', note: 'X-T/X-H/X-S' },
  { id: 'cam-nlog', name: 'Nikon N-Log → 709', cat: 'camera', fn: fromLog(nlog, 1.3, 1.25), swatch: '#facc15', note: 'Nikon Z' },
  { id: 'cam-protune', name: 'GoPro Flat → 709', cat: 'camera', fn: fromLog(protune, 1.3, 1.2), swatch: '#0ea5e9', note: 'GoPro HERO' },
  { id: 'cam-hlg', name: 'HLG (HDR) → SDR', cat: 'camera', fn: (c) => display([hlg(c[0]), hlg(c[1]), hlg(c[2])], 2.2, 1.05), swatch: '#a855f7', note: 'Celulares em HDR' },
  { id: 'cam-log', name: 'LOG genérico → 709', cat: 'camera', fn: fromLog(genericLog, 1.5, 1.3), swatch: '#94a3b8', note: 'Samsung/Xiaomi/Outros' },
  { id: 'cam-phone-natural', name: 'Celular → Natural', cat: 'camera', fn: (c) => curve(sat(gamma(c, [1.03, 1.03, 1.03]), 0.9), 0.08), swatch: '#f1f5f9', note: 'Suaviza o processamento do celular' },
  { id: 'cam-phone-cine', name: 'Celular → Cinema', cat: 'camera', fn: (c) => tealOrange(curve(sat(fade(c, 0.04), 0.88), 0.2), 0.35), swatch: '#0f766e', note: 'Look de câmera de cinema' },
  // film emulations
  { id: 'film-2383', name: 'Kodak 2383', cat: 'film', fn: (c) => split(curve(sat(c, 0.95), 0.35), [-0.02, 0.01, 0.04], [0.05, 0.02, -0.04]), swatch: '#b45309' },
  { id: 'film-portra', name: 'Portra 400', cat: 'film', fn: (c) => split(lift(sat(c, 0.9), [0.03, 0.025, 0.02], [1.02, 1, 0.96]), [0.0, 0.01, 0.02], [0.04, 0.02, -0.02]), swatch: '#fdba74' },
  { id: 'film-ektar', name: 'Ektar 100', cat: 'film', fn: (c) => curve(sat(mul(c, [1.04, 1, 0.97]), 1.3), 0.2), swatch: '#dc2626' },
  { id: 'film-kodachrome', name: 'Kodachrome', cat: 'film', fn: (c) => curve(sat(split(c, [0.0, 0.02, 0.0], [0.05, 0.03, -0.03]), 1.2), 0.3), swatch: '#ca8a04' },
  { id: 'film-eterna', name: 'Fuji Eterna', cat: 'film', fn: (c) => split(lift(sat(c, 0.75), [0.04, 0.045, 0.045]), [0, 0.02, 0.02], [0.02, 0.02, 0]), swatch: '#5eead4' },
  { id: 'film-velvia', name: 'Fuji Velvia', cat: 'film', fn: (c) => curve(sat(mul(c, [0.98, 1.02, 1.0]), 1.45), 0.25), swatch: '#16a34a' },
  { id: 'film-800t', name: 'Cinestill 800T', cat: 'film', fn: (c) => split(curve(mul(c, [0.92, 0.98, 1.12]), 0.15), [0, 0.02, 0.05], [0.08, 0.0, -0.02]), swatch: '#1d4ed8' },
  { id: 'film-ekta', name: 'Ektachrome', cat: 'film', fn: (c) => curve(sat(mul(c, [0.97, 1.0, 1.05]), 1.15), 0.25), swatch: '#0284c7' },
  { id: 'film-superia', name: 'Superia', cat: 'film', fn: (c) => split(sat(c, 1.1), [0, 0.03, 0.01], [0.02, 0.03, -0.02]), swatch: '#65a30d' },
  { id: 'film-instant', name: 'Instantânea', cat: 'film', fn: (c) => fade(split(sat(c, 0.85), [0.02, 0.0, 0.05], [0.05, 0.04, -0.02]), 0.12), swatch: '#fde68a' },
  // cinema
  { id: 'cine-to', name: 'Teal & Orange', cat: 'cine', fn: (c) => curve(tealOrange(c, 0.75), 0.2), swatch: '#14b8a6' },
  { id: 'cine-blockbuster', name: 'Blockbuster', cat: 'cine', fn: (c) => curve(tealOrange(split(c, [-0.02, 0.02, 0.06], [0.06, 0.03, -0.03]), 0.5), 0.35), swatch: '#0369a1' },
  { id: 'cine-matrix', name: 'Código verde', cat: 'cine', fn: (c) => curve(mul(sat(c, 0.7), [0.9, 1.08, 0.88]), 0.25), swatch: '#15803d' },
  { id: 'cine-thriller', name: 'Thriller', cat: 'cine', fn: (c) => curve(split(sat(c, 0.55), [0, 0.03, 0.05], [0.02, 0.02, 0.0]), 0.4), swatch: '#334155' },
  { id: 'cine-desert', name: 'Deserto', cat: 'cine', fn: (c) => curve(mul(sat(c, 0.85), [1.1, 1.0, 0.8]), 0.25), swatch: '#d97706' },
  { id: 'cine-nightday', name: 'Noite americana', cat: 'cine', fn: (c) => mul(sat(gamma(c, [0.8, 0.85, 1.0]), 0.4), [0.6, 0.75, 1.05]), swatch: '#1e3a8a' },
  { id: 'cine-pastel', name: 'Pastel simétrico', cat: 'cine', fn: (c) => fade(split(sat(c, 0.9), [0.05, 0.02, 0.04], [0.04, 0.03, 0.0]), 0.15), swatch: '#f9a8d4' },
  { id: 'cine-bleach', name: 'Bleach bypass', cat: 'cine', fn: (c) => curve(sat(c, 0.35), 0.5), swatch: '#9ca3af' },
  { id: 'cine-noir-color', name: 'Neo-noir', cat: 'cine', fn: (c) => curve(split(sat(c, 0.6), [0.04, -0.01, 0.07], [0.05, 0.0, 0.03]), 0.45), swatch: '#6d28d9' },
  { id: 'cine-epic', name: 'Épico', cat: 'cine', fn: (c) => curve(split(mul(c, [1.0, 0.98, 0.95]), [-0.01, 0.0, 0.05], [0.05, 0.03, -0.02]), 0.4), swatch: '#78350f' },
  { id: 'cine-golden', name: 'Hora dourada', cat: 'cine', fn: (c) => split(curve(mul(c, [1.08, 1.0, 0.85]), 0.15), [0.02, 0.0, -0.02], [0.08, 0.04, -0.03]), swatch: '#fbbf24' },
  { id: 'cine-moonlight', name: 'Luar', cat: 'cine', fn: (c) => split(sat(c, 0.6), [0.0, 0.02, 0.08], [0.0, 0.02, 0.05]), swatch: '#60a5fa' },
  // creative
  { id: 'cr-cyberpunk', name: 'Cyberpunk', cat: 'creative', fn: (c) => curve(split(hueRot(c, -10), [0.06, -0.02, 0.12], [0.1, 0.0, 0.08]), 0.3), swatch: '#c026d3' },
  { id: 'cr-vaporwave', name: 'Vaporwave', cat: 'creative', fn: (c) => split(hueRot(sat(c, 1.2), 15), [0.08, 0.0, 0.12], [0.06, 0.04, 0.08]), swatch: '#e879f9' },
  { id: 'cr-cross', name: 'Processo cruzado', cat: 'creative', fn: (c) => curve(mul(c, [1.05, 1.08, 0.85]), 0.45), swatch: '#a3e635' },
  { id: 'cr-infrared', name: 'Infravermelho', cat: 'creative', fn: (c) => sat([c[1] * 1.1, c[0] * 0.9, c[2] * 0.9], 1.1), swatch: '#fb7185' },
  { id: 'cr-lomo', name: 'Lomo', cat: 'creative', fn: (c) => curve(sat(mul(c, [1.05, 1.02, 0.9]), 1.3), 0.55), swatch: '#f97316' },
  { id: 'cr-summer', name: 'Verão', cat: 'creative', fn: (c) => lift(sat(mul(c, [1.06, 1.02, 0.92]), 1.15), [0.02, 0.02, 0.0]), swatch: '#facc15' },
  { id: 'cr-winter', name: 'Inverno', cat: 'creative', fn: (c) => lift(sat(mul(c, [0.92, 0.98, 1.08]), 0.8), [0.02, 0.03, 0.05]), swatch: '#bae6fd' },
  { id: 'cr-forest', name: 'Floresta sombria', cat: 'creative', fn: (c) => curve(split(sat(c, 0.75), [0.0, 0.03, 0.01], [0.02, 0.03, 0.0]), 0.3), swatch: '#166534' },
  { id: 'cr-matte', name: 'Fosco', cat: 'creative', fn: (c) => fade(sat(c, 0.9), 0.18), swatch: '#d6d3d1' },
  { id: 'cr-highkey', name: 'High key', cat: 'creative', fn: (c) => gamma(lift(c, [0.06, 0.06, 0.06]), [1.25, 1.25, 1.25]), swatch: '#ffffff' },
  { id: 'cr-lowkey', name: 'Low key', cat: 'creative', fn: (c) => curve(gamma(c, [0.8, 0.8, 0.8]), 0.4), swatch: '#0a0a0a' },
  { id: 'cr-sunset', name: 'Pôr do sol', cat: 'creative', fn: (c) => split(mul(c, [1.1, 0.95, 0.85]), [0.04, -0.01, 0.06], [0.08, 0.02, -0.04]), swatch: '#ea580c' },
  // black & white
  { id: 'bw-neutral', name: 'P&B neutro', cat: 'bw', fn: (c) => mono(c), swatch: '#737373' },
  { id: 'bw-contrast', name: 'P&B contraste', cat: 'bw', fn: (c) => curve(mono(c), 0.6), swatch: '#171717' },
  { id: 'bw-red', name: 'Filtro vermelho', cat: 'bw', fn: (c) => curve(mono(c, [0.8, 0.2, 0.0]), 0.3), swatch: '#7f1d1d' },
  { id: 'bw-green', name: 'Filtro verde', cat: 'bw', fn: (c) => mono(c, [0.1, 0.8, 0.1]), swatch: '#14532d' },
  { id: 'bw-sepia', name: 'Sépia', cat: 'bw', fn: (c) => { const l = luma(c); return [l * 1.08 + 0.04, l * 0.92 + 0.02, l * 0.72]; }, swatch: '#92400e' },
  { id: 'bw-selenium', name: 'Selênio', cat: 'bw', fn: (c) => split(mono(c), [0.03, 0.0, 0.06], [0.04, 0.03, 0.0]), swatch: '#57534e' },
  { id: 'bw-cyanotype', name: 'Cianotipia', cat: 'bw', fn: (c) => { const l = luma(c); return [l * 0.55, l * 0.8, l * 1.1 + 0.05]; }, swatch: '#1e40af' },
  // ---- more film stocks
  { id: 'film-vision250', name: 'Vision3 250D', cat: 'film', fn: (c) => split(curve(sat(lift(c, [0.015, 0.015, 0.02]), 0.92), 0.22), [-0.01, 0.01, 0.03], [0.04, 0.02, -0.02]), swatch: '#a3a380' },
  { id: 'film-vision500', name: 'Vision3 500T', cat: 'film', fn: (c) => split(curve(sat(mul(c, [0.96, 0.99, 1.06]), 0.9), 0.25), [0.0, 0.02, 0.06], [0.06, 0.02, -0.03]), swatch: '#3f6d8e' },
  { id: 'film-gold', name: 'Gold 200', cat: 'film', fn: (c) => split(curve(sat(mul(c, [1.07, 1.02, 0.88]), 1.1), 0.15), [0.03, 0.02, 0.0], [0.06, 0.04, -0.03]), swatch: '#eab308' },
  { id: 'film-ultramax', name: 'Ultramax 400', cat: 'film', fn: (c) => curve(sat(split(c, [0.0, 0.02, 0.02], [0.05, 0.03, -0.02]), 1.18), 0.22), swatch: '#f59e0b' },
  { id: 'film-400h', name: 'Pro 400H', cat: 'film', fn: (c) => fade(split(sat(mul(c, [0.97, 1.02, 1.01]), 0.85), [0.0, 0.03, 0.03], [0.02, 0.03, 0.01]), 0.08), swatch: '#86efac' },
  { id: 'film-vista', name: 'Vista 200', cat: 'film', fn: (c) => curve(sat(mul(c, [1.05, 0.98, 0.95]), 1.25), 0.3), swatch: '#dc2626' },
  { id: 'film-lomo-purple', name: 'Lomo roxo', cat: 'film', fn: (c) => sat([c[0] * 1.05, c[2] * 0.9 + c[1] * 0.1, c[1] * 0.85 + c[2] * 0.2], 1.1), swatch: '#a855f7' },
  { id: 'film-expired', name: 'Filme vencido', cat: 'film', fn: (c) => fade(split(sat(hueRot(c, 8), 0.75), [0.05, 0.0, 0.07], [0.06, 0.05, -0.04]), 0.18), swatch: '#c084fc' },
  { id: 'bw-hp5', name: 'HP5 P&B', cat: 'bw', fn: (c) => curve(lift(mono(c, [0.25, 0.65, 0.1]), [0.03, 0.03, 0.03]), 0.35), swatch: '#404040' },
  { id: 'bw-trix', name: 'Tri-X P&B', cat: 'bw', fn: (c) => curve(mono(c, [0.3, 0.6, 0.1]), 0.55), swatch: '#262626' },
  { id: 'bw-highkey', name: 'P&B clarinho', cat: 'bw', fn: (c) => gamma(mono(c), [1.35, 1.35, 1.35]), swatch: '#e5e5e5' },
  // ---- cinema looks (generic names)
  { id: 'cine-dystopia', name: 'Laranja distópico', cat: 'cine', fn: (c) => curve(tealOrange(mul(sat(c, 1.15), [1.08, 0.98, 0.85]), 0.9), 0.4), swatch: '#ea580c' },
  { id: 'cine-sickly', name: 'Verde doentio', cat: 'cine', fn: (c) => curve(split(sat(mul(c, [0.95, 1.05, 0.95]), 0.8), [-0.01, 0.04, 0.03], [0.02, 0.05, -0.02]), 0.3), swatch: '#65a30d' },
  { id: 'cine-fable', name: 'Fábula francesa', cat: 'cine', fn: (c) => curve(split(sat(c, 1.2), [0.02, 0.04, 0.0], [0.07, 0.04, -0.03]), 0.25), swatch: '#16a34a' },
  { id: 'cine-neon-pink', name: 'Noite neon', cat: 'cine', fn: (c) => curve(split(sat(c, 1.1), [0.08, -0.02, 0.1], [0.08, 0.02, 0.05]), 0.3), swatch: '#ec4899' },
  { id: 'cine-orange-haze', name: 'Névoa laranja', cat: 'cine', fn: (c) => fade(curve(mul(sat(c, 0.7), [1.15, 0.92, 0.7]), 0.2), 0.12), swatch: '#f97316' },
  { id: 'cine-80s', name: 'Anos 80', cat: 'cine', fn: (c) => curve(split(sat(fade(c, 0.06), 1.1), [0.03, 0.0, 0.08], [0.07, 0.03, -0.02]), 0.2), swatch: '#be185d' },
  { id: 'cine-desert-yellow', name: 'Amarelo deserto', cat: 'cine', fn: (c) => curve(mul(sat(c, 0.9), [1.08, 1.03, 0.75]), 0.25), swatch: '#ca8a04' },
  { id: 'cine-redkeep', name: 'Noir com vermelho', cat: 'cine', fn: (c) => { const l = luma(c); const red = Math.max(0, Math.min(1, (c[0] - Math.max(c[1], c[2])) * 4)); return curve([l + (c[0] - l) * red, l + (c[1] - l) * red, l + (c[2] - l) * red], 0.5); }, swatch: '#7f1d1d' },
  { id: 'cine-ice', name: 'Gelo', cat: 'cine', fn: (c) => curve(mul(sat(c, 0.6), [0.85, 0.98, 1.15]), 0.3), swatch: '#93c5fd' },
  // ---- creator looks
  { id: 'cr-clean', name: 'Clean creator', cat: 'creator', fn: (c) => curve(sat(lift(c, [0.01, 0.01, 0.012], [1.03, 1.03, 1.02]), 1.08), 0.12), swatch: '#f8fafc' },
  { id: 'cr-soft-pastel', name: 'Pastel suave', cat: 'creator', fn: (c) => fade(sat(gamma(c, [1.08, 1.06, 1.08]), 0.8), 0.15), swatch: '#fbcfe8' },
  { id: 'cr-moody-brown', name: 'Marrom moody', cat: 'creator', fn: (c) => curve(split(sat(mul(c, [1.04, 0.98, 0.88]), 0.7), [0.02, 0.01, 0.0], [0.05, 0.03, 0.0]), 0.3), swatch: '#78350f' },
  { id: 'cr-urban', name: 'Urbano gritty', cat: 'creator', fn: (c) => curve(sat(split(c, [0.0, 0.02, 0.04], [0.03, 0.02, 0.0]), 0.65), 0.55), swatch: '#57534e' },
  { id: 'cr-insta-warm', name: 'Insta quente', cat: 'creator', fn: (c) => lift(sat(mul(c, [1.06, 1.02, 0.93]), 1.12), [0.03, 0.02, 0.0]), swatch: '#fdba74' },
  { id: 'cr-airy', name: 'Leve e claro', cat: 'creator', fn: (c) => gamma(lift(sat(c, 0.9), [0.04, 0.04, 0.05]), [1.18, 1.18, 1.15]), swatch: '#e0f2fe' },
  { id: 'cr-dark-academia', name: 'Dark academia', cat: 'creator', fn: (c) => curve(split(sat(mul(c, [1.02, 0.97, 0.85]), 0.65), [0.02, 0.015, 0.0], [0.04, 0.025, -0.02]), 0.35), swatch: '#44403c' },
  { id: 'cr-cottage', name: 'Campo', cat: 'creator', fn: (c) => fade(split(sat(mul(c, [1.03, 1.03, 0.9]), 0.95), [0.02, 0.03, 0.0], [0.05, 0.04, -0.02]), 0.1), swatch: '#a3e635' },
  { id: 'cr-y2k', name: 'Y2K', cat: 'creator', fn: (c) => curve(split(sat(c, 1.3), [0.03, 0.0, 0.08], [0.0, 0.05, 0.08]), 0.25), swatch: '#38bdf8' },
  { id: 'cr-kdrama', name: 'Drama coreano', cat: 'creator', fn: (c) => gamma(fade(split(sat(c, 0.92), [0.0, 0.02, 0.03], [0.04, 0.03, 0.03]), 0.06), [1.1, 1.1, 1.1]), swatch: '#fce7f3' },
  { id: 'cr-vivid-fest', name: 'Festival vibrante', cat: 'creator', fn: (c) => curve(sat(c, 1.45), 0.3), swatch: '#f43f5e' },
  { id: 'cr-food', name: 'Comida apetitosa', cat: 'creator', fn: (c) => curve(sat(mul(c, [1.06, 1.02, 0.92]), 1.25), 0.2), swatch: '#f59e0b' },
  { id: 'cr-product', name: 'Produto premium', cat: 'creator', fn: (c) => curve(sat(lift(c, [0.0, 0.0, 0.01]), 0.95), 0.3), swatch: '#0f172a' },
  // ---- moods / time of day
  { id: 'mood-blue-hour', name: 'Hora azul', cat: 'mood', fn: (c) => split(curve(mul(c, [0.88, 0.95, 1.12]), 0.2), [0.0, 0.02, 0.08], [0.04, 0.02, 0.03]), swatch: '#1d4ed8' },
  { id: 'mood-night-city', name: 'Cidade à noite', cat: 'mood', fn: (c) => curve(split(sat(c, 1.15), [0.0, 0.03, 0.08], [0.08, 0.04, -0.02]), 0.35), swatch: '#0c4a6e' },
  { id: 'mood-tropical', name: 'Tropical', cat: 'mood', fn: (c) => curve(sat(hueRot(mul(c, [1.02, 1.04, 0.96]), -4), 1.3), 0.18), swatch: '#10b981' },
  { id: 'mood-spring', name: 'Primavera', cat: 'mood', fn: (c) => gamma(sat(split(c, [0.02, 0.03, 0.02], [0.04, 0.04, 0.0]), 1.1), [1.08, 1.08, 1.06]), swatch: '#bef264' },
  { id: 'mood-rainy', name: 'Dia chuvoso', cat: 'mood', fn: (c) => fade(mul(sat(c, 0.6), [0.94, 0.98, 1.05]), 0.12), swatch: '#64748b' },
  { id: 'mood-fire', name: 'Fogueira', cat: 'mood', fn: (c) => curve(mul(sat(c, 1.1), [1.15, 0.95, 0.75]), 0.3), swatch: '#b91c1c' },
  { id: 'mood-mystery', name: 'Mistério', cat: 'mood', fn: (c) => curve(split(sat(gamma(c, [0.88, 0.88, 0.9]), 0.55), [0.0, 0.02, 0.05], [0.0, 0.03, 0.04]), 0.35), swatch: '#1e293b' },
  { id: 'mood-dreamy-pink', name: 'Sonho rosa', cat: 'mood', fn: (c) => fade(split(sat(c, 0.95), [0.06, 0.0, 0.05], [0.06, 0.03, 0.04]), 0.12), swatch: '#f9a8d4' },
];

export const LUT_MAP = new Map(LUTS.map((l) => [l.id, l]));

// ------------------------------------------------------------------ baking & caching
const SIZE = 33;
const cache = new Map<string, LutData>();
const customMeta = new Map<string, string>(); // id -> name

export function bake(fn: Fn, size = SIZE): LutData {
  const data = new Uint8Array(size * size * size * 4);
  for (let g = 0; g < size; g++) for (let b = 0; b < size; b++) for (let r = 0; r < size; r++) {
    const o = ((g * size * size) + b * size + r) * 4;
    const c = fn([r / (size - 1), g / (size - 1), b / (size - 1)]);
    data[o] = Math.round(clamp01(c[0]) * 255);
    data[o + 1] = Math.round(clamp01(c[1]) * 255);
    data[o + 2] = Math.round(clamp01(c[2]) * 255);
    data[o + 3] = 255;
  }
  return { size, data };
}

/** Returns baked LUT data synchronously if available (built-ins always are; custom after load). */
export function getLut(id: string): LutData | null {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = LUT_MAP.get(id);
  if (def) { const d = bake(def.fn); cache.set(id, d); return d; }
  if (id.startsWith('cube:')) { void loadCustom(id); }
  return null;
}

const loading = new Map<string, Promise<LutData | null>>();
const listeners = new Set<() => void>();
export const onLutLoaded = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };

export function loadCustom(id: string): Promise<LutData | null> {
  let p = loading.get(id);
  if (p) return p;
  p = (async () => {
    const blob = await db.getMedia(id).catch(() => undefined);
    if (!blob) return null;
    const d = parseCube(await blob.text());
    cache.set(id, d);
    listeners.forEach((l) => l());
    return d;
  })();
  loading.set(id, p);
  return p;
}

/** Parse an Adobe/Resolve .cube 3D LUT (re-sampled to an atlas). */
export function parseCube(text: string): LutData {
  let size = 0;
  const vals: number[] = [];
  let dmin: V3 = [0, 0, 0], dmax: V3 = [1, 1, 1];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const up = line.toUpperCase();
    if (up.startsWith('LUT_3D_SIZE')) { size = parseInt(line.split(/\s+/)[1], 10); continue; }
    if (up.startsWith('LUT_1D_SIZE')) throw new Error('LUT 1D não suportado (use LUT 3D .cube)');
    if (up.startsWith('DOMAIN_MIN')) { dmin = line.split(/\s+/).slice(1, 4).map(Number) as V3; continue; }
    if (up.startsWith('DOMAIN_MAX')) { dmax = line.split(/\s+/).slice(1, 4).map(Number) as V3; continue; }
    if (/^[A-Z_]/.test(up)) continue;
    const p = line.split(/\s+/).map(Number);
    if (p.length >= 3 && p.every((x) => !isNaN(x))) vals.push(p[0], p[1], p[2]);
  }
  if (!size || size < 2 || size > 128) throw new Error('Arquivo .cube inválido (LUT_3D_SIZE ausente)');
  if (vals.length < size * size * size * 3) throw new Error('Arquivo .cube incompleto');
  const norm = (v: number, i: number) => (v - dmin[i]) / Math.max(1e-6, dmax[i] - dmin[i]);
  // .cube order: r fastest, then g, then b
  const at = (r: number, g: number, b: number): V3 => {
    const o = (b * size * size + g * size + r) * 3;
    return [vals[o], vals[o + 1], vals[o + 2]];
  };
  const sample = (c: V3): V3 => {
    const f = c.map((v, i) => clamp01(norm(v, i)) * (size - 1));
    const i0 = f.map((v) => Math.floor(v)), i1 = i0.map((v) => Math.min(size - 1, v + 1)), t = f.map((v, i) => v - i0[i]);
    const out: V3 = [0, 0, 0];
    for (let k = 0; k < 8; k++) {
      const ri = k & 1 ? i1[0] : i0[0], gi = k & 2 ? i1[1] : i0[1], bi = k & 4 ? i1[2] : i0[2];
      const w = (k & 1 ? t[0] : 1 - t[0]) * (k & 2 ? t[1] : 1 - t[1]) * (k & 4 ? t[2] : 1 - t[2]);
      const v = at(ri, gi, bi);
      out[0] += v[0] * w; out[1] += v[1] * w; out[2] += v[2] * w;
    }
    return out;
  };
  return bake((c) => sample([dmin[0] + c[0] * (dmax[0] - dmin[0]), dmin[1] + c[1] * (dmax[1] - dmin[1]), dmin[2] + c[2] * (dmax[2] - dmin[2])]), Math.min(SIZE, size) < 17 ? 17 : SIZE);
}

export async function importCubeFile(file: File): Promise<{ id: string; name: string }> {
  const text = await file.text();
  const d = parseCube(text); // validate
  const id = 'cube:' + Math.random().toString(36).slice(2, 10);
  await db.putMedia(id, new Blob([text], { type: 'text/plain' }));
  cache.set(id, d);
  const name = file.name.replace(/\.cube$/i, '');
  customMeta.set(id, name);
  return { id, name };
}

/** Apply a LUT to a small thumbnail (for UI previews) */
const thumbCache = new Map<string, string>();
export function lutThumb(id: string, src: string | undefined): Promise<string | null> {
  if (!src) return Promise.resolve(null);
  const key = id + '|' + src.slice(-40);
  const hit = thumbCache.get(key);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const lut = getLut(id);
      if (!lut) return resolve(null);
      const c = document.createElement('canvas');
      c.width = 72; c.height = Math.max(1, Math.round((img.height / img.width) * 72));
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const im = ctx.getImageData(0, 0, c.width, c.height);
      const n = lut.size, d = im.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = Math.round((d[i] / 255) * (n - 1)), g = Math.round((d[i + 1] / 255) * (n - 1)), b = Math.round((d[i + 2] / 255) * (n - 1));
        const o = (g * n * n + b * n + r) * 4;
        d[i] = lut.data[o]; d[i + 1] = lut.data[o + 1]; d[i + 2] = lut.data[o + 2];
      }
      ctx.putImageData(im, 0, 0);
      const url = c.toDataURL('image/jpeg', 0.7);
      thumbCache.set(key, url);
      resolve(url);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
