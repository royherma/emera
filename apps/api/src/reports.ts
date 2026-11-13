import { Hono } from 'hono';
import type { AppEnv } from './env';
import { requireAuth } from './auth';
import { fail, readJson } from './http';
import { newId } from './crypto';
import { sendReportToTeam } from './mail';

type ReportRow = { id: string; post_id: string; copy_url: string; note: string; status: string; created_at: number };

const reportJson = (r: ReportRow) => ({ id: r.id, postId: r.post_id, url: r.copy_url, note: r.note, status: r.status, createdAt: r.created_at });

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
  return c.json({ report: { id, status: 'new' } }, 201);
});

reportRoutes.get('/v1/reports', requireAuth, async (c) => {
  const rows = (await c.env.DB.prepare(
    'SELECT id, post_id, copy_url, note, status, created_at FROM reports WHERE reporter_user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100',
  ).bind(c.get('user').id).all<ReportRow>()).results;
  return c.json({ reports: rows.map(reportJson) });
});
