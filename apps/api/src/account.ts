import { Hono } from 'hono';
import type { AppEnv, Env } from './env';
import { requireAuth } from './auth';

const MY_POSTS = '(SELECT id FROM posts WHERE user_id = ?1)';
const MY_THREADS = '(SELECT id FROM dm_threads WHERE created_by = ?1)';

// Ordered children-first: D1 enforces foreign keys.
const DELETE_STEPS = [
  `DELETE FROM notifications WHERE user_id = ?1 OR actor_id = ?1 OR post_id IN ${MY_POSTS}
     OR comment_id IN (SELECT id FROM comments WHERE user_id = ?1 OR post_id IN ${MY_POSTS})`,
  `DELETE FROM likes WHERE user_id = ?1 OR post_id IN ${MY_POSTS}`,
  `DELETE FROM post_views WHERE user_id = ?1 OR post_id IN ${MY_POSTS}`,
  `DELETE FROM fund_watch WHERE viewer_id = ?1 OR creator_id = ?1 OR post_id IN ${MY_POSTS}`,
  'DELETE FROM fund_shares WHERE creator_id = ?1',
  'DELETE FROM comments WHERE parent_id IN (SELECT id FROM comments WHERE user_id = ?1)',
  `DELETE FROM comments WHERE user_id = ?1 OR post_id IN ${MY_POSTS}`,
  `DELETE FROM posts_fts WHERE post_id IN ${MY_POSTS}`,
  'DELETE FROM imported_items WHERE user_id = ?1',
  `DELETE FROM dm_messages WHERE user_id = ?1 OR thread_id IN ${MY_THREADS}`,
  `DELETE FROM dm_members WHERE user_id = ?1 OR thread_id IN ${MY_THREADS}`,
  'DELETE FROM dm_threads WHERE created_by = ?1',
  'DELETE FROM channel_messages WHERE user_id = ?1',
  'DELETE FROM channel_reads WHERE user_id = ?1',
  'DELETE FROM channel_mods WHERE user_id = ?1',
  'DELETE FROM chat_settings WHERE user_id = ?1',
  'DELETE FROM sources WHERE user_id = ?1',
  'DELETE FROM oauth_codes WHERE user_id = ?1',
  'DELETE FROM oauth_refresh WHERE user_id = ?1',
  'DELETE FROM follows WHERE follower_id = ?1 OR followee_id = ?1',
  'DELETE FROM blocks WHERE blocker_id = ?1 OR blocked_id = ?1',
  'DELETE FROM mutes WHERE muter_id = ?1 OR muted_id = ?1',
  'DELETE FROM reports WHERE reporter_user_id = ?1',
  'DELETE FROM flags WHERE reporter_user_id = ?1',
  'UPDATE invites SET created_by = NULL WHERE created_by = ?1',
  `DELETE FROM media WHERE user_id = ?1 OR post_id IN ${MY_POSTS}`,
  'DELETE FROM posts WHERE user_id = ?1',
  'DELETE FROM sessions WHERE user_id = ?1',
  'DELETE FROM login_codes WHERE email = (SELECT email FROM users WHERE id = ?1)',
  'DELETE FROM users WHERE id = ?1',
];

export async function deleteAccount(env: Env, userId: string) {
  const rows = (await env.DB.prepare(`SELECT r2_key, poster_key, captions_key FROM media WHERE user_id = ?1 OR post_id IN ${MY_POSTS}`)
    .bind(userId).all<{ r2_key: string; poster_key: string | null; captions_key: string | null }>()).results;
  const keys = rows.flatMap((r) => [r.r2_key, r.poster_key, r.captions_key].filter((k): k is string => !!k));
  await env.DB.batch(DELETE_STEPS.map((sql) => env.DB.prepare(sql).bind(userId)));
  for (let i = 0; i < keys.length; i += 1000) await env.MEDIA.delete(keys.slice(i, i + 1000));
  return { files: keys.length };
}

export const accountRoutes = new Hono<AppEnv>();

accountRoutes.delete('/v1/me', requireAuth, async (c) => {
  await deleteAccount(c.env, c.get('user').id);
  return c.json({ ok: true });
});
