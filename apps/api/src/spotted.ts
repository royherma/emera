import { Hono, type Context } from 'hono';
import type { AppEnv } from './env';
import { requireAuth } from './auth';
import { BRAND } from './brand';
import { fail, originOf, readJson } from './http';
import { hmacHex, newId } from './crypto';
import { createReport, parseHttpUrl } from './reports';
import { viewerOf } from './viewer';

const HOUR = 3_600_000;
const DAY = 86_400_000;
const PER_POST_PER_HOUR = 1;
const PER_DAY = 20;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SpottedRow = {
  id: string; post_id: string; creator_id: string; url: string; reporter_email: string | null;
  status: string; report_id: string | null; created_at: number; updated_at: number | null; thumb_key?: string | null;
};

const log = (event: string, data: Record<string, unknown>) => console.log(`[spotted] ${event} ${JSON.stringify(data)}`);

function copyUrl(c: Context<AppEnv>, raw: unknown): string {
  const url = parseHttpUrl(raw);
  if (!url) throw fail(400, 'bad_url', 'Paste the web address (http or https) where you saw the copy.');
  const host = new URL(url).hostname.toLowerCase();
  const own = [BRAND.domain, new URL(c.env.PUBLIC_ORIGIN || originOf(c)).hostname.toLowerCase()];
  if (own.some((d) => host === d || host.endsWith(`.${d}`))) throw fail(400, 'bad_url', `That link is on ${BRAND.name}. Paste the address of the copy on another site.`);
  const u = new URL(url);
  u.hash = '';
  return u.toString();
}

export async function submitSpotted(c: Context<AppEnv>, postId: string, input: { url?: unknown; email?: unknown }) {
  const url = copyUrl(c, input.url);
  let email: string | null = null;
  if (input.email !== undefined && input.email !== null && String(input.email).trim() !== '') {
    email = String(input.email).trim();
    if (email.length > 254 || !EMAIL.test(email)) throw fail(400, 'bad_email', 'That email address does not look right.');
  }
  const post = await c.env.DB.prepare('SELECT id, user_id FROM posts WHERE id = ?').bind(postId).first<{ id: string; user_id: string }>();
  if (!post) throw fail(404, 'not_found', 'No such post.');

  const dup = await c.env.DB.prepare('SELECT id, status FROM spotted WHERE post_id = ? AND url = ?').bind(postId, url).first<{ id: string; status: string }>();
  if (dup) {
    log('duplicate', { id: dup.id, postId });
    return { spotted: { id: dup.id, status: dup.status }, duplicate: true };
  }

  const ipHash = await hmacHex(c.env.PROOF_SECRET || 'dev', `spotted:${c.req.header('CF-Connecting-IP') ?? 'local'}`);
  const now = Date.now();
  const n = async (sql: string, ...args: unknown[]) => (await c.env.DB.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? 0;
  if (await n('SELECT COUNT(*) AS n FROM spotted WHERE ip_hash = ? AND post_id = ? AND created_at > ?', ipHash, postId, now - HOUR) >= PER_POST_PER_HOUR) {
    log('rate_limited', { postId, window: 'post-hour' });
    throw fail(429, 'too_many', 'You already sent a copy for this post. Try again in an hour.');
  }
  if (await n('SELECT COUNT(*) AS n FROM spotted WHERE ip_hash = ? AND created_at > ?', ipHash, now - DAY) >= PER_DAY) {
    log('rate_limited', { postId, window: 'day' });
    throw fail(429, 'too_many', 'You sent a lot of copies today. Try again tomorrow.');
  }

  const viewer = await viewerOf(c);
  const id = newId(10);
  const ins = await c.env.DB.prepare(
    'INSERT OR IGNORE INTO spotted (id, post_id, creator_id, url, reporter_email, reporter_user_id, ip_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, postId, post.user_id, url, email, viewer?.id ?? null, ipHash, 'new', now).run();
  if (!ins.meta.changes) return { spotted: { id, status: 'new' }, duplicate: true };
  await c.env.DB.prepare('INSERT INTO notifications (id, user_id, kind, actor_id, post_id, count, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)')
    .bind(newId(12), post.user_id, 'spotted', post.user_id, postId, now).run();
  log('received', { id, postId, creatorId: post.user_id, signedIn: Boolean(viewer), hasEmail: Boolean(email) });
  return { spotted: { id, status: 'new' }, duplicate: false };
}

export const spottedRoutes = new Hono<AppEnv>();

spottedRoutes.post('/v1/posts/:id/spotted', async (c) => {
  const body = await readJson(c);
  const res = await submitSpotted(c, c.req.param('id'), body);
  return c.json(res, res.duplicate ? 200 : 201);
});

const SELECT = `SELECT s.id, s.post_id, s.creator_id, s.url, s.reporter_email, s.status, s.report_id, s.created_at, s.updated_at,
  (SELECT COALESCE(m.poster_key, m.r2_key) FROM media m WHERE m.post_id = s.post_id ORDER BY m.position LIMIT 1) AS thumb_key
  FROM spotted s`;

const json = (r: SpottedRow, origin: string) => ({
  id: r.id, postId: r.post_id, url: r.url, email: r.reporter_email, status: r.status, reportId: r.report_id,
  createdAt: r.created_at, updatedAt: r.updated_at ?? r.created_at,
  thumbUrl: r.thumb_key ? `${origin}/media/${r.thumb_key}` : null,
});

spottedRoutes.get('/v1/me/spotted', requireAuth, async (c) => {
  const rows = (await c.env.DB.prepare(`${SELECT} WHERE s.creator_id = ? ORDER BY s.created_at DESC, s.id DESC LIMIT 100`)
    .bind(c.get('user').id).all<SpottedRow>()).results;
  return c.json({ spotted: rows.map((r) => json(r, originOf(c))) });
});

spottedRoutes.post('/v1/me/spotted/:id', requireAuth, async (c) => {
  const me = c.get('user');
  const body = await readJson(c);
  if (body.action !== 'file' && body.action !== 'dismiss') throw fail(400, 'bad_action', 'Action must be file or dismiss.');
  const row = await c.env.DB.prepare(`${SELECT} WHERE s.id = ?`).bind(c.req.param('id')).first<SpottedRow>();
  if (!row) throw fail(404, 'not_found', 'No such spotted copy.');
  if (row.creator_id !== me.id) throw fail(403, 'forbidden', 'Only the creator of the post can do that.');
  if (row.status !== 'new') throw fail(409, 'already_handled', `This one is already ${row.status}.`);
  const now = Date.now();
  let reportId: string | null = null;
  if (body.action === 'file') {
    reportId = await createReport(c.env, me, row.post_id, row.url, 'Spotted by a fan, confirmed by the creator.');
  }
  const status = body.action === 'file' ? 'filed' : 'dismissed';
  await c.env.DB.prepare("UPDATE spotted SET status = ?, report_id = ?, updated_at = ? WHERE id = ? AND status = 'new'").bind(status, reportId, now, row.id).run();
  log(status, { id: row.id, postId: row.post_id, by: me.id, reportId });
  return c.json({ spotted: json({ ...row, status, report_id: reportId, updated_at: now }, originOf(c)) });
});
