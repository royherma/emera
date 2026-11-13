import { Hono } from 'hono';
import type { AppEnv } from './env';
import { requireAuth, requireHandle } from './auth';
import { fail, readJson } from './http';
import { newId } from './crypto';

export const FLAG_REASONS = ['spam', 'harassment', 'hate', 'violence', 'nudity', 'self_harm', 'impersonation', 'scam', 'other'] as const;
const HOURLY_CAP = 20;

type FlagRow = { id: string; target_type: string; target_id: string; reason: string; note: string; status: string; created_at: number };

const flagJson = (f: FlagRow) => ({ id: f.id, targetType: f.target_type, targetId: f.target_id, reason: f.reason, note: f.note, status: f.status, createdAt: new Date(f.created_at).toISOString() });

export const flagRoutes = new Hono<AppEnv>();

flagRoutes.post('/v1/flags', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const body = await readJson(c);
  const targetType = body.targetType;
  if (targetType !== 'post' && targetType !== 'user') throw fail(400, 'bad_target', 'Report a post or an account.');
  const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : '';
  if (!targetId || targetId.length > 64) throw fail(400, 'bad_target', 'Say which post or account.');
  if (typeof body.reason !== 'string' || !(FLAG_REASONS as readonly string[]).includes(body.reason)) {
    throw fail(400, 'bad_reason', `Pick a reason: ${FLAG_REASONS.join(', ')}.`);
  }
  const note = body.note === undefined || body.note === null ? '' : body.note;
  if (typeof note !== 'string' || note.length > 1000) throw fail(400, 'bad_note', 'Notes can be up to 1000 characters.');

  const owner = targetType === 'post'
    ? (await c.env.DB.prepare('SELECT user_id AS owner FROM posts WHERE id = ?').bind(targetId).first<{ owner: string }>())?.owner
    : (await c.env.DB.prepare('SELECT id AS owner FROM users WHERE id = ? AND handle IS NOT NULL').bind(targetId).first<{ owner: string }>())?.owner;
  if (!owner) throw fail(404, 'not_found', targetType === 'post' ? 'No such post.' : 'No such account.');
  if (owner === me.id) throw fail(400, 'own_content', 'You cannot report your own posts or account.');

  const existing = await c.env.DB.prepare('SELECT * FROM flags WHERE reporter_user_id = ? AND target_type = ? AND target_id = ?')
    .bind(me.id, targetType, targetId).first<FlagRow>();
  if (existing) return c.json({ flag: flagJson(existing), duplicate: true });

  const recent = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM flags WHERE reporter_user_id = ? AND created_at > ?')
    .bind(me.id, Date.now() - 3600_000).first<{ n: number }>())?.n ?? 0;
  if (recent >= HOURLY_CAP) throw fail(429, 'too_many', 'You have sent a lot of reports this hour. Try again later.');

  const id = newId(10);
  const now = Date.now();
  const trimmed = note.trim();
  await c.env.DB.prepare('INSERT INTO flags (id, reporter_user_id, target_type, target_id, reason, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, me.id, targetType, targetId, body.reason, trimmed, now).run();
  return c.json({ flag: flagJson({ id, target_type: targetType, target_id: targetId, reason: body.reason, note: trimmed, status: 'new', created_at: now }), duplicate: false }, 201);
});

flagRoutes.get('/v1/flags', requireAuth, async (c) => {
  const rows = (await c.env.DB.prepare('SELECT * FROM flags WHERE reporter_user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100')
    .bind(c.get('user').id).all<FlagRow>()).results;
  return c.json({ flags: rows.map(flagJson) });
});
