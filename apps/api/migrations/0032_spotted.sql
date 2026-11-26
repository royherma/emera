CREATE TABLE spotted (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES users (id),
  url TEXT NOT NULL,
  reporter_email TEXT,
  reporter_user_id TEXT REFERENCES users (id),
  ip_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'filed', 'dismissed')),
  report_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE UNIQUE INDEX spotted_post_url ON spotted (post_id, url);
CREATE INDEX spotted_creator ON spotted (creator_id, created_at DESC, id DESC);
CREATE INDEX spotted_ip ON spotted (ip_hash, created_at);
