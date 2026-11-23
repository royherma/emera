import { Hono, type MiddlewareHandler } from 'hono';
import type { AppEnv } from './env';
import { requireAuth } from './auth';
import { fail, originOf, readJson } from './http';
import { newId } from './crypto';
import { sendReportToTeam } from './mail';

type ReportRow = { id: string; post_id: string; copy_url: string; note: string; status: string; created_at: number; updated_at?: number | null; thumb_key?: string | null; handle?: string | null };

export const REPORT_STATUSES = ['sent', 'filing', 'taken_down', 'not_removed'] as const;
const statusOf = (s: string) => (s === 'new' ? 'sent' : s);

const reportJson = (r: ReportRow, origin = '') => ({
  id: r.id, postId: r.post_id, url: r.copy_url, note: r.note, status: statusOf(r.status),
  createdAt: r.created_at, updatedAt: r.updated_at ?? r.created_at,
  thumbUrl: r.thumb_key ? `${origin}/media/${r.thumb_key}` : null,
  ...(r.handle ? { reporter: r.handle } : {}),
});

const REPORT_SELECT = `SELECT r.id, r.post_id, r.copy_url, r.note, r.status, r.created_at, r.updated_at, u.handle,
  (SELECT COALESCE(m.poster_key, m.r2_key) FROM media m WHERE m.post_id = r.post_id ORDER BY m.position LIMIT 1) AS thumb_key
  FROM reports r JOIN users u ON u.id = r.reporter_user_id`;

function parseHttpUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (s.length < 1 || s.length > 2048) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : null;
  } catch {
    return null;
  }
}

export const reportRoutes = new Hono<AppEnv>();

reportRoutes.post('/v1/reports', requireAuth, async (c) => {
  const me = c.get('user');
  const body = await readJson(c);
  const postId = typeof body.postId === 'string' ? body.postId.trim() : '';
  if (!postId || postId.length > 64) throw fail(400, 'bad_post', 'Say which post was copied.');
  const url = parseHttpUrl(body.url);
  if (!url) throw fail(400, 'bad_url', 'Paste the web address (http or https) where you found the copy.');
  const note = body.note === undefined || body.note === null ? '' : body.note;
  if (typeof note !== 'string' || note.length > 2000) throw fail(400, 'bad_note', 'Notes can be up to 2000 characters.');

  const post = await c.env.DB.prepare('SELECT id, user_id FROM posts WHERE id = ?').bind(postId).first<{ id: string; user_id: string }>();
  if (!post) throw fail(404, 'not_found', 'No such post.');
  if (post.user_id !== me.id) throw fail(403, 'forbidden', 'You can only report copies of your own posts.');

  const id = newId(10);
  const trimmed = note.trim();
  await c.env.DB.prepare('INSERT INTO reports (id, post_id, reporter_user_id, copy_url, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, postId, me.id, url, trimmed, Date.now()).run();
  try {
    await sendReportToTeam(c.env, { id, postId, url, note: trimmed, reporter: me.handle ?? me.email });
  } catch (e) {
    console.error('[reports] team email failed', e);
  }
  return c.json({ report: { id, status: 'sent' } }, 201);
});

reportRoutes.get('/v1/reports', requireAuth, async (c) => {
  const rows = (await c.env.DB.prepare(`${REPORT_SELECT} WHERE r.reporter_user_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 100`)
    .bind(c.get('user').id).all<ReportRow>()).results;
  return c.json({ reports: rows.map((r) => reportJson(r, originOf(c))) });
});

const requireMod: MiddlewareHandler<AppEnv> = async (c, next) => {
  const role = c.get('user').role;
  if (role !== 'admin' && role !== 'mod') throw fail(403, 'forbidden', 'Only moderators can do that.');
  await next();
};

reportRoutes.get('/v1/mod/reports', requireAuth, requireMod, async (c) => {
  const rows = (await c.env.DB.prepare(`${REPORT_SELECT} ORDER BY r.created_at DESC, r.id DESC LIMIT 100`).all<ReportRow>()).results;
  return c.json({ reports: rows.map((r) => reportJson(r, originOf(c))) });
});

reportRoutes.patch('/v1/mod/reports/:id', requireAuth, requireMod, async (c) => {
  const body = await readJson(c);
  const status = body.status;
  if (typeof status !== 'string' || !(REPORT_STATUSES as readonly string[]).includes(status)) throw fail(400, 'bad_status', 'Status must be sent, filing, taken_down or not_removed.');
  const done = await c.env.DB.prepare('UPDATE reports SET status = ?, updated_at = ? WHERE id = ?').bind(status, Date.now(), c.req.param('id')).run();
  if (!done.meta.changes) throw fail(404, 'not_found', 'No such report.');
  const row = await c.env.DB.prepare(`${REPORT_SELECT} WHERE r.id = ?`).bind(c.req.param('id')).first<ReportRow>();
  return c.json({ report: reportJson(row!, originOf(c)) });
});
