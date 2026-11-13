CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES users (id),
  followee_id TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX follows_followee ON follows (followee_id, created_at DESC, follower_id DESC);
CREATE INDEX follows_follower ON follows (follower_id, created_at DESC, followee_id DESC);

CREATE TABLE blocks (
  blocker_id TEXT NOT NULL REFERENCES users (id),
  blocked_id TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX blocks_blocked ON blocks (blocked_id);

CREATE TABLE mutes (
  muter_id TEXT NOT NULL REFERENCES users (id),
  muted_id TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (muter_id, muted_id)
);
