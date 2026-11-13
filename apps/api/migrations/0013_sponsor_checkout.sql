ALTER TABLE sponsors ADD COLUMN line TEXT;
ALTER TABLE sponsors ADD COLUMN banner TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE sponsorships ADD COLUMN stripe_session TEXT;
ALTER TABLE sponsorships ADD COLUMN stripe_payment_intent TEXT;
CREATE UNIQUE INDEX sponsorships_stripe_session ON sponsorships (stripe_session, month) WHERE stripe_session IS NOT NULL;
CREATE INDEX sponsorships_stripe_pi ON sponsorships (stripe_payment_intent) WHERE stripe_payment_intent IS NOT NULL;
