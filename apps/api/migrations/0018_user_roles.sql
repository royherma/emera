ALTER TABLE users ADD COLUMN role TEXT CHECK (role IN ('admin', 'mod', 'creator'));
UPDATE users SET role = 'admin' WHERE handle = 'techguyver';
UPDATE users SET role = 'mod' WHERE role IS NULL AND id IN (SELECT user_id FROM channel_mods WHERE channel_id = '*');
