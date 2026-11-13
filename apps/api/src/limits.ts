import type { MiddlewareHandler } from 'hono';
import type { AppEnv, Env } from './env';
import { fail } from './http';
import { sha256Hex } from './crypto';

const DAY = 86_400_000;
const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SIGNIN_PATHS = new Set(['/v1/auth/start', '/oauth/register']);

const num = (raw: string | undefined, fallback: number) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
export const postsPerDay = (env: Env) => num(env.POSTS_PER_DAY, 5);
export const uploadsPerDay = (env: Env) => num(env.UPLOADS_PER_DAY, 300);
export const signinEmailsPerDay = (env: Env) => num(env.SIGNIN_EMAILS_PER_DAY, 20000);

// Only internet traffic carries CF-Connecting-IP (Cloudflare sets it); internal import calls skip these limits.
export const writeLimits: MiddlewareHandler<AppEnv> = async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP');
  if (!ip || !WRITE.has(c.req.method)) return next();
  if (SIGNIN_PATHS.has(c.req.path) && c.env.SIGNIN_LIMIT) {
    const { success } = await c.env.SIGNIN_LIMIT.limit({ key: ip });
    if (!success) throw fail(429, 'slow_down', 'Too many tries from this network. Wait a minute and try again.');
  }
  if (c.env.WRITE_LIMIT) {
    const auth = c.req.header('Authorization') ?? '';
    const key = auth.startsWith('Bearer ') ? `t:${(await sha256Hex(auth.slice(7).trim())).slice(0, 32)}` : `ip:${ip}`;
    const { success } = await c.env.WRITE_LIMIT.limit({ key });
    if (!success) throw fail(429, 'slow_down', 'You are going fast. Wait a minute and try again.');
  }
  await next();
};

async function count(env: Env, sql: string, ...args: unknown[]) {
  return (await env.DB.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? 0;
}

export async function capDailyUploads(env: Env, userId: string) {
  const n = await count(env, 'SELECT COUNT(*) AS n FROM media WHERE user_id = ? AND created_at > ?', userId, Date.now() - DAY);
  if (n >= uploadsPerDay(env)) throw fail(429, 'daily_uploads', 'You have uploaded a lot today. Try again tomorrow.');
}

// Backdated posts (bringing your history over) sort below today's feed, so only posts dated within the last day count.
export async function capDailyPosts(env: Env, userId: string, createdAt: number) {
  const since = Date.now() - DAY;
  if (createdAt <= since) return;
  const n = await count(env, 'SELECT COUNT(*) AS n FROM posts WHERE user_id = ? AND created_at > ?', userId, since);
  const cap = postsPerDay(env);
  if (n >= cap) throw fail(429, 'daily_posts', `You can share ${cap} posts a day. Try again tomorrow.`);
}

export async function capSigninEmails(env: Env) {
  const n = await count(env, 'SELECT COUNT(*) AS n FROM login_codes WHERE created_at > ?', Date.now() - DAY);
  if (n >= signinEmailsPerDay(env)) throw fail(503, 'busy', 'Sign-in is very busy right now. Try again in a little while.');
}
