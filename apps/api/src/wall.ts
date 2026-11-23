import { Hono } from 'hono';
import type { AppEnv } from './env';
import { siteOrigin } from './http';

export const WALL_MIN = 6;

type WallRow = { handle: string; display_name: string; avatar_url: string; posts: number };

export const wallRoutes = new Hono<AppEnv>();

wallRoutes.get('/v1/wall', async (c) => {
  const rows = (await c.env.DB.prepare(
    `SELECT u.handle, u.display_name, u.avatar_url, COUNT(p.id) AS posts
     FROM users u JOIN posts p ON p.user_id = u.id
     WHERE u.handle IS NOT NULL AND u.avatar_url IS NOT NULL AND u.on_wall = 1 AND u.email NOT LIKE '%@example.com' AND u.handle NOT IN ('review') AND u.handle NOT LIKE 'e2e%'
     GROUP BY u.id ORDER BY MAX(p.created_at) DESC LIMIT 60`,
  ).all<WallRow>()).results;
  const origin = siteOrigin(c);
  const creators = rows.map((r) => ({ handle: r.handle, name: r.display_name || r.handle, avatarUrl: r.avatar_url, posts: r.posts, url: `${origin}/@${r.handle}` }));
  return c.json({ count: creators.length, show: creators.length >= WALL_MIN, creators }, 200, { 'Cache-Control': 'public, max-age=300' });
});
