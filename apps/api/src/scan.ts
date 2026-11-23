import { Hono } from 'hono';
import type { AppEnv, Env } from './env';
import { requireAuth } from './auth';
import { fail } from './http';
import { newId } from './crypto';
import { sendReportToTeam } from './mail';
import { isAdmin } from './roles';
import { VIDEO_MAX_INPUT, frame } from './media';
import { readVideoInfo } from './videoInfo';
import { PDQ_BITS, PDQ_MAX_DISTANCE, pdqDistance, pdqOf } from './pdq';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const OWN_HOSTS = ['emera.social'];
const MAX_THUMBS = 25;
const MAX_THUMB_BYTES = 3_000_000;
const FRAME_AT = [0.15, 0.5, 0.85];
const MIN_FRAME_SECONDS = 3;
const PLATFORMS = [
  'instagram.com', 'tiktok.com', 'youtube.com', 'facebook.com', 'fb.com', 'x.com', 'twitter.com', 'threads.net', 'threads.com',
  'pinterest.com', 'linkedin.com', 'bsky.app', 'twitch.tv', 'snapchat.com', 'reddit.com', 'tumblr.com', 'behance.net',
  'dribbble.com', 'vimeo.com', 'soundcloud.com', 'github.com', 'medium.com', 'substack.com', 'patreon.com', 'linktr.ee',
];
const PREFIX_SEGMENTS = new Set(['in', 'user', 'u', 'c', 'channel', 'company', 'people', 'profile']);

export type Candidate = { url: string; title: string; source: string; thumbnail: string | null; kind: 'visual' | 'exact' };
export type Own = { hosts: string[]; handles: string[] };
export type Verdict = { keep: boolean; kind: 'exact' | 'visual'; score: number | null; reason: string };

const hostOf = (raw: string) => {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};
const underHost = (host: string, base: string) => host === base || host.endsWith(`.${base}`);
const onPlatform = (host: string) => PLATFORMS.some((p) => underHost(host, p));
const cleanHandle = (h: string) => h.trim().toLowerCase().replace(/^@/, '');
const segmentsOf = (raw: string) => {
  try {
    return new URL(raw).pathname.split('/').filter(Boolean).map((s) => cleanHandle(decodeURIComponent(s)));
  } catch {
    return [];
  }
};

function handleFromUrl(raw: string): string | null {
  const seg = segmentsOf(raw);
  const first = seg[0];
  if (!first) return null;
  return PREFIX_SEGMENTS.has(first) ? seg[1] ?? null : first;
}

function listOf(text: string | null | undefined): string[] {
  if (!text) return [];
  try {
    const j = JSON.parse(text);
    if (Array.isArray(j)) return j.map((l) => (typeof l === 'string' ? l : (l as { url?: string })?.url ?? '')).filter(Boolean);
  } catch {}
  return text.split(/[\s,;]+/).filter(Boolean);
}

export function ownAccounts(env: Pick<Env, 'PUBLIC_ORIGIN'>, u: { handle?: string | null; links?: string | null; other_handles?: string | null; ig_username?: string | null }): Own {
  const hosts = [...OWN_HOSTS];
  if (env.PUBLIC_ORIGIN) hosts.push(hostOf(env.PUBLIC_ORIGIN));
  const handles: string[] = [];
  const addHandle = (h: string | null | undefined) => {
    const c = h ? cleanHandle(h) : '';
    if (c.length >= 2) handles.push(c);
  };
  addHandle(u.handle);
  addHandle(u.ig_username);
  for (const raw of [...listOf(u.links), ...listOf(u.other_handles)]) {
    if (/^https?:\/\//i.test(raw)) {
      const h = hostOf(raw);
      if (!h) continue;
      if (onPlatform(h)) addHandle(handleFromUrl(raw));
      else hosts.push(h);
    } else addHandle(raw);
  }
  return { hosts: [...new Set(hosts.filter(Boolean))], handles: [...new Set(handles)] };
}

export function isOwnUrl(url: string, own: Own): boolean {
  const h = hostOf(url);
  if (!h) return false;
  if (own.hosts.some((o) => underHost(h, o))) return true;
  if (!onPlatform(h)) return false;
  const seg = segmentsOf(url);
  const name = PREFIX_SEGMENTS.has(seg[0]) ? seg[1] : seg[0];
  return !!name && own.handles.includes(name);
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
  take(json?.visual_matches, json?.search_parameters?.type === 'exact_matches' ? 'exact' : 'visual');
  return out;
}

export function keepForeign(cands: Candidate[], own: Own): Candidate[] {
  return cands.filter((c) => c.url && hostOf(c.url) && !isOwnUrl(c.url, own));
}

async function fetchThumb(url: string): Promise<Uint8Array | 'gone' | null> {
  try {
    const res = await fetch(url, { headers: { accept: 'image/*' } });
    if (res.status >= 400 && res.status < 500) return 'gone';
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.length && buf.length <= MAX_THUMB_BYTES ? buf : null;
  } catch {
    return null;
  }
}

async function originalHashes(env: Env, keys: (string | null)[]): Promise<Uint8Array[]> {
  const out: Uint8Array[] = [];
  for (const key of keys) {
    if (!key) continue;
    const obj = await env.MEDIA.get(key);
    if (!obj) continue;
    const h = await pdqOf(env, new Uint8Array(await obj.arrayBuffer()));
    if (h) out.push(h);
  }
  return out;
}

export async function judge(c: Candidate, originals: Uint8Array[], env: Pick<Env, 'IMAGES'>, site: string, at = ''): Promise<Verdict & { retry?: boolean }> {
  if (c.kind === 'exact') return { keep: true, kind: 'exact', score: null, reason: `Lens exact match on ${site}${at}` };
  if (!c.thumbnail) return { keep: false, kind: 'visual', score: null, reason: 'auto: not a copy (no thumbnail to compare)' };
  if (!originals.length) return { keep: false, kind: 'visual', score: null, reason: 'auto: not a copy (original not comparable)', retry: true };
  const bytes = await fetchThumb(c.thumbnail);
  if (bytes === 'gone') return { keep: false, kind: 'visual', score: null, reason: 'auto: not a copy (thumbnail unavailable to compare)' };
  const hash = bytes && (await pdqOf(env, bytes));
  if (!hash) return { keep: false, kind: 'visual', score: null, reason: 'auto: not a copy (thumbnail not comparable)', retry: true };
  const dist = Math.min(...originals.map((o) => pdqDistance(o, hash)));
  const text = `PDQ distance ${dist} of ${PDQ_BITS} vs your original`;
  return dist <= PDQ_MAX_DISTANCE
    ? { keep: true, kind: 'visual', score: dist, reason: `${text} (Lens visual match on ${site}${at})` }
    : { keep: false, kind: 'visual', score: dist, reason: `auto: not a copy (${text})` };
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

export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

type Shot = { key: string; at: string; temp: boolean };

async function videoShots(env: Env, m: Pick<Due, 'id' | 'r2_key' | 'bytes' | 'poster_key'>): Promise<Shot[]> {
  const fallback: Shot[] = m.poster_key ? [{ key: m.poster_key, at: '', temp: false }] : [];
  if (!env.VIDEO || m.bytes >= VIDEO_MAX_INPUT) return fallback;
  const info = await readVideoInfo(env.MEDIA, m.r2_key, m.bytes).catch(() => null);
  if (!info || info.seconds < MIN_FRAME_SECONDS) return fallback;
  const shots: Shot[] = [];
  for (const [i, f] of FRAME_AT.entries()) {
    const sec = Math.round(info.seconds * f * 10) / 10;
    try {
      const jpg = await frame(env, m.r2_key, `${sec}s`);
      if (!jpg) continue;
      const key = `${m.id}-f${i + 1}.jpg`;
      await env.MEDIA.put(key, jpg, { httpMetadata: { contentType: 'image/jpeg' } });
      shots.push({ key, at: `, frame at ${clock(sec)}`, temp: true });
    } catch (e) {
      console.warn('scan: frame failed', m.id, sec, e instanceof Error ? e.message : e);
    }
  }
  return shots.length ? shots : fallback;
}

async function lensCall(env: Env, origin: string, key: string): Promise<unknown> {
  const res = await fetch(`https://serpapi.com/search.json?engine=google_lens&type=exact_matches&url=${encodeURIComponent(`${origin}/media/${key}`)}&api_key=${encodeURIComponent(env.SERP_API_KEY!)}`);
  if (!res.ok && res.status !== 400 && res.status !== 404) throw new Error(`serpapi ${res.status}`);
  return res.json();
}

const liveSql = `u.plan IN ('creator', 'pro') AND (u.plan_until IS NULL OR u.plan_until > ?)`;

type Due = { id: string; post_id: string; user_id: string; r2_key: string; poster_key: string | null; bytes: number; kind: string; post_at: number; plan: string; handle: string | null; links: string; other_handles: string | null; ig_username: string | null };

export async function runScan(env: Env, now = Date.now()) {
  const stats = { scanned: 0, found: 0, failed: 0, stoppedByBudget: false, skipped: 0 };
  if (!env.SERP_API_KEY || !env.PUBLIC_ORIGIN) return { ...stats, off: true };
  const batch = Math.max(1, Number(env.SCAN_BATCH) || 5);
  const due = (await env.DB.prepare(
    `SELECT m.id, m.post_id, m.user_id, m.r2_key, m.poster_key, m.bytes, m.kind, p.created_at AS post_at, u.plan, u.handle, u.links, u.other_handles, il.username AS ig_username
     FROM media m JOIN posts p ON p.id = m.post_id JOIN users u ON u.id = m.user_id
     LEFT JOIN instagram_links il ON il.user_id = m.user_id
     LEFT JOIN scans s ON s.media_id = m.id
     WHERE m.status = 'done' AND ${liveSql} AND (s.media_id IS NULL OR s.next_scan_at <= ?)
     ORDER BY COALESCE(s.next_scan_at, 0), m.id LIMIT ?`,
  ).bind(now, now, batch).all<Due>()).results;
  const origin = env.PUBLIC_ORIGIN.replace(/\/$/, '');

  for (const m of due) {
    const shots: Shot[] = m.kind === 'video' ? await videoShots(env, m) : [{ key: m.r2_key, at: '', temp: false }];
    const key = shots[0]?.key ?? null;
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
    const found = new Map<string, { c: Candidate; at: string }>();
    let answered = 0;
    let budgetHit = false;
    try {
      for (const shot of shots) {
        if (!(await spendCall(env, now))) {
          budgetHit = true;
          break;
        }
        try {
          const json = await lensCall(env, origin, shot.key);
          answered++;
          for (const c of parseLens(json)) if (!found.has(c.url)) found.set(c.url, { c, at: shot.at });
        } catch (e) {
          console.error('scan: lens call failed', m.id, shot.key, e);
        }
      }
      if (budgetHit) {
        console.log('scan: monthly SerpAPI budget reached', limitOf(env));
        stats.stoppedByBudget = true;
      }
      if (!answered) {
        if (budgetHit) break;
        stats.failed++;
        await setNext(now + HOUR, false);
        continue;
      }
      const own = ownAccounts(env, m);
      const atOf = new Map([...found.values()].map((f) => [f.c, f.at]));
      const foreign = keepForeign([...found.values()].map((f) => f.c), own);
      const checkable = foreign.filter((c) => c.kind === 'exact').concat(foreign.filter((c) => c.kind === 'visual').slice(0, MAX_THUMBS));
      const originals = checkable.some((c) => c.kind === 'visual') ? await originalHashes(env, shots.map((s) => s.key)) : [];
      for (let i = 0; i < checkable.length; i += 5) {
        const verdicts = await Promise.all(checkable.slice(i, i + 5).map((c) => judge(c, originals, env, c.source || hostOf(c.url), atOf.get(c))));
        for (const [j, v] of verdicts.entries()) {
          if (!v.keep) continue;
          const c = checkable[i + j];
          const res = await env.DB.prepare(
            'INSERT OR IGNORE INTO matches (id, post_id, user_id, url, page_title, site, thumbnail, found_at, reason, score, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          ).bind(newId(10), m.post_id, m.user_id, c.url, c.title, c.source || hostOf(c.url), c.thumbnail, now, v.reason, v.score, v.kind).run();
          stats.found += res.meta.changes;
        }
      }
    } finally {
      await Promise.all(shots.filter((s) => s.temp).map((s) => env.MEDIA.delete(s.key).catch(() => {})));
    }
    if (budgetHit) {
      await setNext(now + HOUR, true);
      stats.scanned++;
      break;
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

export async function rescoreMatches(env: Env, userId: string, limit = 40) {
  const stats = { checked: 0, kept: 0, dismissed: 0, retry: 0, remaining: 0 };
  const user = await env.DB.prepare(
    `SELECT u.handle, u.links, u.other_handles, il.username AS ig_username FROM users u LEFT JOIN instagram_links il ON il.user_id = u.id WHERE u.id = ?`,
  ).bind(userId).first<{ handle: string | null; links: string; other_handles: string | null; ig_username: string | null }>();
  if (!user) return stats;
  const own = ownAccounts(env, user);
  const rows = (await env.DB.prepare(
    `SELECT id, post_id, url, page_title, site, thumbnail, reason FROM matches WHERE user_id = ? AND status = 'new' AND kind IS NULL ORDER BY found_at, id LIMIT ?`,
  ).bind(userId, limit).all<{ id: string; post_id: string; url: string; page_title: string; site: string; thumbnail: string | null; reason: string }>()).results;
  const hashes = new Map<string, Uint8Array[]>();
  for (const r of rows) {
    stats.checked++;
    const dismiss = (reason: string, kind: string, score: number | null) => {
      stats.dismissed++;
      return env.DB.prepare(`UPDATE matches SET status = 'dismissed', reason = ?, kind = ?, score = ? WHERE id = ?`).bind(reason, kind, score, r.id).run();
    };
    if (isOwnUrl(r.url, own)) {
      await dismiss('auto: not a copy (your own account)', 'own', null);
      continue;
    }
    const kind = / exact match/.test(r.reason) ? 'exact' : 'visual';
    if (kind === 'visual' && !hashes.has(r.post_id)) {
      const media = (await env.DB.prepare(`SELECT kind, r2_key, poster_key FROM media WHERE post_id = ? AND status = 'done'`).bind(r.post_id).all<{ kind: string; r2_key: string; poster_key: string | null }>()).results;
      hashes.set(r.post_id, await originalHashes(env, media.map((x) => (x.kind === 'video' ? x.poster_key : x.r2_key))));
    }
    const site = r.site || hostOf(r.url);
    const v = await judge({ url: r.url, title: r.page_title, source: site, thumbnail: r.thumbnail, kind }, hashes.get(r.post_id) ?? [], env, site);
    if (v.retry) {
      stats.retry++;
      continue;
    }
    if (v.keep) {
      stats.kept++;
      await env.DB.prepare('UPDATE matches SET kind = ?, score = ?, reason = ? WHERE id = ?').bind(v.kind, v.score, v.reason, r.id).run();
    } else {
      await dismiss(v.reason, v.kind, v.score);
    }
  }
  stats.remaining = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM matches WHERE user_id = ? AND status = 'new' AND kind IS NULL`).bind(userId).first<{ n: number }>())?.n ?? 0;
  return stats;
}

scanRoutes.post('/v1/admin/rescore-matches', requireAuth, async (c) => {
  if (!isAdmin(c.env, c.get('user'))) throw fail(403, 'not_admin', 'Only admins can rescore matches.');
  const body = (await c.req.json().catch(() => ({}))) as { userId?: string; handle?: string; limit?: number };
  let userId = body.userId;
  if (!userId && body.handle) {
    userId = (await c.env.DB.prepare('SELECT id FROM users WHERE handle = ?').bind(cleanHandle(body.handle)).first<{ id: string }>())?.id;
  }
  if (!userId) throw fail(404, 'not_found', 'Give a userId or handle of an existing user.');
  return c.json(await rescoreMatches(c.env, userId, Math.min(100, Math.max(1, Number(body.limit) || 40))));
});
