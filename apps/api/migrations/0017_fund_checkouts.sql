CREATE TABLE fund_checkouts (
  session_id TEXT PRIMARY KEY,
  sponsor_name TEXT NOT NULL,
  email TEXT NOT NULL,
  url TEXT,
  line TEXT,
  monthly_cents INTEGER NOT NULL,
  months INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  amount_total INTEGER,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  promo_code TEXT,
  tester INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX fund_checkouts_created ON fund_checkouts (created_at);
CREATE INDEX fund_checkouts_status ON fund_checkouts (status, created_at);
