-- Central do Set: D1 (SQLite) schema. Apply with: npm run db:init
CREATE TABLE IF NOT EXISTS accounts (
  network TEXT PRIMARY KEY,           -- instagram | tiktok | youtube
  remote_id TEXT,                     -- IG user id / TikTok open_id / YouTube channel id
  name TEXT,
  handle TEXT,
  token_enc TEXT NOT NULL,            -- AES-GCM encrypted JSON {access, refresh, expiresAt}
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  network TEXT NOT NULL,
  verifier TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  scheduled_at INTEGER,
  status TEXT NOT NULL,               -- rascunho | agendado | processando | concluido | erro
  data TEXT NOT NULL                  -- JSON Post
);
CREATE INDEX IF NOT EXISTS posts_due ON posts(status, scheduled_at);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,                -- network:remoteId
  network TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  data TEXT NOT NULL                  -- JSON CommentItem
);
CREATE INDEX IF NOT EXISTS comments_status ON comments(status, created_at);

CREATE TABLE IF NOT EXISTS metrics (
  network TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  post_id TEXT,
  updated_at INTEGER NOT NULL,
  data TEXT NOT NULL,                 -- JSON MetricRow
  PRIMARY KEY (network, remote_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------- Inteligência ----------
CREATE TABLE IF NOT EXISTS snapshots (
  network TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  post_id TEXT,
  age_hours REAL NOT NULL,
  views INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  PRIMARY KEY (network, remote_id, captured_at)
);

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playbook (
  version INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bench_channels (
  channel_id TEXT PRIMARY KEY,
  title TEXT,
  handle TEXT,
  added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bench_videos (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  data TEXT NOT NULL
);

-- ---------- Acesso (login da Central e chaves do Claude) ----------
CREATE TABLE IF NOT EXISTS api_keys (
  hash TEXT PRIMARY KEY,              -- SHA-256 of the token (the token itself is never stored)
  role TEXT NOT NULL,                 -- admin (sessão do app) | claude (chave com permissões limitadas)
  scopes TEXT NOT NULL,               -- JSON array
  label TEXT,
  prefix TEXT,                        -- first characters, to recognize the key in the list
  created_at INTEGER NOT NULL,
  last_used INTEGER,
  expires_at INTEGER
);
