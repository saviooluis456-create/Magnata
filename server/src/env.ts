export interface Env {
  DB: D1Database;
  VIDEOS: R2Bucket;
  APP_URL: string;
  API_URL: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET: string;
  TIKTOK_PUBLIC: string;
  AI_MODEL: string;
  // secrets
  ADMIN_TOKEN: string;
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
