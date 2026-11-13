import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv, Env, UserRow } from './env';
import { ApiError, originOf } from './http';
import { resourceMetadataUrl, userForToken } from './oauth';
import { importItems, listSources, parseFrom, postFromUrls, previewItems, readSource, setAuto, sourceJson } from './ingest';
import { BRAND } from './brand';

const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const str = (description: string) => ({ type: 'string', description });
const int = (description: string, max: number) => ({ type: 'integer', minimum: 1, maximum: max, description });
const FROM = str('Where to import from: a Bluesky handle (@name.bsky.social), a Mastodon or Pixelfed profile link, or any RSS / Atom feed link');

const TOOLS = [
  { name: 'whoami', description: `Show which ${BRAND.name} account this is connected to, with its profile link and post count.`, inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'preview_import', description: 'List the recent posts with photos or videos at a source, and which are already on Emera. Nothing is posted. Run this first and show the person what will come over.', inputSchema: { type: 'object', properties: { from: FROM, limit: int('How many recent posts to look at, default 12', 50) }, required: ['from'] }, annotations: { readOnlyHint: true } },
  { name: 'import_posts', description: 'Copy posts from a source to Emera, keeping their photos, videos, captions and original dates. Posts already imported are skipped, so it is safe to run again. Up to 25 per call.', inputSchema: { type: 'object', properties: { from: FROM, limit: int('How many of the most recent posts, default 10', 25), only: { type: 'array', items: { type: 'string' }, description: 'Only these item ids from preview_import' }, auto_post: { type: 'boolean', description: 'Also post new ones from this source automatically from now on' } }, required: ['from'] } },
  { name: 'auto_post', description: 'Turn automatic posting on or off for a source. When on, Emera checks it every 15 minutes and posts anything new made after this moment. Older posts are not touched; use import_posts for those.', inputSchema: { type: 'object', properties: { from: FROM, on: { type: 'boolean', description: 'true to turn it on, false to turn it off' } }, required: ['from', 'on'] } },
  { name: 'list_connections', description: 'List the sources connected to this account and whether auto-post is on for each.', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'create_post', description: 'Post 1 to 10 photos or videos to Emera from public https links, with a caption.', inputSchema: { type: 'object', properties: { media_urls: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10, description: 'Public https links to jpeg, png, webp, heic, mp4 or mov files' }, caption: str('The caption, up to 2200 characters'), created_at: str('Optional ISO date if the work was made earlier') }, required: ['media_urls'] } },
  { name: 'list_my_posts', description: 'List this account\'s latest posts with links.', inputSchema: { type: 'object', properties: { limit: int('How many, default 10', 50) } }, annotations: { readOnlyHint: true } },
];

type Ctx = { env: Env; origin: string; token: string; user: UserRow; site: string };
const text = (t: string, data?: unknown) => ({ content: [{ type: 'text', text: t }], ...(data !== undefined ? { structuredContent: data } : {}) });
const postLink = (x: Ctx, id: string) => `${x.site}/p/${id}`;

async function call(x: Ctx, name: string, a: Record<string, any>) {
  if (name === 'whoami') {
    const n = await x.env.DB.prepare('SELECT COUNT(*) AS n FROM posts WHERE user_id = ?').bind(x.user.id).first<{ n: number }>();
    return text(x.user.handle ? `Connected as @${x.user.handle} (${x.user.display_name}). ${n?.n ?? 0} posts. Profile: ${x.site}/@${x.user.handle}` : 'Signed in, but no handle yet. Finish sign-up in the Emera app first.', { handle: x.user.handle, posts: n?.n ?? 0 });
  }
  if (name === 'preview_import') {
    const s = parseFrom(String(a.from ?? ''));
    const items = await previewItems(x.env, x.user.id, await readSource(s, Math.min(50, Number(a.limit) || 12)));
    const lines = items.map((i, k) => `${k + 1}. ${i.date?.slice(0, 10) ?? 'no date'} - ${i.photos} photo${i.photos === 1 ? '' : 's'}${i.videos ? `, ${i.videos} video` : ''} - ${i.caption.replace(/\s+/g, ' ').slice(0, 80) || '(no caption)'}${i.onEmera ? ' - already on Emera' : ''}\n   id: ${i.id}`);
    return text(items.length ? `${items.length} posts with photos or videos at ${s.label}:\n${lines.join('\n')}` : `No posts with photos or videos found at ${s.label}.`, { source: s.label, items });
  }
  if (name === 'import_posts') {
    const s = parseFrom(String(a.from ?? ''));
    const only = Array.isArray(a.only) ? new Set(a.only.map(String)) : null;
    let items = await readSource(s, only ? 50 : Math.min(25, Number(a.limit) || 10));
    if (only) items = items.filter((i) => only.has(i.id));
    const r = await importItems(x.env, x.origin, x.token, x.user, s, items);
    if (a.auto_post === true) await setAuto(x.env, x.user.id, s, true);
    const out = [`Imported ${r.imported.length} post${r.imported.length === 1 ? '' : 's'} from ${s.label}.`, ...r.imported.map((i) => `- ${postLink(x, i.post)}`)];
    if (r.skipped.length) out.push(`Skipped ${r.skipped.length}:`, ...r.skipped.map((i) => `- ${i.item}: ${i.why}`));
    if (a.auto_post === true) out.push('Auto-post is on: new posts there will come over every 15 minutes.');
    return text(out.join('\n'), r);
  }
  if (name === 'auto_post') {
    const s = parseFrom(String(a.from ?? ''));
    if (a.on) await readSource(s, 1);
    const row = await setAuto(x.env, x.user.id, s, !!a.on);
    return text(a.on ? `Auto-post is on for ${s.label}. Anything new posted there from now on shows up on Emera within 15 minutes.` : `Auto-post is off for ${s.label}.`, sourceJson(row));
  }
  if (name === 'list_connections') {
    const rows = (await listSources(x.env, x.user.id)).map(sourceJson);
    return text(rows.length ? rows.map((r) => `- ${r.label}: auto-post ${r.autoPost ? 'on' : 'off'}${r.lastError ? ` (last check failed: ${r.lastError})` : ''}`).join('\n') : 'No sources connected yet.', { sources: rows });
  }
  if (name === 'create_post') {
    const urls = Array.isArray(a.media_urls) ? a.media_urls.map(String) : [];
    const post = await postFromUrls(x.env, x.origin, x.token, urls, typeof a.caption === 'string' ? a.caption.slice(0, 2200) : '', typeof a.created_at === 'string' ? a.created_at : undefined);
    return text(`Posted: ${postLink(x, post.id)}`, { id: post.id, url: postLink(x, post.id) });
  }
  if (name === 'list_my_posts') {
    const rows = await x.env.DB.prepare('SELECT id, caption, created_at FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').bind(x.user.id, Math.min(50, Number(a.limit) || 10)).all<{ id: string; caption: string; created_at: number }>();
    return text(rows.results.map((p) => `- ${new Date(p.created_at).toISOString().slice(0, 10)} ${postLink(x, p.id)} ${p.caption.replace(/\s+/g, ' ').slice(0, 60)}`).join('\n') || 'No posts yet.', { posts: rows.results });
  }
  throw new RpcError(-32602, `Unknown tool ${name}`);
}

class RpcError extends Error { constructor(public code: number, message: string) { super(message); } }

async function handle(x: Ctx, msg: any) {
  const { id, method, params } = msg ?? {};
  if (method === 'initialize') {
    const v = VERSIONS.includes(params?.protocolVersion) ? params.protocolVersion : VERSIONS[1];
    return { protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'emera', title: BRAND.name, version: '1.0.0' }, instructions: `${BRAND.name} is ${BRAND.line.toLowerCase()}. Use preview_import before import_posts so the person sees what comes over, then import. Offer auto_post so new posts keep flowing.` };
  }
  if (method === 'ping') return {};
  if (method === 'tools/list') return { tools: TOOLS };
  if (method === 'tools/call') {
    if (!x.user.handle && params?.name !== 'whoami') return text('Finish sign-up in the Emera app first (pick a handle).');
    try { return await call(x, String(params?.name), params?.arguments ?? {}); }
    catch (e) {
      if (e instanceof RpcError) throw e;
      return { ...text(e instanceof ApiError ? e.message : `Something went wrong: ${e instanceof Error ? e.message : e}`), isError: true };
    }
  }
  if (id === undefined) return undefined;
  throw new RpcError(-32601, `Method not found: ${method}`);
}

export const mcpRoutes = new Hono<AppEnv>();
mcpRoutes.use('/mcp', cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type', 'Mcp-Session-Id', 'Mcp-Protocol-Version'], exposeHeaders: ['WWW-Authenticate', 'Mcp-Session-Id'], allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'] }));

mcpRoutes.post('/mcp', async (c) => {
  const h = c.req.header('Authorization') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  const user = await userForToken(c.env, token);
  if (!user) return c.json({ error: 'invalid_token', error_description: 'Connect your Emera account first.' }, 401, { 'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl(originOf(c))}"` });
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); }
  const x: Ctx = { env: c.env, origin: originOf(c), token, user, site: (c.env.PUBLIC_ORIGIN || originOf(c)).replace(/\/$/, '') };
  const one = async (m: any) => {
    try {
      const result = await handle(x, m);
      return m?.id === undefined ? undefined : { jsonrpc: '2.0', id: m.id, result };
    } catch (e) {
      return m?.id === undefined ? undefined : { jsonrpc: '2.0', id: m.id, error: { code: e instanceof RpcError ? e.code : -32603, message: e instanceof Error ? e.message : String(e) } };
    }
  };
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(one))).filter(Boolean);
    return out.length ? c.json(out) : c.body(null, 202);
  }
  const out = await one(body);
  return out ? c.json(out) : c.body(null, 202);
});

mcpRoutes.on(['GET', 'DELETE'], '/mcp', (c) => c.body(null, 405, { Allow: 'POST' }));
