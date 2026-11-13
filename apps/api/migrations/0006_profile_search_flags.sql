ALTER TABLE users ADD COLUMN links TEXT NOT NULL DEFAULT '[]';
ALTER TABLE media ADD COLUMN alt TEXT NOT NULL DEFAULT '';

CREATE TABLE flags (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT NOT NULL REFERENCES users (id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX flags_once ON flags (reporter_user_id, target_type, target_id);
CREATE INDEX flags_target ON flags (target_type, target_id);
CREATE INDEX flags_reporter ON flags (reporter_user_id, created_at DESC);

CREATE VIRTUAL TABLE users_fts USING fts5(handle, display_name, bio, content='users', tokenize='unicode61 remove_diacritics 2');
INSERT INTO users_fts (users_fts) VALUES ('rebuild');
CREATE TRIGGER users_fts_ai AFTER INSERT ON users BEGIN
  INSERT INTO users_fts (rowid, handle, display_name, bio) VALUES (new.rowid, COALESCE(new.handle, ''), new.display_name, new.bio);
END;
CREATE TRIGGER users_fts_ad AFTER DELETE ON users BEGIN
  INSERT INTO users_fts (users_fts, rowid, handle, display_name, bio) VALUES ('delete', old.rowid, COALESCE(old.handle, ''), old.display_name, old.bio);
END;
CREATE TRIGGER users_fts_au AFTER UPDATE ON users BEGIN
  INSERT INTO users_fts (users_fts, rowid, handle, display_name, bio) VALUES ('delete', old.rowid, COALESCE(old.handle, ''), old.display_name, old.bio);
  INSERT INTO users_fts (rowid, handle, display_name, bio) VALUES (new.rowid, COALESCE(new.handle, ''), new.display_name, new.bio);
END;

CREATE VIRTUAL TABLE posts_fts USING fts5(post_id UNINDEXED, caption, alt, tokenize='unicode61 remove_diacritics 2');
INSERT INTO posts_fts (post_id, caption, alt)
  SELECT p.id, p.caption, COALESCE((SELECT group_concat(m.alt, ' ') FROM media m WHERE m.post_id = p.id), '') FROM posts p;
CREATE TRIGGER posts_fts_ad AFTER DELETE ON posts BEGIN
  DELETE FROM posts_fts WHERE post_id = old.id;
END;
