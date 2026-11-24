/**
 * "Copy the look": analyzes a reference image (tones, contrast, shadow/highlight tints, saturation, palette)
 * and builds a 3D LUT that transfers that look onto a clip.
 *
 * Method: CIE Lab statistics. Luminance is matched through histogram (CDF) matching, softened to avoid banding;
 * chroma (a/b) is shifted per tonal zone (shadows / midtones / highlights → split-toning) and scaled to the
 * reference colourfulness.
 */
import { ensureUrl, loadImage } from '../engine/media';
import type { MediaAsset } from '../model/types';

type V3 = [number, number, number];

// ------------------------------------------------------------------ colour space (sRGB D65 <-> Lab)
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGam = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055);
const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const fi = (t: number) => (t > 0.206893 ? t * t * t : (t - 16 / 116) / 7.787);

export function rgb2lab([r, g, b]: V3): V3 {
  const R = toLin(r), G = toLin(g), B = toLin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function lab2rgb([L, a, bb]: V3): V3 {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - bb / 200;
  const x = fi(fx) * 0.95047, y = fi(fy), z = fi(fz) * 1.08883;
  const R = x * 3.2406 + y * -1.5372 + z * -0.4986;
  const G = x * -0.9689 + y * 1.8758 + z * 0.0415;
  const B = x * 0.0557 + y * -0.204 + z * 1.057;
  const c = (v: number) => Math.max(0, Math.min(1, toGam(v)));
  return [c(R), c(G), c(B)];
}

// ------------------------------------------------------------------ statistics
export interface LookStats {
  cdf: Float32Array; // 101 bins of L (0..100)
  zoneA: V3; zoneB: V3; // mean a/b in shadows, mids, highlights
  chroma: number; // mean chroma
  meanL: number; stdL: number;
  palette: string[];
  warmth: number; // b mean (+ warm / − cool)
}

function statsFromPixels(px: Uint8ClampedArray): LookStats {
  const hist = new Float32Array(101);
  const zs = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; // sum a, sum b, weight
  let chroma = 0, n = 0, sL = 0, sL2 = 0, sb = 0;
  const samples: V3[] = [];
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const lab = rgb2lab([px[i] / 255, px[i + 1] / 255, px[i + 2] / 255]);
    const L = Math.max(0, Math.min(100, lab[0]));
    hist[Math.round(L)]++;
    const w = [Math.max(0, 1 - L / 40), Math.max(0, 1 - Math.abs(L - 50) / 30), Math.max(0, (L - 60) / 40)];
    for (let z = 0; z < 3; z++) { zs[z][0] += lab[1] * w[z]; zs[z][1] += lab[2] * w[z]; zs[z][2] += w[z]; }
    chroma += Math.hypot(lab[1], lab[2]); sL += L; sL2 += L * L; sb += lab[2]; n++;
    if ((i / 4) % 7 === 0) samples.push([px[i], px[i + 1], px[i + 2]]);
  }
  n = Math.max(1, n);
  const cdf = new Float32Array(101);
  let acc = 0;
  for (let i = 0; i <= 100; i++) { acc += hist[i]; cdf[i] = acc / n; }
  const meanL = sL / n;
  return {
    cdf,
    zoneA: zs.map((z) => (z[2] ? z[0] / z[2] : 0)) as V3,
    zoneB: zs.map((z) => (z[2] ? z[1] / z[2] : 0)) as V3,
    chroma: chroma / n, meanL, stdL: Math.sqrt(Math.max(0, sL2 / n - meanL * meanL)), warmth: sb / n,
    palette: kmeansPalette(samples, 5),
  };
}

function kmeansPalette(px: V3[], k: number): string[] {
  if (!px.length) return [];
  let cents: V3[] = Array.from({ length: k }, (_, i) => px[Math.floor((i + 0.5) * px.length / k)]);
  for (let it = 0; it < 8; it++) {
    const sums = cents.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let bi = 0, bd = 1e9;
      cents.forEach((c, i) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; bi = i; } });
      const s = sums[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    }
    cents = sums.map((s, i) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : cents[i]) as V3);
  }
  const lum = (c: V3) => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
  return cents.sort((a, b) => lum(a) - lum(b)).map((c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''));
}

async function pixelsOf(src: CanvasImageSource, w: number, h: number): Promise<Uint8ClampedArray> {
  const c = document.createElement('canvas');
  const s = Math.min(1, 160 / Math.max(w, h));
  c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return ctx.getImageData(0, 0, c.width, c.height).data;
}

export async function statsFromFile(file: Blob): Promise<{ stats: LookStats; preview: string }> {
  const bmp = await createImageBitmap(file);
  const px = await pixelsOf(bmp, bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.height = 160; c.width = Math.round((bmp.width / bmp.height) * 160);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return { stats: statsFromPixels(px), preview: c.toDataURL('image/jpeg', 0.8) };
}

export async function statsFromDataUrl(url: string): Promise<LookStats> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return statsFromPixels(await pixelsOf(img, img.naturalWidth, img.naturalHeight));
}

/** Pixels of a clip's media: several frames for video, the image itself for photos */
export async function statsFromMedia(m: MediaAsset, from = 0, to = m.duration): Promise<LookStats> {
  if (m.kind === 'image') {
    const img = await loadImage(m.id);
    const w = (img as ImageBitmap).width || (img as HTMLImageElement).naturalWidth, h = (img as ImageBitmap).height || (img as HTMLImageElement).naturalHeight;
    return statsFromPixels(await pixelsOf(img as CanvasImageSource, w, h));
  }
  const url = await ensureUrl(m.id);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.src = url ?? '';
  await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('vídeo ilegível')); });
  const frames: Uint8ClampedArray[] = [];
  for (let i = 0; i < 5; i++) {
    await new Promise<void>((res) => { const to2 = setTimeout(res, 2000); v.onseeked = () => { clearTimeout(to2); res(); }; v.currentTime = from + ((to - from) * (i + 0.5)) / 5; });
    frames.push(await pixelsOf(v, v.videoWidth, v.videoHeight));
  }
  v.removeAttribute('src'); v.load();
  const all = new Uint8ClampedArray(frames.reduce((a, f2) => a + f2.length, 0));
  let o = 0; for (const f2 of frames) { all.set(f2, o); o += f2.length; }
  return statsFromPixels(all);
}

// ------------------------------------------------------------------ transfer → LUT function
export function matchFunction(ref: LookStats, tgt: LookStats): (c: V3) => V3 {
  // luminance curve: CDF matching (tgt → ref), softened and kept monotonic
  const map = new Float32Array(101);
  let j = 0;
  for (let i = 0; i <= 100; i++) {
    const q = tgt.cdf[i];
    while (j < 100 && ref.cdf[j] < q) j++;
    map[i] = j;
  }
  // smooth + blend with identity to avoid harsh posterization
  const sm = new Float32Array(101);
  for (let i = 0; i <= 100; i++) {
    let s = 0, w = 0;
    for (let k = -4; k <= 4; k++) { const ii = Math.max(0, Math.min(100, i + k)); const ww = 5 - Math.abs(k); s += map[ii] * ww; w += ww; }
    sm[i] = (s / w) * 0.85 + i * 0.15;
  }
  for (let i = 1; i <= 100; i++) if (sm[i] < sm[i - 1]) sm[i] = sm[i - 1];
  // colourfulness ratio, softened (power 0.8) so extreme sources aren't over-corrected
  const k = Math.max(0.4, Math.min(2.2, Math.pow((ref.chroma + 1) / (tgt.chroma + 1), 0.8)));
  return (c) => {
    const [L, a, b] = rgb2lab(c);
    const Lc = Math.max(0, Math.min(100, L));
    const i0 = Math.floor(Lc), t = Lc - i0;
    const L2 = sm[i0] + (sm[Math.min(100, i0 + 1)] - sm[i0]) * t;
    const w = [Math.max(0, 1 - L2 / 40), Math.max(0, 1 - Math.abs(L2 - 50) / 30), Math.max(0, (L2 - 60) / 40)];
    const ws = w[0] + w[1] + w[2] || 1;
    let da = 0, db = 0, ta = 0, tb = 0;
    for (let z = 0; z < 3; z++) { da += (ref.zoneA[z]) * w[z]; db += (ref.zoneB[z]) * w[z]; ta += tgt.zoneA[z] * w[z]; tb += tgt.zoneB[z] * w[z]; }
    da /= ws; db /= ws; ta /= ws; tb /= ws;
    const a2 = (a - ta) * k + da;
    const b2 = (b - tb) * k + db;
    return lab2rgb([L2, a2, b2]);
  };
}

export function describe(s: LookStats): string[] {
  const out: string[] = [];
  out.push(s.meanL > 62 ? 'Imagem clara (high key)' : s.meanL < 35 ? 'Imagem escura (low key)' : 'Exposição média');
  out.push(s.stdL > 26 ? 'Contraste forte' : s.stdL < 15 ? 'Contraste suave / desbotado' : 'Contraste moderado');
  out.push(s.chroma > 32 ? 'Cores vibrantes' : s.chroma < 12 ? 'Cores dessaturadas' : 'Saturação natural');
  out.push(s.warmth > 8 ? 'Tom quente' : s.warmth < -4 ? 'Tom frio' : 'Tom neutro');
  const sh = Math.hypot(s.zoneA[0], s.zoneB[0]), hi = Math.hypot(s.zoneA[2], s.zoneB[2]);
  if (sh > 6 || hi > 6) out.push(`Split-toning: sombras ${s.zoneB[0] < -2 ? 'azuladas' : s.zoneA[0] > 3 ? 'magenta' : s.zoneB[0] > 3 ? 'quentes' : 'esverdeadas'}, realces ${s.zoneB[2] > 3 ? 'quentes' : s.zoneB[2] < -2 ? 'frios' : 'neutros'}`);
  return out;
}
