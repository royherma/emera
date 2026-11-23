CREATE TABLE takedown_authorizations (
  user_id TEXT NOT NULL REFERENCES users (id),
  text_version TEXT NOT NULL,
  full_name TEXT NOT NULL,
  text TEXT NOT NULL,
  country TEXT,
  signed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, text_version)
);

CREATE TABLE takedowns (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL UNIQUE REFERENCES reports (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  post_id TEXT NOT NULL,
  copy_url TEXT NOT NULL,
  site TEXT NOT NULL,
  method TEXT NOT NULL,
  target TEXT,
  recipient_note TEXT NOT NULL DEFAULT '',
  notice TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  auth_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  reject_reason TEXT,
  created_at INTEGER NOT NULL,
  ready_at INTEGER,
  sent_at INTEGER,
  sent_via TEXT,
  removed_at INTEGER,
  last_check_at INTEGER,
  last_http INTEGER,
  check_reason TEXT,
  image_ref TEXT,
  checks INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX takedowns_user ON takedowns (user_id, created_at DESC);
CREATE INDEX takedowns_status ON takedowns (status, last_check_at);
