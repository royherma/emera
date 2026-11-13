CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  reporter_user_id TEXT NOT NULL REFERENCES users (id),
  copy_url TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL
);
CREATE INDEX reports_post ON reports (post_id);
CREATE INDEX reports_reporter ON reports (reporter_user_id, created_at DESC);
