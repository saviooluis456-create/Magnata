/**
 * Camera identification: reads container metadata (make/model tags, raw atoms) and color-space info,
 * then analyzes sample frames to detect flat LOG / HDR footage. Suggests a conversion LUT + correction.
 */
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import { ensureBlob, ensureUrl } from '../engine/media';
import type { Adjust, CameraInfo } from '../model/types';

interface Brand { make: string; re: RegExp; log: string | null; logRe?: RegExp; models?: RegExp }

const BRANDS: Brand[] = [
  { make: 'Apple', re: /Apple|iPhone|iPad/, log: 'cam-applelog', logRe: /Apple ?Log/i, models: /iPhone ?\d+( Pro( Max)?| Plus| mini)?/ },
  { make: 'Sony', re: /SONY|ILCE-|ILME-|ZV-E?\d|DSC-RX|FX30|FX3|XPERIA/i, log: 'cam-slog3', logRe: /S-?Log ?3|Cine/i, models: /ILCE-[\w]+|ILME-[\w]+|ZV-E?\d+\w*|FX30|FX3|DSC-RX\w+/ },
  { make: 'Canon', re: /Canon|EOS/, log: 'cam-clog3', logRe: /C-?Log/i, models: /EOS[ \w-]+?(?=\s|\0|$)|Canon [\w ]+/ },
  { make: 'Panasonic', re: /Panasonic|LUMIX|DC-G[HX]\d|DC-S\d/i, log: 'cam-vlog', logRe: /V-?Log/i, models: /DC-[\w]+|LUMIX [\w]+/ },
  { make: 'Fujifilm', re: /FUJIFILM|X-T\d|X-H\d|X-S\d/i, log: 'cam-flog', logRe: /F-?Log/i, models: /X-[THSE]\d+\w*|GFX[\w ]+/ },
  { make: 'Nikon', re: /NIKON|Nikon Z/i, log: 'cam-nlog', logRe: /N-?Log/i, models: /Z ?\d+\w*|Zf|Zfc/ },
  { make: 'DJI', re: /DJI|Osmo|Mavic|Mini ?\d Pro|Air ?\d|Avata|Action ?\d|Pocket ?\d/i, log: 'cam-dlog', logRe: /D-?Log/i, models: /(Osmo [\w ]+|Mavic [\w ]+|Mini \d( Pro)?|Air \dS?|Avata ?\d?|Action ?\d|Pocket ?\d)/ },
  { make: 'GoPro', re: /GoPro|HERO\d/i, log: 'cam-protune', models: /HERO\d+( Black)?/ },
  { make: 'Insta360', re: /Insta360/i, log: 'cam-log', models: /Insta360 [\w ]+/ },
  { make: 'Blackmagic', re: /Blackmagic|BMPCC/i, log: 'cam-log', models: /BMPCC ?\w*|Pocket Cinema Camera \w*/ },
  { make: 'Samsung', re: /samsung|SM-[A-Z]\d{3}/i, log: 'cam-log', models: /SM-[A-Z]\d{3}\w*|Galaxy [\w ]+/ },
  { make: 'Google', re: /Google|Pixel \d/i, log: null, models: /Pixel \d+( Pro| a)?/ },
  { make: 'Xiaomi', re: /Xiaomi|Redmi|POCO/i, log: 'cam-log', models: /(Redmi|POCO|Xiaomi) [\w ]+/ },
  { make: 'Motorola', re: /motorola|moto [geg]/i, log: null, models: /moto [\w ]+/ },
  { make: 'Huawei', re: /HUAWEI/i, log: null },
  { make: 'OnePlus', re: /OnePlus/i, log: null },
  { make: 'OPPO', re: /OPPO/i, log: null },
  { make: 'vivo', re: /\bvivo\b/i, log: null },
];

async function scanText(blob: Blob): Promise<string> {
  const head = await blob.slice(0, Math.min(blob.size, 512 * 1024)).arrayBuffer();
  const tail = blob.size > 1024 * 1024 ? await blob.slice(blob.size - 512 * 1024).arrayBuffer() : new ArrayBuffer(0);
  const dec = (b: ArrayBuffer) => { const u = new Uint8Array(b); let s = ''; for (let i = 0; i < u.length; i++) { const c = u[i]; s += c >= 32 && c < 127 ? String.fromCharCode(c) : ' '; } return s.replace(/ {3,}/g, '  '); };
  return dec(head) + ' ' + dec(tail);
}

async function frameStats(mediaId: string, from: number, to: number) {
  const url = await ensureUrl(mediaId);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.src = url ?? '';
  await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('vídeo ilegível')); });
  const c = document.createElement('canvas'); c.width = 80; c.height = 80;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  let n = 0, sl = 0, sl2 = 0, ss = 0, minL = 1, maxL = 0, sr = 0, sb = 0;
  const lums: number[] = [];
  for (let i = 0; i < 5; i++) {
    await new Promise<void>((res) => { const to2 = setTimeout(res, 2000); v.onseeked = () => { clearTimeout(to2); res(); }; v.currentTime = from + ((to - from) * (i + 0.5)) / 5; });
    ctx.drawImage(v, 0, 0, 80, 80);
    const d = ctx.getImageData(0, 0, 80, 80).data;
    for (let k = 0; k < d.length; k += 4) {
      const r = d[k] / 255, g = d[k + 1] / 255, b = d[k + 2] / 255;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sl += l; sl2 += l * l; ss += Math.max(r, g, b) - Math.min(r, g, b); sr += r; sb += b; n++;
      lums.push(l);
    }
  }
  v.removeAttribute('src'); v.load();
  lums.sort((a, b) => a - b);
  minL = lums[Math.floor(lums.length * 0.01)]; maxL = lums[Math.floor(lums.length * 0.99)];
  const mean = sl / n;
  return { mean, std: Math.sqrt(Math.max(0, sl2 / n - mean * mean)), sat: ss / n, black: minL, white: maxL, warm: (sr - sb) / n };
}

export interface CameraAnalysis {
  info: CameraInfo;
  stats: { mean: number; std: number; sat: number; black: number; white: number; warm: number };
  lut: string | null;
  adjust: Partial<Adjust>;
  summary: string[];
}

export async function analyzeCamera(mediaId: string, from: number, to: number): Promise<CameraAnalysis> {
  const blob = await ensureBlob(mediaId);
  if (!blob) throw new Error('Mídia indisponível');
  let text = await scanText(blob);
  let hdr = false;
  let transfer = '';
  try {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    const tags = await input.getMetadataTags().catch(() => null);
    if (tags?.raw) for (const [k, v] of Object.entries(tags.raw)) if (typeof v === 'string') text += ` ${k}=${v}`;
    const vt = await input.getPrimaryVideoTrack();
    if (vt) {
      const cs = await vt.getColorSpace().catch(() => null);
      transfer = String(cs?.transfer ?? '');
      hdr = /hlg|pq|smpte2084|arib/i.test(transfer);
    }
  } catch { /* metadata optional */ }

  const brand = BRANDS.find((b) => b.re.test(text));
  const model = brand?.models ? (text.match(brand.models)?.[0] ?? '').trim() : '';
  const stats = await frameStats(mediaId, from, to);
  const flat = stats.std < 0.16 && stats.sat < 0.2 && stats.black > 0.05 && stats.white < 0.9;
  const taggedLog = brand?.logRe ? brand.logRe.test(text) : false;
  const isLog = taggedLog || (flat && !hdr);
  let lut: string | null = null;
  let log: string | null = null;
  const summary: string[] = [];
  summary.push(brand ? `Câmera: ${brand.make}${model ? ' ' + model : ''}` : 'Câmera: não identificada nos metadados');
  if (hdr) { lut = 'cam-hlg'; summary.push(`Gravação HDR (${transfer || 'HLG/PQ'}) detectada → convertendo para SDR`); }
  else if (isLog) {
    lut = brand?.log ?? 'cam-log';
    log = lut;
    summary.push(taggedLog ? 'Perfil LOG indicado nos metadados' : 'Imagem lavada/sem contraste: parece perfil LOG ou flat');
    summary.push('LUT de conversão aplicado para Rec.709');
  } else if (brand && ['Apple', 'Samsung', 'Google', 'Xiaomi', 'Motorola', 'Huawei', 'OnePlus', 'OPPO', 'vivo'].includes(brand.make)) {
    summary.push('Gravação padrão de celular (já em Rec.709) → correção natural');
  } else summary.push('Gravação padrão (Rec.709) → correção automática');

  // primary correction on top of the conversion
  const adj: Partial<Adjust> = {};
  const target = isLog || hdr ? null : stats;
  if (target) {
    adj.exposure = Math.round(Math.max(-35, Math.min(40, (0.46 - target.mean) * 110)));
    adj.contrast = Math.round(Math.max(-15, Math.min(35, (0.21 - target.std) * 150)));
    adj.saturation = Math.round(Math.max(-25, Math.min(30, (0.26 - target.sat) * 80)));
    adj.temperature = Math.round(Math.max(-25, Math.min(25, -target.warm * 90)));
    if (target.black > 0.08) adj.shadows = -12;
    if (target.white > 0.97) adj.highlights = -18;
    // brand-specific tendencies of phone image processing
    if (brand?.make === 'Samsung') adj.saturation = (adj.saturation ?? 0) - 10;
    if (brand?.make === 'Apple') adj.temperature = (adj.temperature ?? 0) - 4;
    if (brand?.make === 'Google') adj.shadows = (adj.shadows ?? 0) + 6;
    adj.sharpen = 8;
    if (Math.abs(adj.exposure) > 5) summary.push(adj.exposure > 0 ? 'Exposição baixa → clareando' : 'Exposição alta → escurecendo');
    if (Math.abs(adj.temperature) > 5) summary.push(adj.temperature > 0 ? 'Imagem fria → aquecendo' : 'Imagem quente → neutralizando');
  } else {
    adj.contrast = 5; adj.vibrance = 10;
  }
  return {
    info: { make: brand?.make ?? 'Desconhecida', model, log, hdr, profile: lut },
    stats, lut, adjust: adj, summary,
  };
}
