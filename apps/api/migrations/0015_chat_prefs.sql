CREATE TABLE chat_settings (
  user_id TEXT PRIMARY KEY REFERENCES users (id),
  dm_from TEXT NOT NULL DEFAULT 'everyone',
  channels_hidden INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

ALTER TABLE dm_members ADD COLUMN muted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dm_messages ADD COLUMN post_id TEXT;
