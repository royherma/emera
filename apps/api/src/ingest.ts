import { Hono } from 'hono';
import type { AppEnv, Env, UserRow } from './env';
import { requireAuth, requireHandle } from './auth';
import { fail, originOf, readJson } from './http';
import { newId, newToken, sha256Hex } from './crypto';

export type Media = { url: string; type: 'image' | 'video' | null; alt: string };
export type Item = { id: string; url: string; caption: string; createdAt: string | null; media: Media[] };
export type Source = { kind: 'bluesky' | 'feed'; spec: string; label: string };

type AppFetch = (req: Request, env: Env) => Response | Promise<Response>;
let appFetch: AppFetch | null = null;
export const useApp = (f: AppFetch) => { appFetch = f; };

let net: typeof fetch = (input, init) => fetch(input, init);
export const setNet = (f: typeof fetch) => { net = f; };

const UA = { 'User-Agent': 'EmeraImporter/1.0 (+https://emera.social)' };
const BSKY = 'https://public.api.bsky.app/xrpc';
const MAX_POSTS = 25;
const VIDEO_BUFFER_MAX = 90 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

const LOCKED: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, 'Instagram does not share posts with other apps. Download your data from Instagram and bring the zip in with the Emera importer.'],
  [/(^|\.)tiktok\.com$/, 'TikTok does not share posts with other apps. Download your data from TikTok and bring the videos in one by one.'],
  [/(^|\.)(x|twitter)\.com$/, 'X does not share posts with other apps for free.'],
  [/(^|\.)facebook\.com$/, 'Facebook does not share posts with other apps.'],
];

export function parseFrom(raw: string): Source {
  const s = raw.trim();
  if (!s) throw fail(400, 'bad_source', 'Say where to import from: a Bluesky handle or a link to your feed or profile.');
  const bsky = /^(?:https?:\/\/(?:www\.)?bsky\.app\/profile\/)?@?((?:did:plc:[a-z0-9]+)|(?:[a-z0-9-]+\.)+[a-z]{2,})\/?$/i.exec(s);
  if (bsky && (/bsky\.app/i.test(s) || /^@|^did:/i.test(s) || /\.bsky\.social\/?$/i.test(s))) return { kind: 'bluesky', spec: bsky[1].toLowerCase(), label: `@${bsky[1].toLowerCase()} on Bluesky` };
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { throw fail(400, 'bad_source', 'That is not a link or a Bluesky handle.'); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw fail(400, 'bad_source', 'Use an https link.');
  for (const [re, why] of LOCKED) if (re.test(url.hostname)) throw fail(422, 'source_locked', why);
  if (/^\/@[^/]+\/?$/.test(url.pathname) && !url.pathname.endsWith('.rss')) url.pathname = url.pathname.replace(/\/?$/, '.rss');
  return { kind: 'feed', spec: url.toString(), label: url.hostname + url.pathname.replace(/\/$/, '') };
}

async function getJson(url: string): Promise<any> {
  const res = await net(url, { headers: UA });
  if (!res.ok) throw fail(502, 'source_failed', `The source answered ${res.status}.`);
  return res.json();
}

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : entities[e.toLowerCase()] ?? m);
const textOf = (html: string) => decode(decode(html)
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n\n').replace(/<[^>]+>/g, ''))
  .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
const tag = (block: string, name: string) => { const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block); return m ? m[1] : ''; };
const attr = (t: string, name: string) => { const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(t); return m ? decode(m[2] ?? m[3]) : ''; };

function typeOf(url: string, declared = ''): Media['type'] {
  const d = declared.toLowerCase();
  if (d.startsWith('image') || d === 'image') return 'image';
  if (d.startsWith('video') || d === 'video') return 'video';
  const ext = new URL(url).pathname.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'm4v'].includes(ext)) return 'video';
  return null;
}

export function parseFeed(xml: string, base: string): Item[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return blocks.map((b) => {
    const abs = (u: string) => { try { return new URL(u, base).toString(); } catch { return ''; } };
    const linkTag = /<link\b[^>]*rel=["']alternate["'][^>]*>/i.exec(b)?.[0] ?? /<link\b[^>]*href=[^>]*>/i.exec(b)?.[0] ?? '';
    const link = abs(decode(tag(b, 'link').trim()) || attr(linkTag, 'href'));
    const body = tag(b, 'content:encoded') || tag(b, 'description') || tag(b, 'content') || tag(b, 'summary');
    const title = textOf(tag(b, 'title'));
    const text = textOf(body);
    const media: Media[] = [];
    const seen = new Set<string>();
    const add = (u: string, t: string, alt = '') => { const url = abs(u); if (!url || seen.has(url)) return; seen.add(url); media.push({ url, type: typeOf(url, t), alt }); };
    for (const m of b.match(/<media:content\b[^>]*>/gi) ?? []) add(attr(m, 'url'), attr(m, 'type') || attr(m, 'medium'), textOf(tag(b, 'media:description')));
    for (const m of b.match(/<enclosure\b[^>]*>/gi) ?? []) add(attr(m, 'url'), attr(m, 'type'));
    for (const m of decode(body).match(/<img\b[^>]*>/gi) ?? []) add(attr(m, 'src'), 'image', attr(m, 'alt'));
    const date = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date');
    const t = Date.parse(decode(date).trim());
    return {
      id: `feed:${decode(tag(b, 'guid') || tag(b, 'id')).trim() || link}`,
      url: link,
      caption: (text && title && !text.startsWith(title) ? `${title}\n\n${text}` : text || title).slice(0, 2200),
      createdAt: Number.isFinite(t) ? new Date(t).toISOString() : null,
      media: media.filter((m) => m.type).slice(0, 10),
    };
  });
}

async function readFeed(spec: string, limit: number): Promise<Item[]> {
  let res = await net(spec, { headers: { ...UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html' } });
  if (!res.ok) throw fail(502, 'source_failed', `That link answered ${res.status}.`);
  let body = await res.text();
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(body)) {
    const alt = (body.match(/<link\b[^>]*>/gi) ?? []).find((l) => /rel=["']?alternate/i.test(l) && /(rss|atom)\+xml/i.test(l));
    if (!alt) throw fail(422, 'no_feed', 'That page has no feed to read. Paste your RSS or Atom feed link instead.');
    const next = new URL(attr(alt, 'href'), spec).toString();
    res = await net(next, { headers: UA });
    if (!res.ok) throw fail(502, 'source_failed', `The feed answered ${res.status}.`);
    body = await res.text();
    spec = next;
  }
  return parseFeed(body, spec).filter((i) => i.media.length).slice(0, limit);
}

async function pdsOf(did: string): Promise<string | null> {
  if (!did.startsWith('did:plc:')) return null;
  const doc = await getJson(`https://plc.directory/${did}`).catch(() => null);
  return doc?.service?.find((s: any) => s.type === 'AtprotoPersonalDataServer')?.serviceEndpoint ?? null;
}

export function bskyItems(feed: any[], did: string, pds: string | null): Item[] {
  const out: Item[] = [];
  for (const f of feed) {
    const p = f.post;
    if (f.reason || !p || p.author?.did !== did) continue;
    const e = p.embed?.$type === 'app.bsky.embed.recordWithMedia#view' ? p.embed.media : p.embed;
    const media: Media[] = [];
    if (e?.$type === 'app.bsky.embed.images#view') for (const im of e.images ?? []) media.push({ url: im.fullsize, type: 'image', alt: im.alt ?? '' });
    if (e?.$type === 'app.bsky.embed.video#view' && pds && e.cid) media.push({ url: `${pds.replace(/\/$/, '')}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${e.cid}`, type: 'video', alt: e.alt ?? '' });
    if (!media.length) continue;
    const rkey = String(p.uri).split('/').pop();
    out.push({ id: `bsky:${p.uri}`, url: `https://bsky.app/profile/${p.author.handle}/post/${rkey}`, caption: String(p.record?.text ?? '').slice(0, 2200), createdAt: p.record?.createdAt ?? p.indexedAt ?? null, media });
  }
  return out;
}

async function readBluesky(spec: string, limit: number): Promise<Item[]> {
  const profile = await getJson(`${BSKY}/app.bsky.actor.getProfile?actor=${encodeURIComponent(spec)}`).catch(() => null);
  if (!profile?.did) throw fail(404, 'source_not_found', `No Bluesky account called ${spec}.`);
  const pds = await pdsOf(profile.did);
  const items: Item[] = [];
  let cursor = '';
  for (let page = 0; page < 5 && items.length < limit; page++) {
    const r = await getJson(`${BSKY}/app.bsky.feed.getAuthorFeed?actor=${profile.did}&filter=posts_with_media&limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    items.push(...bskyItems(r.feed ?? [], profile.did, pds));
    if (!r.cursor) break;
    cursor = r.cursor;
  }
  return items.slice(0, limit);
}

export const readSource = (s: Source, limit: number) => (s.kind === 'bluesky' ? readBluesky(s.spec, limit) : readFeed(s.spec, limit));

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
  return items.map((i) => ({ id: i.id, url: i.url, date: i.createdAt, caption: i.caption.slice(0, 200), photos: i.media.filter((m) => m.type === 'image').length, videos: i.media.filter((m) => m.type === 'video').length, onEmera: done.get(i.id) ?? null }));
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

export type SourceRow = { id: string; user_id: string; kind: Source['kind']; spec: string; label: string; auto: number; since: number; last_checked: number | null; last_error: string | null; created_at: number };
export const sourceJson = (s: SourceRow) => ({ id: s.id, from: s.kind === 'bluesky' ? `@${s.spec}` : s.spec, label: s.label, autoPost: !!s.auto, since: new Date(s.since).toISOString(), lastChecked: s.last_checked ? new Date(s.last_checked).toISOString() : null, lastError: s.last_error });

export async function setAuto(env: Env, userId: string, source: Source, on: boolean): Promise<SourceRow> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO sources (id, user_id, kind, spec, label, auto, since, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, kind, spec) DO UPDATE SET auto = excluded.auto, since = CASE WHEN excluded.auto = 1 AND sources.auto = 0 THEN excluded.since ELSE sources.since END, last_error = NULL`,
  ).bind(newId(10), userId, source.kind, source.spec, source.label, on ? 1 : 0, now, now).run();
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
      const items = (await readSource(s, 10)).filter((i) => i.createdAt && Date.parse(i.createdAt) > s.since);
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

ingestRoutes.post('/v1/import/preview', requireAuth, async (c) => {
  const body = await readJson(c);
  const source = parseFrom(String(body.from ?? ''));
  const items = await readSource(source, limitOf(body.limit, 12, 50));
  return c.json({ source: { from: source.kind === 'bluesky' ? `@${source.spec}` : source.spec, label: source.label }, items: await previewItems(c.env, c.get('user').id, items) });
});

ingestRoutes.post('/v1/import', requireAuth, requireHandle, async (c) => {
  const body = await readJson(c);
  const source = parseFrom(String(body.from ?? ''));
  const only = Array.isArray(body.only) ? new Set(body.only.map(String)) : null;
  let items = await readSource(source, only ? 50 : limitOf(body.limit, 10, MAX_POSTS));
  if (only) items = items.filter((i) => only.has(i.id));
  const r = await importItems(c.env, originOf(c), bearer(c.req.header('Authorization')), c.get('user'), source, items);
  if (body.autoPost === true) await setAuto(c.env, c.get('user').id, source, true);
  return c.json(r);
});

ingestRoutes.get('/v1/sources', requireAuth, async (c) => c.json({ sources: (await listSources(c.env, c.get('user').id)).map(sourceJson) }));

ingestRoutes.post('/v1/sources', requireAuth, requireHandle, async (c) => {
  const body = await readJson(c);
  const source = parseFrom(String(body.from ?? ''));
  if (body.autoPost !== false) await readSource(source, 1);
  return c.json({ source: sourceJson(await setAuto(c.env, c.get('user').id, source, body.autoPost !== false)) });
});

ingestRoutes.delete('/v1/sources/:id', requireAuth, async (c) => {
  await c.env.DB.prepare('DELETE FROM sources WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});
