import { Hono } from 'hono';
import type { AppEnv, UserRow } from './env';
import { requireAuth, requireHandle } from './auth';
import { fail, readJson } from './http';
import { newId } from './crypto';
import { feedFilter, viewerOf } from './viewer';
import { indexPostStatement } from './search';
import { decodeCursor, encodeCursor, loadPosts, userJson, usersJson, type PostRow } from './serialize';

const PAGE = 24;

function pageLimit(raw: string | undefined) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 50) : PAGE;
}

export async function pagePosts(c: Parameters<typeof loadPosts>[0], opts: { userId?: string; cursor?: string; limit?: number; viewerId?: string | null; mode?: 'all' | 'following' }) {
  const limit = opts.limit ?? PAGE;
  const cur = decodeCursor(opts.cursor);
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.userId) { where.push('user_id = ?'); args.push(opts.userId); }
  const filter = feedFilter(opts.viewerId ?? null, opts.mode ?? 'all');
  where.push(...filter.where);
  args.push(...filter.args);
  if (cur) { where.push('(created_at < ? OR (created_at = ? AND id < ?))'); args.push(cur.at, cur.at, cur.id); }
  const sql = `SELECT * FROM posts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC, id DESC LIMIT ?`;
  const rows = (await c.env.DB.prepare(sql).bind(...args, limit + 1).all<PostRow>()).results;
  const more = rows.length > limit;
  const slice = rows.slice(0, limit);
  return { posts: await loadPosts(c, slice), cursor: more ? encodeCursor(slice[slice.length - 1]) : null };
}

export const postRoutes = new Hono<AppEnv>();

postRoutes.post('/v1/posts', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const body = await readJson(c);
  const ids = Array.isArray(body.mediaIds) ? body.mediaIds : null;
  if (!ids || ids.length < 1 || ids.length > 10 || !ids.every((x) => typeof x === 'string')) {
    throw fail(400, 'bad_media', 'Attach 1 to 10 uploaded files.');
  }
  const mediaIds = [...new Set(ids as string[])];
  const caption = body.caption === undefined ? '' : body.caption;
  if (typeof caption !== 'string' || caption.length > 2200) throw fail(400, 'bad_caption', 'Captions can be up to 2200 characters.');

  const altsIn = body.alt === undefined ? {} : body.alt;
  if (!altsIn || typeof altsIn !== 'object' || Array.isArray(altsIn)) throw fail(400, 'bad_alt', 'Alt text goes in an object keyed by media id.');
  const alts = new Map<string, string>();
  for (const [k, v] of Object.entries(altsIn as Record<string, unknown>)) {
    if (!mediaIds.includes(k) || typeof v !== 'string' || v.length > 1000) throw fail(400, 'bad_alt', 'Alt text can be up to 1000 characters, for a file in this post.');
    alts.set(k, v.trim());
  }

  const ph = mediaIds.map(() => '?').join(',');
  const found = await c.env.DB.prepare(
    `SELECT id FROM media WHERE id IN (${ph}) AND user_id = ? AND status = 'done' AND post_id IS NULL`,
  ).bind(...mediaIds, me.id).all<{ id: string }>();
  if (found.results.length !== mediaIds.length) throw fail(400, 'bad_media', 'Each file must be one of your finished uploads that is not in a post yet.');

  const now = Date.now();
  let createdAt = now;
  if (body.createdAt !== undefined) {
    const t = typeof body.createdAt === 'string' ? Date.parse(body.createdAt) : NaN;
    if (!Number.isFinite(t) || t > now || t < Date.UTC(2000, 0, 1)) throw fail(400, 'bad_date', 'createdAt must be an ISO date in the past.');
    createdAt = t;
  }
  const id = newId(10);
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO posts (id, user_id, caption, created_at) VALUES (?, ?, ?, ?)').bind(id, me.id, caption.trim(), createdAt),
    ...mediaIds.map((m, i) => c.env.DB.prepare('UPDATE media SET post_id = ?, position = ?, alt = ? WHERE id = ?').bind(id, i, alts.get(m) ?? '', m)),
    indexPostStatement(c.env.DB, id, caption.trim(), mediaIds.map((m) => alts.get(m) ?? '')),
  ]);
  const row = (await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<PostRow>())!;
  return c.json({ post: (await loadPosts(c, [row]))[0] }, 201);
});

postRoutes.get('/v1/posts/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(c.req.param('id')).first<PostRow>();
  if (!row) throw fail(404, 'not_found', 'No such post.');
  return c.json({ post: (await loadPosts(c, [row]))[0] });
});

postRoutes.delete('/v1/posts/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<PostRow>();
  if (!row) throw fail(404, 'not_found', 'No such post.');
  if (row.user_id !== c.get('user').id) throw fail(403, 'forbidden', 'Only the author can delete this post.');
  const keys = (await c.env.DB.prepare('SELECT r2_key FROM media WHERE post_id = ?').bind(id).all<{ r2_key: string }>()).results.map((r) => r.r2_key);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM media WHERE post_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id),
  ]);
  if (keys.length) await c.env.MEDIA.delete(keys);
  return c.json({ ok: true });
});

postRoutes.get('/v1/users/:handle', async (c) => {
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE handle = ?').bind(c.req.param('handle').toLowerCase()).first<UserRow>();
  if (!user) throw fail(404, 'not_found', 'No such user.');
  const viewer = await viewerOf(c);
  if (viewer && viewer.id !== user.id) {
    const blockedMe = await c.env.DB.prepare('SELECT 1 AS x FROM blocks WHERE blocker_id = ? AND blocked_id = ?').bind(user.id, viewer.id).first();
    if (blockedMe) throw fail(404, 'not_found', 'No such user.');
  }
  const page = await pagePosts(c, { userId: user.id, cursor: c.req.query('cursor'), limit: pageLimit(c.req.query('limit')) });
  return c.json({ user: (await usersJson(c, [user]))[0], ...page });
});

postRoutes.get('/v1/feed', async (c) => {
  const mode = c.req.query('mode') ?? 'all';
  if (mode !== 'all' && mode !== 'following') throw fail(400, 'bad_mode', 'Mode must be all or following.');
  const viewer = await viewerOf(c);
  if (mode === 'following' && !viewer) throw fail(401, 'unauthorized', 'Sign in first.');
  return c.json(await pagePosts(c, { cursor: c.req.query('cursor'), limit: pageLimit(c.req.query('limit')), viewerId: viewer?.id, mode }));
});
