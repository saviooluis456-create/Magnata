// Format detection and "maximum quality" checks against each network's published upload specs.
import type { Network, VideoFormat, VideoMeta } from './types';

export type Level = 'ok' | 'aviso' | 'erro';
export interface Check { level: Level; network: Network | 'geral'; message: string }

const MB = 1024 * 1024;
const GB = 1024 * MB;

/** Vertical or square and up to 3 minutes → Shorts/Reels/TikTok. Otherwise YouTube long-form. */
export function detectFormat(m: Pick<VideoMeta, 'width' | 'height' | 'duration'>): VideoFormat {
  return m.width <= m.height && m.duration <= 180 ? 'short' : 'long';
}

/** Recommended export for maximum quality (what the editor should render before uploading). */
export function recommendedExport(format: VideoFormat, sourceHeight = 1080) {
  if (format === 'short') {
    return { width: 1080, height: 1920, fps: 30, codec: 'H.264 (High)', videoMbps: 20, audio: 'AAC 48 kHz 192 kbps', note: 'Instagram limita a 25 Mbps; 20 Mbps dá a melhor imagem sem recompressão extra.' };
  }
  const uhd = sourceHeight >= 2160;
  return uhd
    ? { width: 3840, height: 2160, fps: 30, codec: 'H.264 (High) ou HEVC', videoMbps: 45, audio: 'AAC 48 kHz 384 kbps', note: 'Em 4K o YouTube usa o codec VP9/AV1, que dá imagem melhor até para quem assiste em 1080p.' }
    : { width: 1920, height: 1080, fps: 30, codec: 'H.264 (High)', videoMbps: 12, audio: 'AAC 48 kHz 384 kbps', note: 'Se a fonte tiver 4K, exporte em 4K: o YouTube entrega 1080p com mais qualidade.' };
}

export function checkVideo(m: VideoMeta, networks: Network[], format: VideoFormat = detectFormat(m)): Check[] {
  const out: Check[] = [];
  const short = Math.min(m.width, m.height);
  const ratio = m.width / m.height;
  const mbps = m.videoBitrate ? m.videoBitrate / 1e6 : (m.sizeBytes * 8) / Math.max(m.duration, 0.1) / 1e6;
  const codec = (m.codec ?? '').toLowerCase();
  const add = (level: Level, network: Check['network'], message: string) => out.push({ level, network, message });

  // General quality
  if (short < 720) add('erro', 'geral', `Resolução baixa (${m.width}x${m.height}). Exporte em pelo menos 1080p.`);
  else if (short < 1080) add('aviso', 'geral', `Resolução ${m.width}x${m.height}. Para qualidade máxima, exporte em 1080p ou mais.`);
  else add('ok', 'geral', `Resolução ${m.width}x${m.height}.`);
  if (m.fps && (m.fps < 23 || m.fps > 60)) add('aviso', 'geral', `${Math.round(m.fps)} fps. Use entre 24 e 60 fps.`);
  if (codec && !/avc|h264|hevc|h265|hvc|hev/.test(codec)) add('aviso', 'geral', `Codec ${m.codec}: prefira H.264 (máxima compatibilidade) ou HEVC.`);
  const minMbps = format === 'short' ? 8 : short >= 2160 ? 35 : 8;
  if (mbps < minMbps * 0.6) add('aviso', 'geral', `Taxa de bits baixa (~${mbps.toFixed(1)} Mbps). As redes recomprimem: suba com pelo menos ${minMbps} Mbps.`);

  for (const n of networks) {
    if (n === 'instagram') {
      if (m.duration < 3) add('erro', n, 'Reels precisa ter pelo menos 3 segundos.');
      if (m.duration > 15 * 60) add('erro', n, 'Reels pela API aceita até 15 minutos.');
      if (m.sizeBytes > 1 * GB) add('erro', n, 'Instagram aceita até 1 GB por vídeo.');
      if (mbps > 25) add('aviso', n, `~${mbps.toFixed(0)} Mbps: acima de 25 Mbps o Instagram recomprime mais forte.`);
      if (ratio > 0.6) add('aviso', n, 'Fora do 9:16: o Reel vai aparecer com bordas ou cortado.');
    }
    if (n === 'tiktok') {
      if (m.duration < 3) add('erro', n, 'TikTok precisa de pelo menos 3 segundos.');
      if (m.duration > 600) add('erro', n, 'A API do TikTok aceita até 10 minutos.');
      if (m.sizeBytes > 4 * GB) add('erro', n, 'TikTok aceita até 4 GB.');
      if (short < 360) add('erro', n, 'TikTok exige pelo menos 360 px.');
      if (ratio > 0.6) add('aviso', n, 'Fora do 9:16: no TikTok vai aparecer com bordas.');
    }
    if (n === 'youtube') {
      if (format === 'short' && m.duration > 180) add('erro', n, 'Shorts tem até 3 minutos.');
      if (format === 'long' && m.width < m.height) add('aviso', n, 'Vídeo longo vertical: o YouTube vai mostrar com barras laterais.');
      if (m.sizeBytes > 256 * GB) add('erro', n, 'YouTube aceita até 256 GB.');
    }
  }
  if (!out.some((c) => c.level !== 'ok')) add('ok', 'geral', 'Pronto para publicar na qualidade máxima.');
  return out;
}

export const formatBytes = (b: number) => (b >= GB ? `${(b / GB).toFixed(2)} GB` : `${(b / MB).toFixed(1)} MB`);
