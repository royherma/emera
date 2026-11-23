CREATE TABLE IF NOT EXISTS recovery_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  email TEXT NOT NULL,
  copy_url TEXT NOT NULL,
  original_url TEXT NOT NULL,
  note TEXT,
  owns INTEGER NOT NULL DEFAULT 0,
  referrer TEXT,
  visitor TEXT,
  country TEXT,
  city TEXT,
  ua TEXT,
  tester INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS recovery_cases_created_at ON recovery_cases (created_at);
CREATE INDEX IF NOT EXISTS recovery_cases_email ON recovery_cases (email, created_at);
