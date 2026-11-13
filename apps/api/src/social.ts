import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv, Env, UserRow } from './env';
import { requireAuth, requireHandle } from './auth';
import { fail } from './http';
import { usersJson } from './serialize';
import { viewerOf } from './viewer';

const PAGE = 30;

export async function onFollow(_env: Env, _followerId: string, _followeeId: string): Promise<void> {}

const pageLimit = (raw: string | undefined) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 100) : PAGE;
};

const encode = (at: number, id: string) => btoa(`${at}_${id}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function decode(raw: string | undefined): { at: number; id: string } | null {
  if (!raw) return null;
  try {
    const [at, id] = atob(raw.replace(/-/g, '+').replace(/_/g, '/')).split('_');
    const n = Number(at);
    return Number.isFinite(n) && id ? { at: n, id } : null;
  } catch {
    return null;
  }
}

async function userByHandle(c: Context<AppEnv>): Promise<UserRow> {
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE handle = ?').bind(c.req.param('handle')!.toLowerCase().replace(/^@/, '')).first<UserRow>();
  if (!user) throw fail(404, 'not_found', 'No such user.');
  return user;
}

async function blockedBy(c: Context<AppEnv>, blockerId: string, blockedId: string) {
  return !!(await c.env.DB.prepare('SELECT 1 AS x FROM blocks WHERE blocker_id = ? AND blocked_id = ?').bind(blockerId, blockedId).first());
}

async function target(c: Context<AppEnv>): Promise<UserRow> {
  const me = c.get('user');
  const user = await userByHandle(c);
  if (user.id === me.id) throw fail(400, 'self', 'You cannot do that to yourself.');
  return user;
}

async function reply(c: Context<AppEnv>, user: UserRow) {
  return c.json({ user: (await usersJson(c, [user]))[0] });
}

async function page(c: Context<AppEnv>, edgeSql: string, edgeArgs: (string | number)[], hideRelatedTo: string | null) {
  const limit = pageLimit(c.req.query('limit'));
  const cur = decode(c.req.query('cursor'));
  const where = ['u.handle IS NOT NULL'];
  const bind: (string | number)[] = [];
  if (hideRelatedTo) {
    where.push('u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)', 'u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)');
    bind.push(hideRelatedTo, hideRelatedTo);
  }
  if (cur) {
    where.push('(e.at < ? OR (e.at = ? AND u.id < ?))');
    bind.push(cur.at, cur.at, cur.id);
  }
  const rows = (
    await c.env.DB.prepare(
      `SELECT u.*, e.at AS edge_at FROM (${edgeSql}) e JOIN users u ON u.id = e.uid WHERE ${where.join(' AND ')} ORDER BY e.at DESC, u.id DESC LIMIT ?`,
    ).bind(...edgeArgs, ...bind, limit + 1).all<UserRow & { edge_at: number }>()
  ).results;
  const slice = rows.slice(0, limit);
  const last = slice[slice.length - 1];
  return { users: await usersJson(c, slice), cursor: rows.length > limit && last ? encode(last.edge_at, last.id) : null };
}

async function followList(c: Context<AppEnv>, direction: 'followers' | 'following') {
  const owner = await userByHandle(c);
  const viewer = await viewerOf(c);
  if (viewer && viewer.id !== owner.id && (await blockedBy(c, owner.id, viewer.id))) throw fail(404, 'not_found', 'No such user.');
  const edgeSql =
    direction === 'followers'
      ? 'SELECT follower_id AS uid, created_at AS at FROM follows WHERE followee_id = ?'
      : 'SELECT followee_id AS uid, created_at AS at FROM follows WHERE follower_id = ?';
  return c.json(await page(c, edgeSql, [owner.id], viewer?.id ?? null));
}

export const social = new Hono<AppEnv>();

social.post('/v1/follows/:handle', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const user = await target(c);
  if (await blockedBy(c, user.id, me.id)) throw fail(404, 'not_found', 'No such user.');
  if (await blockedBy(c, me.id, user.id)) throw fail(403, 'blocked', 'Unblock this account to follow it.');
  const res = await c.env.DB.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)').bind(me.id, user.id, Date.now()).run();
  if (res.meta.changes) await onFollow(c.env, me.id, user.id);
  return reply(c, user);
});

social.delete('/v1/follows/:handle', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const user = await target(c);
  await c.env.DB.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').bind(me.id, user.id).run();
  return reply(c, user);
});

social.get('/v1/users/:handle/followers', (c) => followList(c, 'followers'));

social.get('/v1/users/:handle/following', (c) => followList(c, 'following'));

social.post('/v1/blocks/:handle', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const user = await target(c);
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)').bind(me.id, user.id, Date.now()),
    c.env.DB.prepare('DELETE FROM follows WHERE (follower_id = ? AND followee_id = ?) OR (follower_id = ? AND followee_id = ?)').bind(me.id, user.id, user.id, me.id),
  ]);
  return reply(c, user);
});

social.delete('/v1/blocks/:handle', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const user = await target(c);
  await c.env.DB.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').bind(me.id, user.id).run();
  return reply(c, user);
});

social.post('/v1/mutes/:handle', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const user = await target(c);
  await c.env.DB.prepare('INSERT OR IGNORE INTO mutes (muter_id, muted_id, created_at) VALUES (?, ?, ?)').bind(me.id, user.id, Date.now()).run();
  return reply(c, user);
});

social.delete('/v1/mutes/:handle', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const user = await target(c);
  await c.env.DB.prepare('DELETE FROM mutes WHERE muter_id = ? AND muted_id = ?').bind(me.id, user.id).run();
  return reply(c, user);
});

social.get('/v1/me/blocks', requireAuth, async (c) => {
  return c.json(await page(c, 'SELECT blocked_id AS uid, created_at AS at FROM blocks WHERE blocker_id = ?', [c.get('user').id], null));
});

social.get('/v1/me/mutes', requireAuth, async (c) => {
  return c.json(await page(c, 'SELECT muted_id AS uid, created_at AS at FROM mutes WHERE muter_id = ?', [c.get('user').id], null));
});
