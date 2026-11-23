ALTER TABLE reports ADD COLUMN resolved_by TEXT;
ALTER TABLE reports ADD COLUMN resolved_at INTEGER;
ALTER TABLE flags ADD COLUMN resolved_by TEXT;
ALTER TABLE flags ADD COLUMN resolved_at INTEGER;
UPDATE users SET role = NULL WHERE role IS NOT NULL AND role NOT IN ('admin', 'mod', 'creator');
CREATE INDEX IF NOT EXISTS reports_status ON reports (status, created_at);
CREATE INDEX IF NOT EXISTS flags_status ON flags (status, created_at);
