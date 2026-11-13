CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  community_id TEXT,
  name TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  slow_seconds INTEGER NOT NULL DEFAULT 0,
  last_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE channel_mods (
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE channel_reads (
  channel_id TEXT NOT NULL REFERENCES channels (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  read_at INTEGER NOT NULL,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE channel_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX channel_messages_room ON channel_messages (channel_id, created_at, id);
CREATE INDEX channel_messages_user ON channel_messages (user_id, created_at);

CREATE TABLE dm_threads (
  id TEXT PRIMARY KEY,
  pair TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES users (id),
  last_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE dm_members (
  thread_id TEXT NOT NULL REFERENCES dm_threads (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  accepted INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  read_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX dm_members_user ON dm_members (user_id, hidden, accepted);

CREATE TABLE dm_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES dm_threads (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  sealed TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX dm_messages_thread ON dm_messages (thread_id, created_at, id);
CREATE INDEX dm_messages_user ON dm_messages (user_id, created_at);

ALTER TABLE flags ADD COLUMN evidence TEXT;

INSERT INTO channels (id, name, topic, position, created_at) VALUES
  ('lobby', 'lobby', 'Say hi and meet the people here', 0, 1794528000000),
  ('feedback', 'feedback', 'Bugs, ideas and what we should build next', 1, 1794528000000),
  ('news', 'news', 'What is happening where you are', 2, 1794528000000);
