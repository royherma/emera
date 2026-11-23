import { Hono } from 'hono';
import type { AppEnv, Env } from './env';
import { requireAuth } from './auth';
import { fail, readJson } from './http';
import { newId } from './crypto';
import { BRAND } from './brand';
import { esc } from './pages';
import { notFoundPage } from './pages';
import { fundAdmin } from './fund';
import { postResend } from './mail';

const DAY = 86_400_000;
const CHECK_WINDOW_DAYS = 30;
const CHECK_EVERY_MS = 20 * 3_600_000;
const CHECK_BATCH = 25;
const CHECK_UA = 'EmeraTakedownCheck/1.0 (+https://emera.social)';
export const DESK_FROM = 'Emera Takedowns <takedowns@emera.social>';
export const DESK_EMAIL = 'takedowns@emera.social';

export const AUTH_VERSION = '2026-11-23.1';
export const AUTH_TEXT = [
  'I have a good faith belief that the use of my work at the web addresses I report is not authorized by me, my agent, or the law.',
  'The information I give in each notice is accurate.',
  'Under penalty of perjury, I am the owner of the work, or I am authorized to act on behalf of the owner of the exclusive right that is allegedly infringed.',
  'I authorize Emera to send copyright notices for me, as my agent, about the copies I confirm.',
].join('\n');

export type Method = 'form' | 'email';
export type Recipient = { site: string; method: Method; target: string | null; note: string };

const FORMS: Record<string, string> = {
  'instagram.com': 'https://help.instagram.com/contact/552695131608132',
  'facebook.com': 'https://www.facebook.com/help/contact/634636770043106',
  'tiktok.com': 'https://www.tiktok.com/legal/report/Copyright',
  'youtube.com': 'https://www.youtube.com/copyright_complaint_form',
  'youtu.be': 'https://www.youtube.com/copyright_complaint_form',
  'pinterest.com': 'https://help.pinterest.com/en/contact?contact=copyright',
  'etsy.com': 'https://www.etsy.com/ipreporting',
  'redbubble.com': 'https://help.redbubble.com/hc/en-us/requests/new?ticket_form_id=360000012491',
  'amazon.com': 'https://www.amazon.com/report/infringement',
  'x.com': 'https://help.x.com/en/forms/ipi/copyright',
  'twitter.com': 'https://help.x.com/en/forms/ipi/copyright',
  'reddit.com': 'https://www.reddit.com/report',
};

const TWO_PART = new Set(['co.uk', 'org.uk', 'com.au', 'co.nz', 'co.jp', 'com.br', 'co.in', 'com.sg', 'co.za', 'com.mx', 'com.tr']);

export const hostOf = (raw: string) => {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

export function registrable(host: string): string {
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const last2 = parts.slice(-2).join('.');
  return TWO_PART.has(last2) ? parts.slice(-3).join('.') : last2;
}

function abuseEmail(node: any, depth = 0): string | null {
  if (!node || depth > 4) return null;
  const roles: unknown[] = Array.isArray(node.roles) ? node.roles : [];
  if (roles.includes('abuse')) {
    const props: unknown[] = Array.isArray(node.vcardArray?.[1]) ? node.vcardArray[1] : [];
    for (const p of props) {
      if (Array.isArray(p) && p[0] === 'email' && typeof p[3] === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p[3])) return p[3];
    }
  }
  for (const child of Array.isArray(node.entities) ? node.entities : []) {
    const found = abuseEmail(child, depth + 1);
    if (found) return found;
  }
  return null;
}

export async function recipientFor(copyUrl: string): Promise<Recipient> {
  const host = hostOf(copyUrl);
  const known = Object.keys(FORMS).find((k) => host === k || host.endsWith(`.${k}`));
  if (known) return { site: known, method: 'form', target: FORMS[known], note: `Fill the ${known} copyright form with the notice text.` };
  const domain = registrable(host);
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { headers: { Accept: 'application/rdap+json', 'User-Agent': CHECK_UA }, redirect: 'follow' });
    if (res.ok) {
      const json: any = await res.json();
      const mail = abuseEmail(json);
      if (mail) return { site: domain, method: 'email', target: mail, note: `Abuse contact from RDAP for ${domain}.` };
    }
  } catch (e) {
    console.error('[takedown] rdap failed', domain, e);
  }
  return { site: domain || host, method: 'form', target: null, note: `No abuse contact found for ${domain}. The desk looks for the host's copyright page and files by hand.` };
}

const dayText = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function buildNotice(i: {
  originalUrl: string;
  uploadedAt: number;
  signedBy: string | null;
  infringingUrl: string;
  signerName: string;
  creatorHandle: string;
  signedAt: number;
}): string {
  return [
    'Notice of copyright infringement (DMCA, 17 U.S.C. 512(c)(3))',
    '',
    'To the designated copyright agent:',
    '',
    '1. The copyrighted work',
    `The original work was first published on Emera at ${i.originalUrl} on ${dayText(i.uploadedAt)} (UTC)${i.signedBy ? `, with a signed proof of origin from Emera for @${i.signedBy}` : ''}. The page shows the original, the author and the upload date.`,
    '',
    '2. The infringing material',
    `${i.infringingUrl}`,
    'It reproduces the work above without authorization. Please remove it or disable access to it.',
    '',
    '3. Statements',
    ...AUTH_TEXT.split('\n').map((s) => `- ${s}`),
    '',
    '4. Contact',
    `Emera, authorized agent of ${i.signerName} (@${i.creatorHandle} on Emera). Email ${DESK_EMAIL}.`,
    '',
    '5. Electronic signature',
    `/${i.signerName}/`,
    `Signed ${new Date(i.signedAt).toISOString()}`,
  ].join('\n');
}

type ReportRow = { id: string; post_id: string; reporter_user_id: string; copy_url: string };
type TakedownRow = {
  id: string; report_id: string; user_id: string; post_id: string; copy_url: string; site: string; method: Method; target: string | null;
  recipient_note: string; notice: string; signer_name: string; auth_version: string; status: string; reject_reason: string | null;
  created_at: number; ready_at: number | null; sent_at: number | null; sent_via: string | null; removed_at: number | null;
  last_check_at: number | null; last_http: number | null; check_reason: string | null; image_ref: string | null; checks: number;
};

const originOf = (env: Env) => (env.PUBLIC_ORIGIN || 'https://emera.social').replace(/\/$/, '');
const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : null);
const daysBetween = (a: number, b: number) => Math.max(0, Math.round((b - a) / DAY));

function takedownJson(env: Env, r: TakedownRow) {
  const removed = r.status === 'removed' && r.removed_at;
  return {
    id: r.id, reportId: r.report_id, postId: r.post_id, url: r.copy_url, site: r.site, method: r.method, status: r.status,
    rejectReason: r.reject_reason, createdAt: iso(r.created_at), sentAt: iso(r.sent_at), removedAt: iso(r.removed_at),
    daysToRemoval: removed ? daysBetween(r.created_at, r.removed_at!) : null,
    lastCheck: r.last_check_at ? { at: iso(r.last_check_at), http: r.last_http, reason: r.check_reason } : null,
    receiptUrl: removed ? `${originOf(env)}/takedown/${r.id}` : null,
  };
}

async function authFor(env: Env, userId: string) {
  return env.DB.prepare('SELECT full_name, signed_at FROM takedown_authorizations WHERE user_id = ? AND text_version = ?')
    .bind(userId, AUTH_VERSION).first<{ full_name: string; signed_at: number }>();
}

function checkName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (name.length < 3 || name.length > 120 || !name.includes(' ')) throw fail(400, 'bad_name', 'Type your full name as your signature.');
  return name;
}

async function saveAuthorization(c: { env: Env; req: { header(n: string): string | undefined } }, userId: string, input: Record<string, unknown>) {
  if (input.agree !== true) throw fail(400, 'not_agreed', 'Tick the box to confirm the statements.');
  if (input.version !== AUTH_VERSION) throw fail(409, 'text_changed', 'The statement was updated. Read it again.');
  const name = checkName(input.name);
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO takedown_authorizations (user_id, text_version, full_name, text, country, signed_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, text_version) DO UPDATE SET full_name = excluded.full_name, text = excluded.text, country = excluded.country, signed_at = excluded.signed_at`,
  ).bind(userId, AUTH_VERSION, name, AUTH_TEXT, c.req.header('CF-IPCountry') ?? null, now).run();
  return { full_name: name, signed_at: now };
}

async function ownReport(env: Env, id: string, userId: string) {
  const r = await env.DB.prepare('SELECT id, post_id, reporter_user_id, copy_url FROM reports WHERE id = ?').bind(id).first<ReportRow>();
  if (!r || r.reporter_user_id !== userId) throw fail(404, 'not_found', 'No such report.');
  return r;
}

async function noticeFor(env: Env, report: ReportRow, signerName: string, signedAt: number, handle: string) {
  const post = await env.DB.prepare('SELECT id, created_at FROM posts WHERE id = ?').bind(report.post_id).first<{ id: string; created_at: number }>();
  if (!post) throw fail(404, 'not_found', 'The original post is gone.');
  const proof = await env.DB.prepare('SELECT signer, signed_at FROM media WHERE post_id = ? AND signed_at IS NOT NULL ORDER BY signed_at LIMIT 1').bind(post.id).first<{ signer: string | null; signed_at: number }>();
  return buildNotice({
    originalUrl: `${originOf(env)}/p/${post.id}`,
    uploadedAt: proof?.signed_at ?? post.created_at,
    signedBy: proof?.signer ?? null,
    infringingUrl: report.copy_url,
    signerName,
    creatorHandle: handle,
    signedAt,
  });
}

export const takedownRoutes = new Hono<AppEnv>();

takedownRoutes.post('/v1/protect/authorize', requireAuth, async (c) => {
  const saved = await saveAuthorization(c, c.get('user').id, await readJson(c));
  return c.json({ authorization: { version: AUTH_VERSION, name: saved.full_name, signedAt: iso(saved.signed_at) } }, 201);
});

takedownRoutes.get('/v1/reports/:id/takedown', requireAuth, async (c) => {
  const me = c.get('user');
  const report = await ownReport(c.env, c.req.param('id'), me.id);
  const existing = await c.env.DB.prepare('SELECT * FROM takedowns WHERE report_id = ?').bind(report.id).first<TakedownRow>();
  const auth = await authFor(c.env, me.id);
  const recipient = existing
    ? { site: existing.site, method: existing.method, target: existing.target, note: existing.recipient_note }
    : await recipientFor(report.copy_url);
  return c.json({
    takedown: existing ? takedownJson(c.env, existing) : null,
    authorization: { required: !auth, version: AUTH_VERSION, text: AUTH_TEXT, name: auth?.full_name ?? null },
    recipient: { site: recipient.site, method: recipient.method },
    notice: existing?.notice ?? (await noticeFor(c.env, report, auth?.full_name ?? '(your full name)', Date.now(), me.handle ?? me.id)),
  });
});

takedownRoutes.post('/v1/reports/:id/confirm', requireAuth, async (c) => {
  const me = c.get('user');
  const report = await ownReport(c.env, c.req.param('id'), me.id);
  const existing = await c.env.DB.prepare('SELECT * FROM takedowns WHERE report_id = ?').bind(report.id).first<TakedownRow>();
  if (existing) return c.json({ takedown: takedownJson(c.env, existing) });
  const body = await readJson(c).catch(() => ({}) as Record<string, unknown>);
  let auth = await authFor(c.env, me.id);
  if (!auth) {
    if (body.authorization && typeof body.authorization === 'object') auth = await saveAuthorization(c, me.id, body.authorization as Record<string, unknown>);
    else throw fail(403, 'authorization_required', 'Sign the statement once before we send notices for you.');
  }
  const recipient = await recipientFor(report.copy_url);
  const now = Date.now();
  const notice = await noticeFor(c.env, report, auth.full_name, auth.signed_at, me.handle ?? me.id);
  const id = newId(10);
  await c.env.DB.prepare(
    `INSERT INTO takedowns (id, report_id, user_id, post_id, copy_url, site, method, target, recipient_note, notice, signer_name, auth_version, status, created_at, ready_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?)`,
  ).bind(id, report.id, me.id, report.post_id, report.copy_url, recipient.site, recipient.method, recipient.target, recipient.note, notice, auth.full_name, AUTH_VERSION, now, now).run();
  await c.env.DB.prepare(`UPDATE reports SET status = 'filing', updated_at = ? WHERE id = ?`).bind(Date.now(), report.id).run();
  const row = await c.env.DB.prepare('SELECT * FROM takedowns WHERE id = ?').bind(id).first<TakedownRow>();
  return c.json({ takedown: takedownJson(c.env, row!) }, 201);
});

takedownRoutes.get('/v1/protect/takedowns', requireAuth, async (c) => {
  const rows = (await c.env.DB.prepare('SELECT * FROM takedowns WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100').bind(c.get('user').id).all<TakedownRow>()).results;
  return c.json({ takedowns: rows.map((r) => takedownJson(c.env, r)) });
});

const adminJson = (env: Env, r: TakedownRow & { handle: string | null }) => ({
  ...takedownJson(env, r), handle: r.handle, target: r.target, recipientNote: r.recipient_note, notice: r.notice, signerName: r.signer_name,
});

takedownRoutes.get('/v1/admin/takedowns', fundAdmin, async (c) => {
  const status = c.req.query('status') ?? 'ready';
  const rows = (await c.env.DB.prepare(
    `SELECT t.*, u.handle FROM takedowns t JOIN users u ON u.id = t.user_id WHERE (?1 = 'all' OR t.status = ?1) ORDER BY t.created_at LIMIT 100`,
  ).bind(status).all<TakedownRow & { handle: string | null }>()).results;
  return c.json({ takedowns: rows.map((r) => adminJson(c.env, r)) });
});

async function claim(env: Env, id: string, from: string[], to: string, extra = '') {
  const ph = from.map(() => '?').join(',');
  const res = await env.DB.prepare(`UPDATE takedowns SET status = ?${extra} WHERE id = ? AND status IN (${ph})`).bind(to, id, ...from).run();
  return res.meta.changes > 0;
}

async function load(env: Env, id: string) {
  const row = await env.DB.prepare('SELECT t.*, u.handle FROM takedowns t JOIN users u ON u.id = t.user_id WHERE t.id = ?').bind(id).first<TakedownRow & { handle: string | null }>();
  if (!row) throw fail(404, 'not_found', 'No such takedown.');
  return row;
}

takedownRoutes.post('/v1/admin/takedowns/:id/send-email', fundAdmin, async (c) => {
  const id = c.req.param('id');
  const row = await load(c.env, id);
  if (row.method !== 'email' || !row.target) throw fail(409, 'not_email', 'This one goes through a form, not email.');
  if (!c.env.RESEND_API_KEY) throw fail(503, 'email_off', 'Email sending is not configured.');
  const now = Date.now();
  if (!(await claim(c.env, id, ['ready'], 'sent', `, sent_at = ${now}, sent_via = 'email'`))) throw fail(409, 'not_ready', 'This takedown is not waiting for approval.');
  try {
    await postResend(c.env, {
      from: DESK_FROM,
      to: [row.target],
      reply_to: DESK_EMAIL,
      subject: `Copyright notice: ${row.copy_url}`.slice(0, 200),
      text: row.notice,
    });
  } catch (e) {
    await c.env.DB.prepare(`UPDATE takedowns SET status = 'ready', sent_at = NULL, sent_via = NULL WHERE id = ?`).bind(id).run();
    console.error('[takedown] send failed', id, e);
    throw fail(502, 'send_failed', 'The email did not go out. Nothing was marked sent.');
  }
  return c.json({ takedown: adminJson(c.env, await load(c.env, id)) });
});

takedownRoutes.post('/v1/admin/takedowns/:id/mark-filed', fundAdmin, async (c) => {
  const id = c.req.param('id');
  await load(c.env, id);
  if (!(await claim(c.env, id, ['ready'], 'sent', `, sent_at = ${Date.now()}, sent_via = 'form'`))) throw fail(409, 'not_ready', 'This takedown is not waiting for approval.');
  return c.json({ takedown: adminJson(c.env, await load(c.env, id)) });
});

takedownRoutes.post('/v1/admin/takedowns/:id/reject', fundAdmin, async (c) => {
  const id = c.req.param('id');
  const reason = (await readJson(c)).reason;
  if (typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 500) throw fail(400, 'bad_reason', 'Give a reason the creator can read.');
  await load(c.env, id);
  const res = await c.env.DB.prepare(`UPDATE takedowns SET status = 'rejected', reject_reason = ? WHERE id = ? AND status = 'ready'`).bind(reason.trim(), id).run();
  if (!res.meta.changes) throw fail(409, 'not_ready', 'This takedown is not waiting for approval.');
  return c.json({ takedown: adminJson(c.env, await load(c.env, id)) });
});

takedownRoutes.post('/v1/admin/takedowns/:id/counter-notice', fundAdmin, async (c) => {
  const id = c.req.param('id');
  await load(c.env, id);
  if (!(await claim(c.env, id, ['sent', 'still_up'], 'counter_notice'))) throw fail(409, 'not_sent', 'Only a sent notice can get a counter-notice.');
  return c.json({ takedown: adminJson(c.env, await load(c.env, id)) });
});

export function judge(status: number, html: string, imageRef: string | null): { removed: boolean; reason: string } {
  if (status === 404 || status === 410) return { removed: true, reason: `Page answers HTTP ${status}` };
  if (status >= 200 && status < 300 && imageRef && !html.includes(imageRef)) return { removed: true, reason: `Page answers HTTP ${status} but no longer links the image` };
  return { removed: false, reason: `Page answers HTTP ${status}${status >= 200 && status < 300 ? ' and still shows the image' : ' (not conclusive)'}` };
}

const imageRefOf = (html: string) =>
  /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1]
  ?? /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i.exec(html)?.[1]
  ?? null;

export async function runTakedownRecheck(env: Env, now = Date.now()) {
  const stats = { checked: 0, removed: 0, gaveUp: 0, errors: 0 };
  const due = (await env.DB.prepare(
    `SELECT * FROM takedowns WHERE status = 'sent' AND (last_check_at IS NULL OR last_check_at <= ?) ORDER BY COALESCE(last_check_at, 0) LIMIT ?`,
  ).bind(now - CHECK_EVERY_MS, CHECK_BATCH).all<TakedownRow>()).results;
  for (const t of due) {
    let status = 0;
    let html = '';
    try {
      const res = await fetch(t.copy_url, { redirect: 'follow', headers: { 'User-Agent': CHECK_UA, Accept: 'text/html,*/*' } });
      status = res.status;
      if (status >= 200 && status < 300) html = (await res.text()).slice(0, 512_000);
      else await res.body?.cancel();
    } catch (e) {
      stats.errors++;
      await env.DB.prepare(`UPDATE takedowns SET last_check_at = ?, last_http = 0, check_reason = ?, checks = checks + 1 WHERE id = ?`).bind(now, 'Could not reach the page', t.id).run();
      continue;
    }
    stats.checked++;
    const ref = t.image_ref ?? (status >= 200 && status < 300 ? imageRefOf(html) : null);
    const verdict = judge(status, html, t.image_ref);
    if (verdict.removed) {
      await env.DB.prepare(`UPDATE takedowns SET status = 'removed', removed_at = ?, last_check_at = ?, last_http = ?, check_reason = ?, checks = checks + 1 WHERE id = ?`).bind(now, now, status, verdict.reason, t.id).run();
      stats.removed++;
    } else if (t.sent_at && now - t.sent_at > CHECK_WINDOW_DAYS * DAY) {
      await env.DB.prepare(`UPDATE takedowns SET status = 'still_up', last_check_at = ?, last_http = ?, check_reason = ?, image_ref = ?, checks = checks + 1 WHERE id = ?`).bind(now, status, `${verdict.reason}; still up after ${CHECK_WINDOW_DAYS} days`, ref, t.id).run();
      stats.gaveUp++;
    } else {
      await env.DB.prepare(`UPDATE takedowns SET last_check_at = ?, last_http = ?, check_reason = ?, image_ref = ?, checks = checks + 1 WHERE id = ?`).bind(now, status, verdict.reason, ref, t.id).run();
    }
  }
  return stats;
}

const { colors } = BRAND;

takedownRoutes.get('/takedown/:id', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT t.id, t.site, t.created_at, t.removed_at, u.handle, u.display_name FROM takedowns t JOIN users u ON u.id = t.user_id WHERE t.id = ? AND t.status = 'removed' AND t.removed_at IS NOT NULL`,
  ).bind(c.req.param('id')).first<{ id: string; site: string; created_at: number; removed_at: number; handle: string | null; display_name: string }>();
  if (!row) return notFoundPage('We could not find that receipt.');
  const days = daysBetween(row.created_at, row.removed_at);
  const when = days === 0 ? 'the same day' : days === 1 ? 'in 1 day' : `in ${days} days`;
  const who = row.handle ? `@${row.handle}` : 'A creator';
  const headline = `Removed ${when}`;
  const desc = `${who} found a copy of their work on ${row.site}. Emera filed the takedown. It came down ${when}.`;
  const url = `${originOf(c.env)}/takedown/${row.id}`;
  const date = new Date(row.removed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(headline)} - ${esc(BRAND.name)}</title>
<meta name="description" content="${esc(desc)}"><meta name="robots" content="noindex">
<link rel="canonical" href="${esc(url)}">
<meta property="og:site_name" content="${esc(BRAND.name)}"><meta property="og:type" content="website">
<meta property="og:title" content="${esc(headline)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="https://${BRAND.domain}/assets/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(headline)}"><meta name="twitter:description" content="${esc(desc)}">
<style>:root{--bg:${colors.bg};--ink:${colors.ink};--accent:${colors.accent}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}main{max-width:640px;margin:0 auto;padding:64px 20px}.k{color:color-mix(in srgb,var(--ink) 60%,var(--bg))}h1{font:700 clamp(38px,9vw,64px)/1.05 ui-serif,Georgia,serif;letter-spacing:-.02em;margin:12px 0}.card{border:1px solid color-mix(in srgb,var(--ink) 14%,transparent);border-left:6px solid var(--accent);border-radius:12px;padding:18px 20px;margin:28px 0}a.pill{display:inline-block;padding:10px 18px;border-radius:999px;background:var(--ink);color:var(--bg);text-decoration:none;font-weight:600}</style>
</head><body><main><div class="k">${esc(BRAND.name)} takedown receipt</div><h1>${esc(headline)}</h1>
<div class="card"><b>${esc(row.site)}</b><br><span class="k">Copy of work by ${esc(who)}. Gone on ${esc(date)}.</span></div>
<p>${esc(BRAND.tagline)}</p><a class="pill" href="/?ref=takedown-receipt">Join ${esc(BRAND.name)}</a></main></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
});
