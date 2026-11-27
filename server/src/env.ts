export interface Env {
  DB: D1Database;
  VIDEOS: R2Bucket;
  /** Built app (Magnata Studio + Central), served from the same address as the API. */
  ASSETS?: Fetcher;
  APP_URL: string;
  API_URL: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET: string;
  TIKTOK_PUBLIC: string;
  AI_MODEL: string;
  // secrets
  /** Optional legacy master token. The normal way in is the password created on first access. */
  ADMIN_TOKEN?: string;
  /** One-time code required to create the password on first access. */
  SETUP_CODE?: string;
  TOKEN_KEY: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  IG_APP_ID?: string;
  IG_APP_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
  ANTHROPIC_API_KEY?: string;
}
