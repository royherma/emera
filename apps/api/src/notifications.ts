import { Hono } from 'hono';
import type { AppEnv, Env, UserRow } from './env';
import { requireAuth } from './auth';
import { newId } from './crypto';
import { originOf } from './http';
import { decodeCursor, encodeCursor, iso, userJson, type PostRow } from './serialize';

export type NotifyKind = 'like' | 'comment' | 'reply' | 'follow';

type Row = {
  id: string; kind: string; actor_id: string; post_id: string | null; comment_id: string | null;
  count: number; created_at: number; read_at: number | null; thumb_key: string | null; preview: string | null;
};

function limitOf(raw: string | undefined) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 50) : 30;
}

export async function notify(env: Env, n: { userId: string; kind: NotifyKind; actorId: string; postId?: string | null; commentId?: string | null }) {
  if (n.userId === n.actorId) return;
  const now = Date.now();
  if (n.kind === 'like' && n.postId) {
    const open = await env.DB.prepare(
      `SELECT id, actor_id FROM notifications WHERE user_id = ? AND kind = 'like' AND post_id = ? AND read_at IS NULL`,
    ).bind(n.userId, n.postId).first<{ id: string; actor_id: string }>();
    if (open) {
      if (open.actor_id !== n.actorId) {
        await env.DB.prepare('UPDATE notifications SET count = count + 1, actor_id = ?, created_at = ? WHERE id = ?').bind(n.actorId, now, open.id).run();
      }
      return;
    }
  }
  await env.DB.prepare(
    'INSERT INTO notifications (id, user_id, kind, actor_id, post_id, comment_id, count, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
  ).bind(newId(12), n.userId, n.kind, n.actorId, n.postId ?? null, n.commentId ?? null, now).run();
}

async function unreadFor(env: Env, userId: string) {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').bind(userId).first<{ n: number }>();
  return r?.n ?? 0;
}

export const notificationRoutes = new Hono<AppEnv>();

notificationRoutes.get('/v1/notifications', requireAuth, async (c) => {
  const me = c.get('user');
  const limit = limitOf(c.req.query('limit'));
  const cur = decodeCursor(c.req.query('cursor'));
  const where = ['n.user_id = ?'];
  const args: (string | number)[] = [me.id];
  if (cur) { where.push('(n.created_at < ? OR (n.created_at = ? AND n.id < ?))'); args.push(cur.at, cur.at, cur.id); }
  const rows = (await c.env.DB.prepare(
    `SELECT n.id, n.kind, n.actor_id, n.post_id, n.comment_id, n.count, n.created_at, n.read_at,
      (SELECT CASE WHEN kind = 'video' THEN poster_key ELSE r2_key END FROM media WHERE post_id = n.post_id ORDER BY position LIMIT 1) AS thumb_key,
      (SELECT body FROM comments WHERE id = n.comment_id) AS preview
     FROM notifications n WHERE ${where.join(' AND ')} ORDER BY n.created_at DESC, n.id DESC LIMIT ?`,
  ).bind(...args, limit + 1).all<Row>()).results;
  const more = rows.length > limit;
  const slice = rows.slice(0, limit);
  const actorIds = [...new Set(slice.map((r) => r.actor_id))];
  const actors = actorIds.length
    ? (await c.env.DB.prepare(`SELECT * FROM users WHERE id IN (${actorIds.map(() => '?').join(',')})`).bind(...actorIds).all<UserRow>()).results
    : [];
  const byId = new Map(actors.map((u) => [u.id, userJson(u)]));
  const origin = originOf(c);
  return c.json({
    notifications: slice.map((r) => ({
      id: r.id,
      kind: r.kind,
      actor: byId.get(r.actor_id)!,
      count: r.count,
      postId: r.post_id,
      thumbUrl: r.thumb_key ? `${origin}/media/${r.thumb_key}` : null,
      commentId: r.comment_id,
      preview: r.preview,
      createdAt: iso(r.created_at),
      read: r.read_at !== null,
    })),
    cursor: more ? encodeCursor({ id: slice[slice.length - 1].id, created_at: slice[slice.length - 1].created_at } as PostRow) : null,
    unread: await unreadFor(c.env, me.id),
  });
});

notificationRoutes.get('/v1/notifications/unread-count', requireAuth, async (c) => {
  return c.json({ unread: await unreadFor(c.env, c.get('user').id) });
});

notificationRoutes.post('/v1/notifications/read', requireAuth, async (c) => {
  const me = c.get('user');
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string').slice(0, 100) : null;
  const now = Date.now();
  if (ids) {
    if (ids.length) {
      await c.env.DB.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${ids.map(() => '?').join(',')})`).bind(now, me.id, ...ids).run();
    }
  } else {
    await c.env.DB.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').bind(now, me.id).run();
  }
  return c.json({ ok: true, unread: await unreadFor(c.env, me.id) });
});
