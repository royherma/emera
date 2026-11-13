CREATE TABLE IF NOT EXISTS copy (
  page TEXT NOT NULL,
  key TEXT NOT NULL,
  original TEXT,
  draft TEXT,
  live TEXT,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  PRIMARY KEY (page, key)
);
