CREATE TABLE IF NOT EXISTS early_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  source TEXT,
  referrer TEXT
);
CREATE INDEX IF NOT EXISTS early_access_created_at ON early_access (created_at);
