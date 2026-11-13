CREATE TABLE likes (
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX likes_user ON likes (user_id, created_at DESC);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id),
  parent_id TEXT REFERENCES comments (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX comments_post ON comments (post_id, parent_id, created_at, id);
CREATE INDEX comments_user ON comments (user_id, created_at DESC);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  kind TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users (id),
  post_id TEXT REFERENCES posts (id) ON DELETE CASCADE,
  comment_id TEXT REFERENCES comments (id) ON DELETE CASCADE,
  count INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX notifications_user ON notifications (user_id, created_at DESC, id DESC);
CREATE INDEX notifications_unread ON notifications (user_id, read_at);
