CREATE TABLE scans (
  media_id TEXT PRIMARY KEY REFERENCES media (id) ON DELETE CASCADE,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  media_key TEXT NOT NULL,
  last_scanned_at INTEGER,
  next_scan_at INTEGER NOT NULL
);
CREATE INDEX scans_due ON scans (next_scan_at);
CREATE INDEX scans_user ON scans (user_id);

CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id),
  url TEXT NOT NULL,
  page_title TEXT NOT NULL DEFAULT '',
  site TEXT NOT NULL DEFAULT '',
  thumbnail TEXT,
  found_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  report_id TEXT,
  reason TEXT NOT NULL,
  UNIQUE (post_id, url)
);
CREATE INDEX matches_user ON matches (user_id, found_at DESC);

CREATE TABLE scan_meta (
  key TEXT PRIMARY KEY,
  n INTEGER NOT NULL
);
