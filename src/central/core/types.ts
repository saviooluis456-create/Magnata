// Shared contract between the Central do Set app (browser) and its API (Cloudflare Worker).

export type Network = 'instagram' | 'tiktok' | 'youtube';
export const NETWORKS: Network[] = ['instagram', 'tiktok', 'youtube'];
export const NETWORK_LABEL: Record<Network, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };

/** short = Reels / TikTok / Shorts (vertical or square, up to 3 min). long = YouTube long-form. */
export type VideoFormat = 'short' | 'long';

export type Editoria = 'noticia' | 'estreia' | 'crime' | 'bastidores' | 'teoria';
export const EDITORIA_LABEL: Record<Editoria, string> = {
  noticia: 'Notícia', estreia: 'Estreia', crime: 'Caso real', bastidores: 'Bastidores', teoria: 'Teoria',
};

export interface VideoMeta {
  width: number;
  height: number;
  duration: number; // seconds
  sizeBytes: number;
  fps?: number;
  videoBitrate?: number; // bits/s
  codec?: string; // e.g. 'avc', 'hevc', 'vp9', 'av1'
  container?: string; // 'mp4' | 'mov' | 'webm'
}

export interface NetworkCaption {
  instagram: { caption: string };
  tiktok: { caption: string };
  youtube: { title: string; description: string; tags: string[] };
}

export type TargetStatus = 'pendente' | 'agendado' | 'enviando' | 'publicado' | 'privado' | 'erro';

export interface PostTarget {
  network: Network;
  status: TargetStatus;
  remoteId?: string;
  /** Post id at the connection service (Zernio), when the account is connected through it. */
  providerPostId?: string;
  url?: string;
  error?: string;
  publishedAt?: number;
}

export interface Post {
  id: string;
  createdAt: number;
  scheduledAt?: number; // epoch ms; undefined = publish now
  format: VideoFormat;
  editoria?: Editoria;
  hookType?: string; // gancho used, to learn which hooks work
  /** A/B test this post belongs to (see core/analytics.ts). */
  experiment?: { id: string; variant: string };
  objectKey: string; // R2 key of the video file
  coverOffsetMs?: number;
  meta: VideoMeta;
  captions: NetworkCaption;
  targets: PostTarget[];
}

export interface CommentItem {
  id: string; // `${network}:${remoteId}`
  network: Network;
  remoteId: string;
  postId?: string;
  mediaRemoteId: string;
  author: string;
  text: string;
  createdAt: number;
  /** AI classification */
  kind?: 'simples' | 'pergunta' | 'critica' | 'ofensivo' | 'sensivel' | 'marca' | 'spam';
  draft?: string;
  status: 'novo' | 'rascunho' | 'respondido' | 'ignorado' | 'revisar';
  replyText?: string;
  repliedAt?: number;
}

export interface MetricRow {
  postId: string;
  network: Network;
  remoteId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves?: number;
  reach?: number;
  avgWatchSec?: number;
  avgViewPct?: number; // 0-100 (YouTube)
  followersGained?: number;
  updatedAt: number;
}

export interface AccountStatus {
  network: Network;
  connected: boolean;
  name?: string;
  handle?: string;
  followers?: number;
  /** TikTok/YouTube: posts stay private until the developer app passes the platform audit. */
  publicPosting: boolean;
  expiresAt?: number;
  /** 'rapida' = connected through Zernio (one tap); 'oficial' = own developer app. */
  via?: 'rapida' | 'oficial';
}

export type ReplyMode = 'aprovacao' | 'automatico' | 'desligado';

export interface Settings {
  replyMode: ReplyMode;
  extraBlockedHashtags: string[];
  signature: string;
}
