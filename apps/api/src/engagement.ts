import type { Context } from 'hono';
import type { AppEnv } from './env';
import { sha256Hex } from './crypto';

export async function viewerId(c: Context<AppEnv>): Promise<string | null> {
  const set = c.get('user');
  if (set) return set.id;
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const row = await c.env.DB.prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await sha256Hex(token), Date.now()).first<{ user_id: string }>();
  return row?.user_id ?? null;
}

export async function loadEngagement(c: Context<AppEnv>, postIds: string[]) {
  const ph = postIds.map(() => '?').join(',');
  const me = await viewerId(c);
  const [likes, comments, mine, views] = await Promise.all([
    c.env.DB.prepare(`SELECT post_id, COUNT(*) AS n FROM likes WHERE post_id IN (${ph}) GROUP BY post_id`).bind(...postIds).all<{ post_id: string; n: number }>(),
    c.env.DB.prepare(`SELECT post_id, COUNT(*) AS n FROM comments WHERE post_id IN (${ph}) GROUP BY post_id`).bind(...postIds).all<{ post_id: string; n: number }>(),
    me
      ? c.env.DB.prepare(`SELECT post_id FROM likes WHERE user_id = ? AND post_id IN (${ph})`).bind(me, ...postIds).all<{ post_id: string }>()
      : Promise.resolve({ results: [] as { post_id: string }[] }),
    c.env.DB.prepare(`SELECT post_id, COUNT(*) AS n FROM post_views WHERE post_id IN (${ph}) GROUP BY post_id`).bind(...postIds).all<{ post_id: string; n: number }>(),
  ]);
  return {
    likeCount: new Map(likes.results.map((r) => [r.post_id, r.n])),
    commentCount: new Map(comments.results.map((r) => [r.post_id, r.n])),
    liked: new Set(mine.results.map((r) => r.post_id)),
    viewCount: new Map(views.results.map((r) => [r.post_id, r.n])),
  };
}
