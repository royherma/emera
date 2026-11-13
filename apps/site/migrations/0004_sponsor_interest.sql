CREATE TABLE IF NOT EXISTS sponsor_interest (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  monthly_cents INTEGER,
  url TEXT,
  referrer TEXT,
  visitor TEXT,
  country TEXT,
  city TEXT,
  ua TEXT,
  tester INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS sponsor_interest_created_at ON sponsor_interest (created_at);
CREATE INDEX IF NOT EXISTS sponsor_interest_email ON sponsor_interest (email, created_at);
