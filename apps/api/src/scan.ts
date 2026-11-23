import { Hono } from 'hono';
import type { AppEnv, Env } from './env';
import { requireAuth } from './auth';
import { fail } from './http';
import { newId } from './crypto';
import { sendReportToTeam } from './mail';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const OWN_HOSTS = ['emera.social'];

export type Candidate = { url: string; title: string; source: string; thumbnail: string | null; kind: 'visual' | 'exact' };

const hostOf = (raw: string) => {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};
const underHost = (host: string, base: string) => host === base || host.endsWith(`.${base}`);

export function ownHosts(env: Env, linksJson: string): string[] {
  const hosts = [...OWN_HOSTS];
  if (env.PUBLIC_ORIGIN) hosts.push(hostOf(env.PUBLIC_ORIGIN));
  try {
    for (const l of JSON.parse(linksJson) as unknown[]) {
      const raw = typeof l === 'string' ? l : (l as { url?: string })?.url;
      if (raw) hosts.push(hostOf(raw));
    }
  } catch {}
  return hosts.filter(Boolean);
}

export function parseLens(json: any): Candidate[] {
  const out: Candidate[] = [];
  const take = (list: unknown, kind: Candidate['kind']) => {
    if (!Array.isArray(list)) return;
    for (const m of list) {
      if (!m || typeof m.link !== 'string' || !/^https?:\/\//.test(m.link)) continue;
      out.push({
        url: m.link.slice(0, 2048),
        title: String(m.title ?? '').slice(0, 300),
        source: String(m.source ?? '').slice(0, 120),
        thumbnail: typeof m.thumbnail === 'string' && /^https?:\/\//.test(m.thumbnail) ? m.thumbnail : null,
        kind,
      });
    }
  };
  take(json?.exact_matches, 'exact');
  take(json?.visual_matches, 'visual');
  return out;
}

export function keepForeign(cands: Candidate[], own: string[]): Candidate[] {
  return cands.filter((c) => {
    const h = hostOf(c.url);
    return h && !own.some((o) => underHost(h, o));
  });
}

const monthKey = (now: number) => `serp:${new Date(now).toISOString().slice(0, 7)}`;
const limitOf = (env: Env) => {
  const n = Number(env.SCAN_MONTHLY_LIMIT);
  return Number.isFinite(n) && n >= 0 && env.SCAN_MONTHLY_LIMIT !== undefined && env.SCAN_MONTHLY_LIMIT !== '' ? n : 200;
};

async function spendCall(env: Env, now: number) {
  const key = monthKey(now);
  const limit = limitOf(env);
  if (limit <= 0) return false;
  const res = await env.DB.prepare(
    'INSERT INTO scan_meta (key, n) VALUES (?, 1) ON CONFLICT (key) DO UPDATE SET n = n + 1 WHERE n < ?',
  ).bind(key, limit).run();
  return limit > 0 && res.meta.changes > 0;
}

const liveSql = `u.plan IN ('creator', 'pro') AND (u.plan_until IS NULL OR u.plan_until > ?)`;

type Due = { id: string; post_id: string; user_id: string; r2_key: string; poster_key: string | null; kind: string; post_at: number; plan: string; links: string };

export async function runScan(env: Env, now = Date.now()) {
  const stats = { scanned: 0, found: 0, failed: 0, stoppedByBudget: false, skipped: 0 };
  if (!env.SERP_API_KEY || !env.PUBLIC_ORIGIN) return { ...stats, off: true };
  const batch = Math.max(1, Number(env.SCAN_BATCH) || 5);
  const due = (await env.DB.prepare(
    `SELECT m.id, m.post_id, m.user_id, m.r2_key, m.poster_key, m.kind, p.created_at AS post_at, u.plan, u.links
     FROM media m JOIN posts p ON p.id = m.post_id JOIN users u ON u.id = m.user_id
     LEFT JOIN scans s ON s.media_id = m.id
     WHERE m.status = 'done' AND ${liveSql} AND (s.media_id IS NULL OR s.next_scan_at <= ?)
     ORDER BY COALESCE(s.next_scan_at, 0), m.id LIMIT ?`,
  ).bind(now, now, batch).all<Due>()).results;
  const origin = env.PUBLIC_ORIGIN.replace(/\/$/, '');

  for (const m of due) {
    const key = m.kind === 'video' ? m.poster_key : m.r2_key;
    const weekly = now + 7 * DAY;
    const setNext = (next: number, scanned: boolean) =>
      env.DB.prepare(
        `INSERT INTO scans (media_id, post_id, user_id, media_key, last_scanned_at, next_scan_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (media_id) DO UPDATE SET last_scanned_at = COALESCE(excluded.last_scanned_at, last_scanned_at), next_scan_at = excluded.next_scan_at`,
      ).bind(m.id, m.post_id, m.user_id, key ?? '', scanned ? now : null, next).run();
    if (!key) {
      await setNext(weekly, false);
      stats.skipped++;
      continue;
    }
    if (!(await spendCall(env, now))) {
      console.log('scan: monthly SerpAPI budget reached', limitOf(env));
      stats.stoppedByBudget = true;
      break;
    }
    let json: unknown;
    try {
      const res = await fetch(`https://serpapi.com/search.json?engine=google_lens&url=${encodeURIComponent(`${origin}/media/${key}`)}&api_key=${encodeURIComponent(env.SERP_API_KEY)}`);
      if (!res.ok && res.status !== 400 && res.status !== 404) throw new Error(`serpapi ${res.status}`);
      json = await res.json();
    } catch (e) {
      console.error('scan: lens call failed', m.id, e);
      stats.failed++;
      await setNext(now + HOUR, false);
      continue;
    }
    const own = ownHosts(env, m.links);
    const foreign = keepForeign(parseLens(json), own);
    for (const c of foreign) {
      const site = c.source || hostOf(c.url);
      const res = await env.DB.prepare(
        'INSERT OR IGNORE INTO matches (id, post_id, user_id, url, page_title, site, thumbnail, found_at, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).bind(newId(10), m.post_id, m.user_id, c.url, c.title, site, c.thumbnail, now, `Lens ${c.kind} match on ${site}`).run();
      stats.found += res.meta.changes;
    }
    const fresh = m.plan === 'pro' && now - m.post_at < 30 * DAY;
    await setNext(now + (fresh ? DAY : 7 * DAY), true);
    stats.scanned++;
  }
  return stats;
}

type MatchRow = { id: string; post_id: string; url: string; page_title: string; site: string; thumbnail: string | null; found_at: number; status: string; report_id: string | null; reason: string };
const matchJson = (r: MatchRow) => ({
  id: r.id, postId: r.post_id, url: r.url, title: r.page_title, site: r.site, thumbnail: r.thumbnail,
  reason: r.reason, status: r.status, reportId: r.report_id, foundAt: new Date(r.found_at).toISOString(),
});

export const scanRoutes = new Hono<AppEnv>();

scanRoutes.get('/v1/protect/matches', requireAuth, async (c) => {
  const rows = (await c.env.DB.prepare(
    `SELECT id, post_id, url, page_title, site, thumbnail, found_at, status, report_id, reason FROM matches
     WHERE user_id = ? AND status != 'dismissed' ORDER BY found_at DESC, id DESC LIMIT 100`,
  ).bind(c.get('user').id).all<MatchRow>()).results;
  return c.json({ matches: rows.map(matchJson) });
});

async function ownMatch(c: { env: Env; get(k: 'user'): { id: string } }, id: string) {
  const row = await c.env.DB.prepare('SELECT * FROM matches WHERE id = ? AND user_id = ?').bind(id, c.get('user').id).first<MatchRow & { user_id: string }>();
  if (!row) throw fail(404, 'not_found', 'No such match.');
  return row;
}

scanRoutes.post('/v1/protect/matches/:id/dismiss', requireAuth, async (c) => {
  const row = await ownMatch(c, c.req.param('id'));
  if (row.status === 'reported') throw fail(409, 'already_reported', 'This one is already reported.');
  await c.env.DB.prepare(`UPDATE matches SET status = 'dismissed' WHERE id = ?`).bind(row.id).run();
  return c.json({ match: matchJson({ ...row, status: 'dismissed' }) });
});

scanRoutes.post('/v1/protect/matches/:id/takedown', requireAuth, async (c) => {
  const me = c.get('user');
  const row = await ownMatch(c, c.req.param('id'));
  if (row.status === 'reported' && row.report_id) return c.json({ match: matchJson(row), report: { id: row.report_id, status: 'new' } });
  const reportId = newId(10);
  const note = `Found by Emera scan: ${row.reason}`;
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO reports (id, post_id, reporter_user_id, copy_url, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(reportId, row.post_id, me.id, row.url, note, Date.now()),
    c.env.DB.prepare(`UPDATE matches SET status = 'reported', report_id = ? WHERE id = ?`).bind(reportId, row.id),
  ]);
  try {
    await sendReportToTeam(c.env, { id: reportId, postId: row.post_id, url: row.url, note, reporter: me.handle ?? me.email });
  } catch (e) {
    console.error('[scan] team email failed', e);
  }
  return c.json({ match: matchJson({ ...row, status: 'reported', report_id: reportId }), report: { id: reportId, status: 'new' } }, 201);
});

scanRoutes.post('/v1/protect/scan-now', requireAuth, async (c) => {
  const me = c.get('user');
  const now = Date.now();
  const plan = await c.env.DB.prepare('SELECT plan, plan_until FROM users WHERE id = ?').bind(me.id).first<{ plan: string; plan_until: number | null }>();
  if (!plan || plan.plan === 'free' || (plan.plan_until !== null && plan.plan_until <= now)) {
    throw fail(403, 'plan_required', 'Scanning is part of Emera Protect.');
  }
  const key = `now:${me.id}`;
  const claimed = await c.env.DB.prepare(
    'INSERT INTO scan_meta (key, n) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET n = excluded.n WHERE n <= ?',
  ).bind(key, now, now - HOUR).run();
  if (!claimed.meta.changes) throw fail(429, 'too_soon', 'You can ask for a scan once an hour.');
  const queued = await c.env.DB.prepare('UPDATE scans SET next_scan_at = 0 WHERE user_id = ?').bind(me.id).run();
  return c.json({ queued: true, rescan: queued.meta.changes }, 202);
});
