import type { Context } from 'hono';
import type { AppEnv, UserRow } from './env';
import { sha256Hex } from './crypto';

export type SocialInfo = {
  followers: number;
  following: number;
  viewer?: { following: boolean; blocked: boolean; muted: boolean };
};

export async function viewerOf(c: Context<AppEnv>): Promise<UserRow | null> {
  const set = c.get('user');
  if (set) return set;
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const row = await c.env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`,
  ).bind(await sha256Hex(token), Date.now()).first<UserRow>();
  if (row) c.set('user', row);
  return row ?? null;
}

export async function socialFor(c: Context<AppEnv>, userIds: string[], viewerId?: string | null): Promise<Map<string, SocialInfo>> {
  const ids = [...new Set(userIds)];
  const out = new Map<string, SocialInfo>(ids.map((id) => [id, { followers: 0, following: 0 }]));
  if (!ids.length) return out;
  const ph = ids.map(() => '?').join(',');
  const db = c.env.DB;
  const stmts = [
    db.prepare(`SELECT followee_id AS id, COUNT(*) AS n FROM follows WHERE followee_id IN (${ph}) GROUP BY followee_id`).bind(...ids),
    db.prepare(`SELECT follower_id AS id, COUNT(*) AS n FROM follows WHERE follower_id IN (${ph}) GROUP BY follower_id`).bind(...ids),
  ];
  if (viewerId) {
    stmts.push(
      db.prepare(`SELECT followee_id AS id FROM follows WHERE follower_id = ? AND followee_id IN (${ph})`).bind(viewerId, ...ids),
      db.prepare(`SELECT blocked_id AS id FROM blocks WHERE blocker_id = ? AND blocked_id IN (${ph})`).bind(viewerId, ...ids),
      db.prepare(`SELECT muted_id AS id FROM mutes WHERE muter_id = ? AND muted_id IN (${ph})`).bind(viewerId, ...ids),
    );
  }
  const res = await db.batch<{ id: string; n?: number }>(stmts);
  for (const r of res[0].results) out.get(r.id)!.followers = r.n ?? 0;
  for (const r of res[1].results) out.get(r.id)!.following = r.n ?? 0;
  if (viewerId) {
    const [f, b, m] = [2, 3, 4].map((i) => new Set(res[i].results.map((r) => r.id)));
    for (const [id, info] of out) info.viewer = { following: f.has(id), blocked: b.has(id), muted: m.has(id) };
  }
  return out;
}

export function feedFilter(viewerId: string | null, mode: 'all' | 'following'): { where: string[]; args: string[] } {
  if (!viewerId) return { where: [], args: [] };
  const where = [
    'user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)',
    'user_id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)',
    'user_id NOT IN (SELECT muted_id FROM mutes WHERE muter_id = ?)',
  ];
  const args = [viewerId, viewerId, viewerId];
  if (mode === 'following') {
    where.push('user_id IN (SELECT followee_id FROM follows WHERE follower_id = ?)');
    args.push(viewerId);
  }
  return { where, args };
}
