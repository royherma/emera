CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  visitor TEXT,
  path TEXT NOT NULL,
  referrer TEXT,
  utm TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  timezone TEXT,
  network TEXT,
  ua TEXT,
  lang TEXT,
  bot INTEGER NOT NULL DEFAULT 0,
  tester INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS visits_created_at ON visits (created_at);
CREATE INDEX IF NOT EXISTS visits_visitor ON visits (visitor, id);

ALTER TABLE early_access ADD COLUMN visitor TEXT;
ALTER TABLE early_access ADD COLUMN country TEXT;
ALTER TABLE early_access ADD COLUMN city TEXT;
ALTER TABLE early_access ADD COLUMN ua TEXT;
ALTER TABLE early_access ADD COLUMN tester INTEGER NOT NULL DEFAULT 0;
