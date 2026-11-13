ALTER TABLE users ADD COLUMN invite_code TEXT;
CREATE INDEX users_invite_code ON users (invite_code);
