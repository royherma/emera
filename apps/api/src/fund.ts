import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv, Env } from './env';
import { fail, readJson } from './http';
import { requireAuth } from './auth';
import { newId, sha256Hex } from './crypto';
import { iso, loadPosts, type PostRow } from './serialize';
import {
  CLOSE_DAY, CREATOR_CAP_S, FEED_CARD_EVERY, FEED_CARD_MIN_POSTS, CREATOR_SHARE, HEARTBEAT_MAX_S, MIN_VIEWER_AGE_H, PHOTO_CAP_S, RULES_VERSION, VIDEO_CAP_S, rulesJson,
} from './fundRules';

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MONTHS_PER_SPONSORSHIP = 36;
const HISTORY_LIMIT = 24;

export const monthOf = (ms: number) => new Date(ms).toISOString().slice(0, 7);
export const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}
const daysOf = (month: string) => [`${month}-01`, `${month}-31`] as const;

export const fundingOn = (env: Env) => env.FUNDING === 'on';

type SponsorshipRow = {
  id: string; sponsor_id: string; month: string; amount_cents: number; status: 'pledged' | 'paid' | 'refunded';
  refund_month: string | null; created_at: number; sponsor_name: string; sponsor_url: string | null;
};
const SPONSORSHIP_SELECT = `SELECT s.id, s.sponsor_id, s.month, s.amount_cents, s.status, s.refund_month, s.created_at,
  p.name AS sponsor_name, p.url AS sponsor_url FROM sponsorships s JOIN sponsors p ON p.id = s.sponsor_id`;

const sponsorshipJson = (r: SponsorshipRow) => ({
  id: r.id, sponsorName: r.sponsor_name, sponsorUrl: r.sponsor_url, month: r.month, amountCents: r.amount_cents, status: r.status, createdAt: iso(r.created_at),
});

export type Share = { handle: string | null; seconds: number; sharePpm: number; amountCents: number };
type CreatorShare = Share & { creatorId: string };

export type Statement = {
  month: string; status: 'open' | 'closed'; sponsoredCents: number; carryInCents: number; creatorPoolCents: number; emeraCents: number;
  totalSeconds: number; creators: number; sponsors: number; closedAt: string | null; sha256: string | null;
  rulesVersion: string; sponsorships: ReturnType<typeof sponsorshipJson>[]; refunds: ReturnType<typeof sponsorshipJson>[];
  shares: Share[]; carryOutCents: number;
};

export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

export function statementBody(st: Statement) {
  const { sha256: _s, closedAt: _c, ...body } = st;
  return body;
}

export const statementHash = (st: Statement) => sha256Hex(canonicalJson(statementBody(st)));

export const summaryOf = (st: Statement) => ({
  month: st.month, status: st.status, sponsoredCents: st.sponsoredCents, carryInCents: st.carryInCents, creatorPoolCents: st.creatorPoolCents,
  emeraCents: st.emeraCents, totalSeconds: st.totalSeconds, creators: st.creators, sponsors: st.sponsors, closedAt: st.closedAt, sha256: st.sha256,
});

async function computeMonth(db: D1Database, month: string, carryInCents: number): Promise<{ statement: Statement; rows: CreatorShare[] }> {
  const [from, to] = daysOf(month);
  const [ships, refunds, watch] = await db.batch([
    db.prepare(`${SPONSORSHIP_SELECT} WHERE s.month = ? ORDER BY s.amount_cents DESC, s.id`).bind(month),
    db.prepare(`${SPONSORSHIP_SELECT} WHERE s.refund_month = ? ORDER BY s.amount_cents DESC, s.id`).bind(month),
    db.prepare(
      `SELECT w.creator_id, u.handle, SUM(w.seconds) AS seconds FROM fund_watch w JOIN users u ON u.id = w.creator_id
       WHERE w.day BETWEEN ? AND ? GROUP BY w.creator_id HAVING SUM(w.seconds) > 0`,
    ).bind(from, to),
  ]);
  const shipRows = ships.results as SponsorshipRow[];
  const refundRows = refunds.results as SponsorshipRow[];
  const watchRows = watch.results as { creator_id: string; handle: string | null; seconds: number }[];

  const paid = shipRows.filter((r) => r.status === 'paid');
  const sponsoredCents = paid.reduce((n, r) => n + r.amount_cents, 0) - refundRows.reduce((n, r) => n + r.amount_cents, 0);
  const creatorHalf = Math.round(sponsoredCents * CREATOR_SHARE);
  const creatorPoolCents = carryInCents + creatorHalf;
  const pool = BigInt(Math.max(0, creatorPoolCents));
  const totalSeconds = watchRows.reduce((n, r) => n + r.seconds, 0);
  const total = BigInt(totalSeconds);

  const rows: CreatorShare[] = watchRows.map((r) => ({
    creatorId: r.creator_id,
    handle: r.handle,
    seconds: r.seconds,
    sharePpm: Number((BigInt(r.seconds) * 1_000_000n) / total),
    amountCents: Number((pool * BigInt(r.seconds)) / total),
  }));
  rows.sort((a, b) => b.amountCents - a.amountCents || b.seconds - a.seconds || (a.creatorId < b.creatorId ? -1 : 1));
  const distributed = rows.reduce((n, r) => n + r.amountCents, 0);

  return {
    rows,
    statement: {
      month,
      status: 'open',
      sponsoredCents,
      carryInCents,
      creatorPoolCents,
      emeraCents: sponsoredCents - creatorHalf,
      totalSeconds,
      creators: rows.length,
      sponsors: new Set(paid.map((r) => r.sponsor_id)).size,
      closedAt: null,
      sha256: null,
      rulesVersion: RULES_VERSION,
      sponsorships: shipRows.map(sponsorshipJson),
      refunds: refundRows.map(sponsorshipJson),
      shares: rows.map(({ handle, seconds, sharePpm, amountCents }) => ({ handle, seconds, sharePpm, amountCents })),
      carryOutCents: creatorPoolCents - distributed,
    },
  };
}

async function earliestMonth(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    `SELECT MIN(m) AS m FROM (
       SELECT MIN(month) AS m FROM sponsorships UNION ALL SELECT MIN(refund_month) FROM sponsorships
       UNION ALL SELECT substr(MIN(day), 1, 7) FROM fund_watch UNION ALL SELECT MIN(month) FROM fund_months)`,
  ).first<{ m: string | null }>();
  return row?.m ?? null;
}

type FrozenRow = { statement: string; sha256: string; closed_at: number; carry_out_cents: number };

async function frozenRow(db: D1Database, month: string) {
  return db.prepare('SELECT statement, sha256, closed_at, carry_out_cents FROM fund_months WHERE month = ?').bind(month).first<FrozenRow>();
}

const frozenStatement = (r: FrozenRow): Statement => ({ ...JSON.parse(r.statement), sha256: r.sha256, closedAt: iso(r.closed_at) });

async function carryInFor(db: D1Database, month: string, earliest: string | null, mode: 'live' | 'close', now: number): Promise<number> {
  const prev = shiftMonth(month, -1);
  if (!earliest || prev < earliest) return 0;
  const frozen = await frozenRow(db, prev);
  if (frozen) return frozen.carry_out_cents;
  if (mode === 'close') return (await closeMonth(db, prev, now)).carryOutCents;
  return (await computeMonth(db, prev, await carryInFor(db, prev, earliest, 'live', now))).statement.carryOutCents;
}

export async function liveMonth(db: D1Database, month: string, now = Date.now()) {
  const frozen = await frozenRow(db, month);
  if (frozen) return { statement: frozenStatement(frozen), rows: null };
  return computeMonth(db, month, await carryInFor(db, month, await earliestMonth(db), 'live', now));
}

export async function closeMonth(db: D1Database, month: string, now = Date.now()): Promise<Statement> {
  if (month >= monthOf(now)) throw fail(400, 'month_open', 'That month has not ended yet.');
  const existing = await frozenRow(db, month);
  if (existing) return frozenStatement(existing);

  const carryIn = await carryInFor(db, month, await earliestMonth(db), 'close', now);
  const { statement, rows } = await computeMonth(db, month, carryIn);
  const body = statementBody({ ...statement, status: 'closed' });
  const json = canonicalJson(body);
  const sha = await sha256Hex(json);
  const created = await db.prepare(
    `INSERT OR IGNORE INTO fund_months (month, sponsored_cents, carry_in_cents, carry_out_cents, creator_pool_cents, emera_cents,
       total_seconds, creators, sponsors, rules_version, statement, sha256, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(month, body.sponsoredCents, body.carryInCents, body.carryOutCents, body.creatorPoolCents, body.emeraCents,
    body.totalSeconds, body.creators, body.sponsors, body.rulesVersion, json, sha, now).run();
  if (created.meta.changes && rows.length) {
    await db.batch(rows.map((r) => db.prepare(
      'INSERT OR IGNORE INTO fund_shares (month, creator_id, seconds, share_ppm, amount_cents) VALUES (?, ?, ?, ?, ?)',
    ).bind(month, r.creatorId, r.seconds, r.sharePpm, r.amountCents)));
  }
  return frozenStatement((await frozenRow(db, month))!);
}

export async function runFundCron(env: Env, now = Date.now()) {
  if (!fundingOn(env) || new Date(now).getUTCDate() < CLOSE_DAY) return null;
  return closeMonth(env.DB, shiftMonth(monthOf(now), -1), now);
}

const notFound = () => fail(404, 'not_found', 'No such endpoint.');

export const fundOn: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!fundingOn(c.env)) throw notFound();
  await next();
};

export const fundAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const key = c.env.FUND_ADMIN_KEY ?? '';
  const header = c.req.header('Authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!key || !given || (await sha256Hex(given)) !== (await sha256Hex(key))) throw notFound();
  await next();
};

export const fundRoutes = new Hono<AppEnv>();

fundRoutes.post('/v1/watch', fundOn, requireAuth, async (c) => {
  const body = await readJson(c);
  const postId = typeof body.postId === 'string' ? body.postId : '';
  const raw = typeof body.seconds === 'number' ? body.seconds : NaN;
  const seconds = Math.floor(raw);
  if (!Number.isFinite(raw) || seconds < 1 || raw > HEARTBEAT_MAX_S) throw fail(400, 'bad_seconds', `Send 1 to ${HEARTBEAT_MAX_S} seconds at a time.`);

  const db = c.env.DB;
  const post = await db.prepare(
    `SELECT p.user_id, EXISTS (SELECT 1 FROM media m WHERE m.post_id = p.id AND m.kind = 'video') AS video FROM posts p WHERE p.id = ?`,
  ).bind(postId).first<{ user_id: string; video: number }>();
  if (!post) throw fail(404, 'not_found', 'No such post.');

  const me = c.get('user');
  const now = Date.now();
  if (post.user_id === me.id || now - me.created_at < MIN_VIEWER_AGE_H * 3_600_000) return c.json({ counted: 0 });

  const day = dayOf(now);
  const [before, after] = await db.batch([
    db.prepare('SELECT seconds FROM fund_watch WHERE day = ? AND viewer_id = ? AND post_id = ?').bind(day, me.id, postId),
    db.prepare(
      `INSERT INTO fund_watch (day, viewer_id, post_id, creator_id, seconds)
       SELECT ?1, ?2, ?3, ?4, a FROM (SELECT MIN(?5,
         ?6 - COALESCE((SELECT seconds FROM fund_watch WHERE day = ?1 AND viewer_id = ?2 AND post_id = ?3), 0),
         ?7 - COALESCE((SELECT SUM(seconds) FROM fund_watch WHERE day = ?1 AND viewer_id = ?2 AND creator_id = ?4), 0)) AS a)
       WHERE a > 0
       ON CONFLICT (day, viewer_id, post_id) DO UPDATE SET seconds = seconds + excluded.seconds
       RETURNING seconds`,
    ).bind(day, me.id, postId, post.user_id, seconds, post.video ? VIDEO_CAP_S : PHOTO_CAP_S, CREATOR_CAP_S),
  ]);
  const old = (before.results[0] as { seconds: number } | undefined)?.seconds ?? 0;
  const updated = (after.results[0] as { seconds: number } | undefined)?.seconds;
  return c.json({ counted: updated === undefined ? 0 : updated - old });
});

fundRoutes.get('/v1/fund', fundOn, async (c) => {
  const db = c.env.DB;
  const { statement } = await liveMonth(db, monthOf(Date.now()));
  const bySponsor = new Map<string, { name: string; url: string | null; amountCents: number }>();
  for (const s of statement.sponsorships) {
    if (s.status !== 'paid') continue;
    const cur = bySponsor.get(s.sponsorName) ?? { name: s.sponsorName, url: s.sponsorUrl, amountCents: 0 };
    cur.amountCents += s.amountCents;
    bySponsor.set(s.sponsorName, cur);
  }
  const history = (await db.prepare(
    `SELECT statement, sha256, closed_at, carry_out_cents FROM fund_months
     WHERE sponsored_cents != 0 OR carry_in_cents != 0 OR carry_out_cents != 0 OR total_seconds != 0
     ORDER BY month DESC LIMIT ?`,
  ).bind(HISTORY_LIMIT).all<FrozenRow>()).results;
  const banners = (await db.prepare(
    `SELECT p.name, p.url, p.line, SUM(s.amount_cents) AS cents FROM sponsors p JOIN sponsorships s ON s.sponsor_id = p.id
     WHERE p.banner = 'approved' AND s.status = 'paid' AND s.month = ? GROUP BY p.id ORDER BY cents DESC, p.name LIMIT 20`,
  ).bind(statement.month).all<{ name: string; url: string | null; line: string | null }>()).results;
  const posts = (await db.prepare('SELECT COUNT(*) AS n FROM posts').first<{ n: number }>())?.n ?? 0;
  return c.json({
    rules: rulesJson(),
    banners: banners.map(({ name, url, line }) => ({ name, url, line })),
    feedCards: { on: posts >= FEED_CARD_MIN_POSTS, posts, needed: FEED_CARD_MIN_POSTS, every: FEED_CARD_EVERY },
    month: summaryOf(statement),
    sponsors: [...bySponsor.values()].sort((a, b) => b.amountCents - a.amountCents || a.name.localeCompare(b.name)),
    history: history.map((r) => summaryOf(frozenStatement(r))),
  });
});

fundRoutes.get('/v1/fund/months/:month', fundOn, async (c) => {
  const month = c.req.param('month');
  if (!MONTH_RE.test(month)) throw fail(404, 'not_found', 'No statement for that month.');
  const { statement } = await liveMonth(c.env.DB, month);
  const empty = !statement.sponsorships.length && !statement.refunds.length && !statement.totalSeconds && !statement.carryInCents;
  if (statement.status === 'open' && empty) throw fail(404, 'not_found', 'No statement for that month.');
  return c.json({ statement });
});

fundRoutes.get('/v1/me/earnings', fundOn, requireAuth, async (c) => {
  const db = c.env.DB;
  const me = c.get('user');
  const month = monthOf(Date.now());
  const [from, to] = daysOf(month);
  const live = await liveMonth(db, month);
  const mine = live.rows?.find((r) => r.creatorId === me.id);
  const [closed, top] = await db.batch([
    db.prepare('SELECT month, seconds, share_ppm, amount_cents FROM fund_shares WHERE creator_id = ? ORDER BY month DESC').bind(me.id),
    db.prepare(
      `SELECT p.id, p.user_id, p.caption, p.created_at, SUM(w.seconds) AS watched FROM fund_watch w JOIN posts p ON p.id = w.post_id
       WHERE w.creator_id = ? AND w.day BETWEEN ? AND ? GROUP BY p.id ORDER BY watched DESC, p.id LIMIT 5`,
    ).bind(me.id, from, to),
  ]);
  const months = (closed.results as { month: string; seconds: number; share_ppm: number; amount_cents: number }[])
    .map((r) => ({ month: r.month, seconds: r.seconds, sharePpm: r.share_ppm, amountCents: r.amount_cents }));
  const topRows = top.results as (PostRow & { watched: number })[];
  const posts = await loadPosts(c, topRows);
  return c.json({
    rules: rulesJson(),
    thisMonth: {
      month,
      seconds: mine?.seconds ?? 0,
      totalSeconds: live.statement.totalSeconds,
      sharePpm: mine?.sharePpm ?? 0,
      estimateCents: mine?.amountCents ?? 0,
    },
    months,
    balanceCents: months.reduce((n, m) => n + m.amountCents, 0),
    topPosts: posts.map((post, i) => ({ post, seconds: topRows[i].watched })),
  });
});

export type Booking = {
  name: string; url: string | null; email: string | null; line?: string | null; amountCents: number; months: string[];
  status: 'paid' | 'pledged'; stripeSession?: string; paymentIntent?: string | null;
};

export function cleanUrl(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  try {
    const raw = String(v).trim();
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname.includes('.')) throw new Error();
    return u.toString();
  } catch {
    throw fail(400, 'bad_url', 'Sponsor link must look like acme.com or https://acme.com.');
  }
}

export async function bookSponsorship(db: D1Database, b: Booking) {
  const ph = b.months.map(() => '?').join(',');
  const closed = await db.prepare(`SELECT month FROM fund_months WHERE month IN (${ph}) LIMIT 1`).bind(...b.months).first<{ month: string }>();
  if (closed) throw fail(409, 'month_closed', `${closed.month} is closed. Book it to an open month.`);

  const now = Date.now();
  let sponsor = await db.prepare('SELECT id FROM sponsors WHERE name = ?').bind(b.name).first<{ id: string }>();
  if (sponsor) {
    if (b.url) await db.prepare('UPDATE sponsors SET url = ? WHERE id = ?').bind(b.url, sponsor.id).run();
    if (b.email) await db.prepare('UPDATE sponsors SET contact_email = ? WHERE id = ?').bind(b.email, sponsor.id).run();
    if (b.line) await db.prepare(`UPDATE sponsors SET line = ?, banner = 'pending' WHERE id = ? AND (line IS NULL OR line != ?)`).bind(b.line, sponsor.id, b.line).run();
  } else {
    sponsor = { id: newId(12) };
    await db.prepare('INSERT INTO sponsors (id, name, url, contact_email, line, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(sponsor.id, b.name, b.url, b.email, b.line ?? null, now).run();
  }
  const each = Math.floor(b.amountCents / b.months.length);
  const ids = b.months.map(() => newId(12));
  await db.batch(b.months.map((m, i) => db.prepare(
    `INSERT INTO sponsorships (id, sponsor_id, month, amount_cents, status, created_at, paid_at, stripe_session, stripe_payment_intent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(ids[i], sponsor!.id, m, i === 0 ? b.amountCents - each * (b.months.length - 1) : each, b.status, now,
    b.status === 'paid' ? now : null, b.stripeSession ?? null, b.paymentIntent ?? null)));
  const rows = (await db.prepare(`${SPONSORSHIP_SELECT} WHERE s.id IN (${ph}) ORDER BY s.month`).bind(...ids).all<SponsorshipRow>()).results;
  return { sponsorId: sponsor!.id, sponsorships: rows.map(sponsorshipJson) };
}

export async function refundSponsorship(db: D1Database, id: string) {
  const row = await db.prepare(`${SPONSORSHIP_SELECT} WHERE s.id = ?`).bind(id).first<SponsorshipRow>();
  if (!row) throw fail(404, 'not_found', 'No such sponsorship.');
  if (row.status !== 'refunded') {
    const now = Date.now();
    const afterClose = row.status === 'paid' && (await frozenRow(db, row.month)) ? monthOf(now) : null;
    await db.prepare(`UPDATE sponsorships SET status = 'refunded', refunded_at = ?, refund_month = ? WHERE id = ? AND status != 'refunded'`)
      .bind(now, afterClose, id).run();
  }
  return sponsorshipJson((await db.prepare(`${SPONSORSHIP_SELECT} WHERE s.id = ?`).bind(id).first<SponsorshipRow>())!);
}

fundRoutes.post('/v1/admin/fund/sponsorships', fundOn, fundAdmin, async (c) => {
  const body = await readJson(c);
  const name = typeof body.sponsorName === 'string' ? body.sponsorName.trim() : '';
  if (name.length < 1 || name.length > 80) throw fail(400, 'bad_sponsor_name', 'Sponsor name must be 1 to 80 characters.');
  const url = cleanUrl(body.sponsorUrl);
  const email = typeof body.contactEmail === 'string' && body.contactEmail.trim() ? body.contactEmail.trim().toLowerCase() : null;
  if (email && !EMAIL_RE.test(email)) throw fail(400, 'bad_email', 'Enter a valid contact email.');
  const amount = body.amountCents;
  const months = Array.isArray(body.months) ? [...new Set(body.months)].sort() : [];
  if (!months.length || months.length > MAX_MONTHS_PER_SPONSORSHIP || !months.every((m) => typeof m === 'string' && MONTH_RE.test(m))) {
    throw fail(400, 'bad_months', `Pick 1 to ${MAX_MONTHS_PER_SPONSORSHIP} months as YYYY-MM.`);
  }
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < months.length) {
    throw fail(400, 'bad_amount', 'Amount must be a whole number of cents, at least 1 cent per month.');
  }
  const status = body.status === undefined ? 'paid' : body.status;
  if (status !== 'paid' && status !== 'pledged') throw fail(400, 'bad_status', 'Status must be paid or pledged.');
  const booked = await bookSponsorship(c.env.DB, { name, url, email, amountCents: amount, months: months as string[], status });
  return c.json({ sponsorships: booked.sponsorships }, 201);
});

fundRoutes.post('/v1/admin/fund/sponsorships/:id/refund', fundOn, fundAdmin, async (c) => {
  return c.json({ sponsorship: await refundSponsorship(c.env.DB, c.req.param('id')) });
});

fundRoutes.post('/v1/admin/fund/close', fundOn, fundAdmin, async (c) => {
  const body = await readJson(c);
  const month = typeof body.month === 'string' ? body.month : '';
  if (!MONTH_RE.test(month)) throw fail(400, 'bad_month', 'Send a month as YYYY-MM.');
  return c.json({ statement: await closeMonth(c.env.DB, month) });
});
