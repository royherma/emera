import { Hono } from 'hono';
import type { AppEnv, UserRow } from './env';
import { fail } from './http';
import { loadPosts, usersJson, type PostRow } from './serialize';

const LIMIT = 20;

export function ftsQuery(raw: string): string | null {
  const tokens = raw.match(/[\p{L}\p{N}]+/gu)?.slice(0, 6) ?? [];
  return tokens.length ? tokens.map((t) => `"${t}"*`).join(' ') : null;
}

export function indexPostStatement(db: D1Database, postId: string, caption: string, alts: string[]) {
  return db.prepare('INSERT INTO posts_fts (post_id, caption, alt) VALUES (?, ?, ?)').bind(postId, caption, alts.filter(Boolean).join(' '));
}

export const searchRoutes = new Hono<AppEnv>();

searchRoutes.get('/v1/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  if (!q || q.length > 100) throw fail(400, 'bad_query', 'Type 1 to 100 characters to search.');
  const type = c.req.query('type') ?? 'people';
  if (type !== 'people' && type !== 'posts') throw fail(400, 'bad_type', 'Search for people or posts.');
  const offset = Math.max(0, Number.parseInt(c.req.query('cursor') ?? '0', 10) || 0);
  const match = ftsQuery(q);
  const next = (n: number) => (n > LIMIT ? String(offset + LIMIT) : null);

  if (type === 'people') {
    if (!match) return c.json({ users: [], cursor: null });
    const rows = (await c.env.DB.prepare(
      `SELECT u.* FROM users_fts f JOIN users u ON u.rowid = f.rowid
       WHERE users_fts MATCH ? AND u.handle IS NOT NULL
       ORDER BY bm25(users_fts, 10.0, 6.0, 1.0), u.created_at DESC LIMIT ? OFFSET ?`,
    ).bind(match, LIMIT + 1, offset).all<UserRow>()).results;
    return c.json({ users: await usersJson(c, rows.slice(0, LIMIT)), cursor: next(rows.length) });
  }

  if (!match) return c.json({ posts: [], cursor: null });
  const rows = (await c.env.DB.prepare(
    `SELECT p.* FROM posts_fts f JOIN posts p ON p.id = f.post_id
     WHERE posts_fts MATCH ?
     ORDER BY bm25(posts_fts, 0.0, 5.0, 2.0), p.created_at DESC LIMIT ? OFFSET ?`,
  ).bind(match, LIMIT + 1, offset).all<PostRow>()).results;
  return c.json({ posts: await loadPosts(c, rows.slice(0, LIMIT)), cursor: next(rows.length) });
});
