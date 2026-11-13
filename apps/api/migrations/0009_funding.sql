CREATE TABLE fund_watch (
  day TEXT NOT NULL,
  viewer_id TEXT NOT NULL REFERENCES users (id),
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES users (id),
  seconds INTEGER NOT NULL DEFAULT 0,
  demo INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, viewer_id, post_id)
);
CREATE INDEX fund_watch_viewer_creator ON fund_watch (day, viewer_id, creator_id);
CREATE INDEX fund_watch_creator ON fund_watch (day, creator_id);
CREATE INDEX fund_watch_post ON fund_watch (post_id);

CREATE TABLE sponsors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  url TEXT,
  contact_email TEXT,
  demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE sponsorships (
  id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL REFERENCES sponsors (id),
  month TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  refund_month TEXT,
  demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  refunded_at INTEGER
);
CREATE INDEX sponsorships_month ON sponsorships (month, status);
CREATE INDEX sponsorships_refund_month ON sponsorships (refund_month);
CREATE INDEX sponsorships_sponsor ON sponsorships (sponsor_id);

CREATE TABLE fund_months (
  month TEXT PRIMARY KEY,
  sponsored_cents INTEGER NOT NULL,
  carry_in_cents INTEGER NOT NULL,
  carry_out_cents INTEGER NOT NULL,
  creator_pool_cents INTEGER NOT NULL,
  emera_cents INTEGER NOT NULL,
  total_seconds INTEGER NOT NULL,
  creators INTEGER NOT NULL,
  sponsors INTEGER NOT NULL,
  rules_version TEXT NOT NULL,
  statement TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  closed_at INTEGER NOT NULL
);

CREATE TABLE fund_shares (
  month TEXT NOT NULL REFERENCES fund_months (month) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES users (id),
  seconds INTEGER NOT NULL,
  share_ppm INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  PRIMARY KEY (month, creator_id)
);
CREATE INDEX fund_shares_creator ON fund_shares (creator_id, month DESC);
