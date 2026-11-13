import { Hono } from 'hono';
import type { AppEnv, Env, UserRow } from './env';
import { requireAuth, requireHandle } from './auth';
import { fail, originOf, readJson } from './http';
import { newId, newToken, sha256Hex } from './crypto';

export { setNet, parseFeed, bskyItems, parseFrom, readSource, decode } from './connectors';
import { connectorList, cleanRules, fromOf, parseFrom, passes, readSource, type Item, type Media, type Rules, type Source } from './connectors';
import { net, typeOf, UA } from './connectors/types';
export type { Item, Media, Source } from './connectors';

type AppFetch = (req: Request, env: Env) => Response | Promise<Response>;
let appFetch: AppFetch | null = null;
export const useApp = (f: AppFetch) => { appFetch = f; };

const MAX_POSTS = 25;
const VIDEO_BUFFER_MAX = 90 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

async function alreadyImported(env: Env, userId: string, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await env.DB.prepare(`SELECT item_id, post_id FROM imported_items WHERE user_id = ? AND item_id IN (${ids.map(() => '?').join(',')})`)
    .bind(userId, ...ids).all<{ item_id: string; post_id: string }>();
  return new Map(rows.results.map((r) => [r.item_id, r.post_id]));
}

type Api = (method: string, path: string, body?: unknown, raw?: BodyInit, headers?: Record<string, string>) => Promise<any>;
function apiFor(env: Env, origin: string, token: string): Api {
  return async (method, path, body, raw, headers = {}) => {
    if (!appFetch) throw new Error('ingest: app not registered');
    const h = new Headers({ ...headers, Authorization: `Bearer ${token}` });
    if (body !== undefined) h.set('Content-Type', 'application/json');
    const res = await appFetch(new Request(origin + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : raw }), env);
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw fail(res.status, json?.error?.code ?? 'failed', json?.error?.message ?? `${method} ${path} failed`);
    return json;
  };
}

async function bringFile(api: Api, m: Media): Promise<string> {
  const res = await net(m.url, { headers: UA });
  if (!res.ok || !res.body) throw new Error(`file answered ${res.status}`);
  let ct = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (ct === 'image/jpg') ct = 'image/jpeg';
  if (ct === 'application/octet-stream' || !ct) ct = m.type === 'video' ? 'video/mp4' : ct;
  if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(ct)) throw new Error(`${ct || 'unknown'} files are not supported`);
  const length = Number(res.headers.get('content-length') ?? '');
  let body: BodyInit; let bytes: number;
  if (VIDEO_TYPES.includes(ct) && Number.isFinite(length) && length > 0) { body = res.body; bytes = length; }
  else {
    if (Number.isFinite(length) && length > VIDEO_BUFFER_MAX) throw new Error('file too large');
    const buf = new Uint8Array(await res.arrayBuffer());
    body = buf; bytes = buf.length;
  }
  const slot = await api('POST', '/v1/uploads', { contentType: ct, bytes });
  await api('PUT', new URL(slot.uploadUrl).pathname, undefined, body, { 'Content-Type': ct, 'Content-Length': String(bytes) });
  return slot.uploadId;
}

export type ImportResult = { imported: { item: string; post: string }[]; skipped: { item: string; why: string }[] };

export async function importItems(env: Env, origin: string, token: string, user: UserRow, source: Source, items: Item[]): Promise<ImportResult> {
  const api = apiFor(env, origin, token);
  const done = await alreadyImported(env, user.id, items.map((i) => i.id));
  const out: ImportResult = { imported: [], skipped: [] };
  for (const it of items.slice(0, MAX_POSTS)) {
    if (done.has(it.id)) { out.skipped.push({ item: it.url || it.id, why: `already on Emera as ${done.get(it.id)}` }); continue; }
    const ids: string[] = []; const alt: Record<string, string> = {};
    const why: string[] = [];
    for (const m of it.media) {
      try { const id = await bringFile(api, m); ids.push(id); if (m.alt) alt[id] = m.alt.slice(0, 1000); } catch (e) { why.push(e instanceof Error ? e.message : String(e)); }
    }
    if (!ids.length) { out.skipped.push({ item: it.url || it.id, why: why[0] ?? 'no photos or videos in it' }); continue; }
    const created = it.createdAt && Date.parse(it.createdAt) < Date.now() ? it.createdAt : undefined;
    try {
      const { post } = await api('POST', '/v1/posts', { mediaIds: ids, caption: it.caption, alt, ...(created ? { createdAt: created } : {}) });
      await env.DB.prepare('INSERT OR IGNORE INTO imported_items (user_id, item_id, source, post_id, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(user.id, it.id, `${source.kind}:${source.spec}`, post.id, Date.now()).run();
      out.imported.push({ item: it.url || it.id, post: post.id });
    } catch (e) { out.skipped.push({ item: it.url || it.id, why: e instanceof Error ? e.message : String(e) }); }
  }
  return out;
}

export async function previewItems(env: Env, userId: string, items: Item[]) {
  const done = await alreadyImported(env, userId, items.map((i) => i.id));
  return items.map((i) => ({ id: i.id, url: i.url, date: i.createdAt, caption: i.caption.slice(0, 200), photos: i.media.filter((m) => m.type === 'image').length, videos: i.media.filter((m) => m.type === 'video').length, thumb: i.media.find((m) => m.type === 'image')?.url ?? null, onEmera: done.get(i.id) ?? null }));
}

export async function postFromUrls(env: Env, origin: string, token: string, urls: string[], caption: string, createdAt?: string) {
  const api = apiFor(env, origin, token);
  const ids: string[] = [];
  for (const u of urls.slice(0, 10)) {
    let url: URL;
    try { url = new URL(u); } catch { throw fail(400, 'bad_url', `${u} is not a link.`); }
    if (url.protocol !== 'https:') throw fail(400, 'bad_url', 'Use https links to the photos or videos.');
    try { ids.push(await bringFile(api, { url: url.toString(), type: typeOf(url.toString()), alt: '' })); } catch (e) { throw fail(422, 'bad_file', `${u}: ${e instanceof Error ? e.message : e}`); }
  }
  if (!ids.length) throw fail(400, 'bad_media', 'Give 1 to 10 links to photos or videos.');
  return (await api('POST', '/v1/posts', { mediaIds: ids, caption, ...(createdAt ? { createdAt } : {}) })).post;
}

export type SourceRow = { id: string; user_id: string; kind: string; spec: string; label: string; auto: number; rules: string | null; since: number; last_checked: number | null; last_error: string | null; created_at: number };
export const rulesOf = (s: SourceRow): Rules => { try { return cleanRules(JSON.parse(s.rules ?? '{}')); } catch { return { media: 'any' }; } };
export const sourceJson = (s: SourceRow) => ({ id: s.id, from: fromOf(s), kind: s.kind, label: s.label, autoPost: !!s.auto, rules: rulesOf(s), since: new Date(s.since).toISOString(), lastChecked: s.last_checked ? new Date(s.last_checked).toISOString() : null, lastError: s.last_error });

export async function setAuto(env: Env, userId: string, source: Source, on: boolean, rules?: Rules): Promise<SourceRow> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO sources (id, user_id, kind, spec, label, auto, rules, since, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, kind, spec) DO UPDATE SET auto = excluded.auto, rules = COALESCE(excluded.rules, sources.rules), since = CASE WHEN excluded.auto = 1 AND sources.auto = 0 THEN excluded.since ELSE sources.since END, last_error = NULL`,
  ).bind(newId(10), userId, source.kind, source.spec, source.label, on ? 1 : 0, rules ? JSON.stringify(rules) : null, now, now).run();
  return (await env.DB.prepare('SELECT * FROM sources WHERE user_id = ? AND kind = ? AND spec = ?').bind(userId, source.kind, source.spec).first<SourceRow>())!;
}

export const listSources = async (env: Env, userId: string) =>
  (await env.DB.prepare('SELECT * FROM sources WHERE user_id = ? ORDER BY created_at').bind(userId).all<SourceRow>()).results;

export async function runAutoImports(env: Env, origin: string, max = 40) {
  const due = (await env.DB.prepare('SELECT * FROM sources WHERE auto = 1 ORDER BY COALESCE(last_checked, 0) LIMIT ?').bind(max).all<SourceRow>()).results;
  const report: { source: string; imported: number; error?: string }[] = [];
  for (const s of due) {
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(s.user_id).first<UserRow>();
    if (!user?.handle) continue;
    const token = newToken();
    const now = Date.now();
    await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, client_id) VALUES (?, ?, ?, ?, ?)').bind(await sha256Hex(token), user.id, now, now + 10 * 60_000, 'auto-import').run();
    try {
      const items = (await readSource(s, 10)).filter((i) => i.createdAt && Date.parse(i.createdAt) > s.since && passes(i, rulesOf(s)));
      const r = await importItems(env, origin, token, user, s, items);
      await env.DB.prepare('UPDATE sources SET last_checked = ?, last_error = NULL WHERE id = ?').bind(now, s.id).run();
      report.push({ source: s.label, imported: r.imported.length });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await env.DB.prepare('UPDATE sources SET last_checked = ?, last_error = ? WHERE id = ?').bind(now, msg.slice(0, 300), s.id).run();
      report.push({ source: s.label, imported: 0, error: msg });
    } finally {
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
    }
  }
  return report;
}

const bearer = (h: string | undefined) => (h?.startsWith('Bearer ') ? h.slice(7).trim() : '');
const limitOf = (v: unknown, def: number, max: number) => Math.max(1, Math.min(max, Number.isInteger(v) ? (v as number) : def));

export const ingestRoutes = new Hono<AppEnv>();

ingestRoutes.get('/v1/connectors', (c) => c.json(connectorList()));

ingestRoutes.post('/v1/import/preview', requireAuth, async (c) => {
  const body = await readJson(c);
  const source = parseFrom(String(body.from ?? ''));
  const items = await readSource(source, limitOf(body.limit, 12, 50));
  return c.json({ source: { from: fromOf(source), kind: source.kind, label: source.label }, items: await previewItems(c.env, c.get('user').id, items) });
});

ingestRoutes.post('/v1/import', requireAuth, requireHandle, async (c) => {
  const body = await readJson(c);
  const source = parseFrom(String(body.from ?? ''));
  const only = Array.isArray(body.only) ? new Set(body.only.map(String)) : null;
  let items = await readSource(source, only ? 50 : limitOf(body.limit, 10, MAX_POSTS));
  if (only) items = items.filter((i) => only.has(i.id));
  const r = await importItems(c.env, originOf(c), bearer(c.req.header('Authorization')), c.get('user'), source, items);
  if (body.autoPost === true) await setAuto(c.env, c.get('user').id, source, true, body.rules === undefined ? undefined : cleanRules(body.rules));
  return c.json(r);
});

ingestRoutes.get('/v1/sources', requireAuth, async (c) => c.json({ sources: (await listSources(c.env, c.get('user').id)).map(sourceJson) }));

ingestRoutes.post('/v1/sources', requireAuth, requireHandle, async (c) => {
  const body = await readJson(c);
  const source = parseFrom(String(body.from ?? ''));
  if (body.autoPost !== false) await readSource(source, 1);
  const rules = body.rules === undefined ? undefined : cleanRules(body.rules);
  return c.json({ source: sourceJson(await setAuto(c.env, c.get('user').id, source, body.autoPost !== false, rules)) });
});

ingestRoutes.delete('/v1/sources/:id', requireAuth, async (c) => {
  await c.env.DB.prepare('DELETE FROM sources WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});
