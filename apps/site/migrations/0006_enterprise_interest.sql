CREATE TABLE IF NOT EXISTS enterprise_interest (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  creators INTEGER,
  referrer TEXT,
  visitor TEXT,
  country TEXT,
  city TEXT,
  ua TEXT,
  tester INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS enterprise_interest_created_at ON enterprise_interest (created_at);
CREATE INDEX IF NOT EXISTS enterprise_interest_email ON enterprise_interest (email, created_at);
