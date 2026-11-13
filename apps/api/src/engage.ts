import { Hono } from 'hono';
import type { AppEnv, UserRow } from './env';
import { requireAuth, requireHandle } from './auth';
import { fail, readJson } from './http';
import { newId } from './crypto';
import { decodeCursor, encodeCursor, iso, userJson, type PostRow } from './serialize';
import { notify } from './notifications';

const COMMENT_MAX = 500;
const COMMENTS_PER_MINUTE = 10;
const PAGE = 20;
const REPLY_CAP = 200;

type CommentRow = { id: string; post_id: string; user_id: string; parent_id: string | null; body: string; created_at: number };

async function postRow(c: { env: AppEnv['Bindings'] }, id: string) {
  const row = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<PostRow>();
  if (!row) throw fail(404, 'not_found', 'No such post.');
  return row;
}

async function likeTotal(c: { env: AppEnv['Bindings'] }, postId: string) {
  const r = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM likes WHERE post_id = ?').bind(postId).first<{ n: number }>();
  return r?.n ?? 0;
}

async function authorsOf(c: { env: AppEnv['Bindings'] }, rows: CommentRow[]) {
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (!ids.length) return new Map<string, ReturnType<typeof userJson>>();
  const users = (await c.env.DB.prepare(`SELECT * FROM users WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<UserRow>()).results;
  return new Map(users.map((u) => [u.id, userJson(u)]));
}

const commentJson = (r: CommentRow, authors: Map<string, ReturnType<typeof userJson>>) => ({
  id: r.id,
  postId: r.post_id,
  parentId: r.parent_id,
  author: authors.get(r.user_id)!,
  body: r.body,
  createdAt: iso(r.created_at),
});

export const engageRoutes = new Hono<AppEnv>();

engageRoutes.post('/v1/posts/:id/like', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const post = await postRow(c, c.req.param('id'));
  const res = await c.env.DB.prepare('INSERT OR IGNORE INTO likes (post_id, user_id, created_at) VALUES (?, ?, ?)').bind(post.id, me.id, Date.now()).run();
  if (res.meta.changes > 0) await notify(c.env, { userId: post.user_id, kind: 'like', actorId: me.id, postId: post.id });
  return c.json({ liked: true, likeCount: await likeTotal(c, post.id) });
});

engageRoutes.delete('/v1/posts/:id/like', requireAuth, async (c) => {
  const post = await postRow(c, c.req.param('id'));
  await c.env.DB.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').bind(post.id, c.get('user').id).run();
  return c.json({ liked: false, likeCount: await likeTotal(c, post.id) });
});

engageRoutes.get('/v1/posts/:id/comments', async (c) => {
  const post = await postRow(c, c.req.param('id'));
  const raw = Number(c.req.query('limit'));
  const limit = Number.isInteger(raw) && raw > 0 ? Math.min(raw, 50) : PAGE;
  const cur = decodeCursor(c.req.query('cursor'));
  const where = ['post_id = ?', 'parent_id IS NULL'];
  const args: (string | number)[] = [post.id];
  if (cur) { where.push('(created_at > ? OR (created_at = ? AND id > ?))'); args.push(cur.at, cur.at, cur.id); }
  const rows = (await c.env.DB.prepare(`SELECT * FROM comments WHERE ${where.join(' AND ')} ORDER BY created_at ASC, id ASC LIMIT ?`).bind(...args, limit + 1).all<CommentRow>()).results;
  const more = rows.length > limit;
  const top = rows.slice(0, limit);
  const replies = top.length
    ? (await c.env.DB.prepare(
        `SELECT * FROM comments WHERE parent_id IN (${top.map(() => '?').join(',')}) ORDER BY created_at ASC, id ASC LIMIT ?`,
      ).bind(...top.map((t) => t.id), REPLY_CAP).all<CommentRow>()).results
    : [];
  const authors = await authorsOf(c, [...top, ...replies]);
  const byParent = new Map<string, ReturnType<typeof commentJson>[]>();
  for (const r of replies) {
    const list = byParent.get(r.parent_id!) ?? [];
    list.push(commentJson(r, authors));
    byParent.set(r.parent_id!, list);
  }
  const total = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM comments WHERE post_id = ?').bind(post.id).first<{ n: number }>();
  return c.json({
    comments: top.map((r) => ({ ...commentJson(r, authors), replies: byParent.get(r.id) ?? [] })),
    cursor: more ? encodeCursor({ id: top[top.length - 1].id, created_at: top[top.length - 1].created_at } as PostRow) : null,
    total: total?.n ?? 0,
  });
});

engageRoutes.post('/v1/posts/:id/comments', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const post = await postRow(c, c.req.param('id'));
  const body = await readJson(c);
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) throw fail(400, 'bad_comment', 'Write something first.');
  if (text.length > COMMENT_MAX) throw fail(400, 'comment_too_long', `Comments can be up to ${COMMENT_MAX} characters.`);

  let parent: CommentRow | null = null;
  if (body.parentId !== undefined && body.parentId !== null) {
    if (typeof body.parentId !== 'string') throw fail(400, 'bad_parent', 'That comment is not here.');
    parent = await c.env.DB.prepare('SELECT * FROM comments WHERE id = ? AND post_id = ?').bind(body.parentId, post.id).first<CommentRow>();
    if (!parent) throw fail(400, 'bad_parent', 'That comment is not here.');
    if (parent.parent_id) throw fail(400, 'bad_parent', 'Replies go under the first comment of a thread.');
  }

  const now = Date.now();
  const recent = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM comments WHERE user_id = ? AND created_at > ?').bind(me.id, now - 60_000).first<{ n: number }>();
  if ((recent?.n ?? 0) >= COMMENTS_PER_MINUTE) throw fail(429, 'slow_down', 'You are commenting fast. Wait a minute and try again.');

  const id = newId(10);
  await c.env.DB.prepare('INSERT INTO comments (id, post_id, user_id, parent_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, post.id, me.id, parent?.id ?? null, text, now).run();
  if (parent) await notify(c.env, { userId: parent.user_id, kind: 'reply', actorId: me.id, postId: post.id, commentId: id });
  if (!parent || parent.user_id !== post.user_id) await notify(c.env, { userId: post.user_id, kind: 'comment', actorId: me.id, postId: post.id, commentId: id });

  const row: CommentRow = { id, post_id: post.id, user_id: me.id, parent_id: parent?.id ?? null, body: text, created_at: now };
  return c.json({ comment: { ...commentJson(row, new Map([[me.id, userJson(me)]])), replies: [] } }, 201);
});

engageRoutes.delete('/v1/comments/:id', requireAuth, async (c) => {
  const me = c.get('user');
  const row = await c.env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(c.req.param('id')).first<CommentRow>();
  if (!row) throw fail(404, 'not_found', 'No such comment.');
  const post = await postRow(c, row.post_id);
  if (row.user_id !== me.id && post.user_id !== me.id) throw fail(403, 'forbidden', 'Only the commenter or the post author can delete this comment.');
  await c.env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(row.id).run();
  return c.json({ ok: true });
});
