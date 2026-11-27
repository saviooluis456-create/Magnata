// Reads resolution, duration, codec, fps and bitrate from the file without re-encoding it.
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import type { VideoMeta } from './core/types';

export async function readVideoMeta(file: Blob): Promise<VideoMeta> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('O arquivo não tem faixa de vídeo.');
    const [duration, stats, format] = await Promise.all([
      input.computeDuration(),
      track.computePacketStats(300).catch(() => null),
      input.getFormat().catch(() => null),
    ]);
    const fmt = format?.name?.toLowerCase() ?? '';
    return {
      width: track.displayWidth,
      height: track.displayHeight,
      duration,
      sizeBytes: file.size,
      fps: stats && isFinite(stats.averagePacketRate) ? stats.averagePacketRate : undefined,
      videoBitrate: stats && isFinite(stats.averageBitrate) ? stats.averageBitrate : undefined,
      codec: track.codec ?? undefined,
      container: fmt.includes('webm') ? 'webm' : fmt.includes('quicktime') || fmt.includes('mov') ? 'mov' : 'mp4',
    };
  } finally {
    input.dispose?.();
  }
}

/** Hands an exported video from the editor to the Central (same tab, no copy to disk). */
export const handoff: { video: { blob: Blob; name: string } | null } = { video: null };
