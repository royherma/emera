CREATE TABLE instagram_links (
  user_id TEXT PRIMARY KEY REFERENCES users (id),
  ig_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
