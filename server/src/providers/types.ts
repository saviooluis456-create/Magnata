import type { CommentItem, MetricRow, Network, Post } from '../../../src/central/core/types';
import type { Account, Token } from '../db';
import type { Env } from '../env';

export interface Connected { token: Token; remoteId: string; name?: string; handle?: string }
export interface PublishResult { status: 'publicado' | 'privado'; remoteId?: string; providerPostId?: string; url?: string; note?: string }

export interface Provider {
  network: Network;
  configured(env: Env): boolean;
  authUrl(env: Env, state: string): string;
  exchange(env: Env, code: string): Promise<Connected>;
  /** Returns a fresh token when the current one is near expiry, else null. */
  refresh(env: Env, token: Token): Promise<Token | null>;
  profile(env: Env, acc: Account): Promise<{ followers?: number; name?: string; handle?: string }>;
  publish(env: Env, acc: Account, post: Post): Promise<PublishResult>;
  /** Comments on the account's recent videos. Empty when the platform offers no comment API. */
  comments(env: Env, acc: Account): Promise<Omit<CommentItem, 'status'>[]>;
  reply(env: Env, acc: Account, c: CommentItem, text: string): Promise<void>;
  metrics(env: Env, acc: Account, items: { postId: string; remoteId: string; providerPostId?: string }[]): Promise<MetricRow[]>;
  publicPosting(env: Env): boolean;
}

export const callback = (env: Env, network: Network) => `${env.API_URL.replace(/\/$/, '')}/oauth/${network}/callback`;
