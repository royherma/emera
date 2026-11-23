ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN plan_until INTEGER;
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX idx_users_stripe_subscription ON users(stripe_subscription_id);
CREATE TABLE protect_pending (
  email TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  plan_until INTEGER,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
