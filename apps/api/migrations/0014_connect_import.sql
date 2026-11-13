ALTER TABLE sessions ADD COLUMN client_id TEXT;

CREATE TABLE oauth_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE oauth_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  redirect_uri TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE oauth_refresh (
  token_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX oauth_refresh_user ON oauth_refresh (user_id);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  kind TEXT NOT NULL,
  spec TEXT NOT NULL,
  label TEXT NOT NULL,
  auto INTEGER NOT NULL DEFAULT 0,
  since INTEGER NOT NULL,
  last_checked INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, kind, spec)
);
CREATE INDEX sources_auto ON sources (auto, last_checked);

CREATE TABLE imported_items (
  user_id TEXT NOT NULL REFERENCES users (id),
  item_id TEXT NOT NULL,
  source TEXT NOT NULL,
  post_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
