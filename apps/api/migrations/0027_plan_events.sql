CREATE TABLE plan_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  email TEXT,
  plan TEXT NOT NULL,
  plan_until INTEGER,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
