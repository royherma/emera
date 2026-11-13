import { afterEach, describe, expect, it } from 'vitest';
import { Client, ORIGIN, makeEnv, pngBytes } from './helpers';
import { bskyItems, parseFeed, parseFrom, runAutoImports, setNet } from '../src/ingest';

const FEED = (items: { guid: string; date: string; text: string; img: string }[]) => `<?xml version="1.0"?><rss xmlns:media="http://search.yahoo.com/mrss/"><channel><title>t</title>
${items.map((i) => `<item><guid>${i.guid}</guid><link>https://pix.test/p/${i.guid}</link><pubDate>${i.date}</pubDate><description>&lt;p&gt;${i.text} &amp;amp; more&lt;/p&gt;</description><media:content url="${i.img}" type="image/png" medium="image"/></item>`).join('')}
</channel></rss>`;

let feedXml = '';
const png = pngBytes(12, 9);
function fakeNet() {
  setNet((async (input: RequestInfo | URL) => {
    const u = String(input instanceof Request ? input.url : input);
    if (u.startsWith('https://pix.test/feed')) return new Response(feedXml, { headers: { 'Content-Type': 'application/rss+xml' } });
    if (u.startsWith('https://pix.test/img/')) return new Response(png, { headers: { 'Content-Type': 'image/png', 'Content-Length': String(png.length) } });
    return new Response('nope', { status: 404 });
  }) as typeof fetch);
}
afterEach(() => setNet((i, init) => fetch(i, init)));

async function connect(c: Client) {
  const reg = await c.json('POST', '/oauth/register', { client_name: 'Claude', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] });
  expect(reg.status).toBe(201);
  const verifier = 'v'.repeat(50);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const q = new URLSearchParams({ response_type: 'code', client_id: reg.body.client_id, redirect_uri: 'https://claude.ai/api/mcp/auth_callback', code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz' });
  const page = await c.call('GET', `/oauth/authorize?${q}`);
  expect(page.status).toBe(200);
  expect(await page.text()).toContain('Connect Claude');
  const approve = await c.json('POST', '/oauth/approve', { client_id: reg.body.client_id, redirect_uri: 'https://claude.ai/api/mcp/auth_callback', code_challenge: challenge, state: 'xyz' });
  expect(approve.status).toBe(200);
  const back = new URL(approve.body.redirect);
  expect(back.searchParams.get('state')).toBe('xyz');
  const form = (o: Record<string, string>) => new Request(`${ORIGIN}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o) });
  const { default: worker } = await import('../src/index');
  const bad = await worker.fetch!(form({ grant_type: 'authorization_code', code: back.searchParams.get('code')!, code_verifier: 'wrong', client_id: reg.body.client_id }) as any, c.env, {} as any);
  expect(bad.status).toBe(400);
  return { reg, challenge, verifier, worker, form };
}

async function rpc(c: Client, token: string, method: string, params?: unknown) {
  const saved = c.token; c.token = token;
  const res = await c.json('POST', '/mcp', { jsonrpc: '2.0', id: 1, method, params });
  c.token = saved;
  return res;
}

describe('sources', () => {
  it('tells Bluesky handles, feeds and locked platforms apart', () => {
    expect(parseFrom('@roy.bsky.social')).toMatchObject({ kind: 'bluesky', spec: 'roy.bsky.social' });
    expect(parseFrom('https://bsky.app/profile/Roy.Example.com')).toMatchObject({ kind: 'bluesky', spec: 'roy.example.com' });
    expect(parseFrom('roy.bsky.social').kind).toBe('bluesky');
    expect(parseFrom('example.com')).toMatchObject({ kind: 'feed', spec: 'https://example.com/' });
    expect(parseFrom('https://mastodon.social/@roy').spec).toBe('https://mastodon.social/@roy.rss');
    expect(() => parseFrom('https://www.instagram.com/roy/')).toThrow(/Instagram/);
  });

  it('reads an RSS item with its photo, caption and date', () => {
    const [it] = parseFeed(FEED([{ guid: 'a1', date: 'Tue, 10 Nov 2026 08:00:00 GMT', text: 'Clay bowl', img: 'https://pix.test/img/1.png' }]), 'https://pix.test/feed');
    expect(it).toMatchObject({ id: 'feed:a1', url: 'https://pix.test/p/a1', caption: 'Clay bowl & more', createdAt: '2026-11-10T08:00:00.000Z' });
    expect(it.media).toEqual([{ url: 'https://pix.test/img/1.png', type: 'image', alt: '' }]);
  });

  it('reads Bluesky posts with images and video, skipping reposts and other authors', () => {
    const post = (uri: string, did: string, embed: unknown) => ({ post: { uri, author: { did, handle: 'roy.bsky.social' }, record: { text: 'hi', createdAt: '2026-11-01T00:00:00Z' }, embed } });
    const items = bskyItems([
      post('at://did:plc:me/app.bsky.feed.post/1', 'did:plc:me', { $type: 'app.bsky.embed.images#view', images: [{ fullsize: 'https://cdn.bsky.app/x.jpg', alt: 'a pot' }] }),
      post('at://did:plc:me/app.bsky.feed.post/2', 'did:plc:me', { $type: 'app.bsky.embed.video#view', cid: 'bafy' }),
      { ...post('at://did:plc:other/app.bsky.feed.post/3', 'did:plc:other', { $type: 'app.bsky.embed.images#view', images: [{ fullsize: 'https://cdn.bsky.app/y.jpg' }] }), reason: { $type: 'repost' } },
    ], 'did:plc:me', 'https://pds.test');
    expect(items.map((i) => i.url)).toEqual(['https://bsky.app/profile/roy.bsky.social/post/1', 'https://bsky.app/profile/roy.bsky.social/post/2']);
    expect(items[0].media[0]).toEqual({ url: 'https://cdn.bsky.app/x.jpg', type: 'image', alt: 'a pot' });
    expect(items[1].media[0].url).toBe('https://pds.test/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Ame&cid=bafy');
  });
});

describe('connect an AI app with OAuth, then import over MCP', () => {
  it('asks for sign-in with resource metadata when there is no token', async () => {
    const c = new Client();
    const res = await c.call('POST', '/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain('/.well-known/oauth-protected-resource');
    const meta = await c.json('GET', '/.well-known/oauth-authorization-server');
    expect(meta.body).toMatchObject({ registration_endpoint: `${ORIGIN}/oauth/register`, code_challenge_methods_supported: ['S256'] });
    expect((await c.json('GET', '/.well-known/oauth-protected-resource')).body.resource).toBe(`${ORIGIN}/mcp`);
  });

  it('runs the full flow: register, approve, PKCE token, tools, import, dedup, refresh', async () => {
    fakeNet();
    feedXml = FEED([
      { guid: 'b1', date: 'Tue, 10 Nov 2026 08:00:00 GMT', text: 'First kiln', img: 'https://pix.test/img/1.png' },
      { guid: 'b2', date: 'Wed, 11 Nov 2026 08:00:00 GMT', text: 'Second kiln', img: 'https://pix.test/img/2.png' },
    ]);
    const c = new Client();
    await c.signIn('mcp@example.test');
    await c.withHandle('mcpuser', 'MCP User');
    const { reg, verifier, worker, form } = await connect(c);

    c.token = null;
    await c.signIn('mcp@example.test');
    const appr = await c.json('POST', '/oauth/approve', { client_id: reg.body.client_id, redirect_uri: 'https://claude.ai/api/mcp/auth_callback', code_challenge: await (async () => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''))() });
    const code = new URL(appr.body.redirect).searchParams.get('code')!;
    expect((await c.json('GET', '/v1/me')).status).toBe(401);
    const tok = await worker.fetch!(form({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: reg.body.client_id, redirect_uri: 'https://claude.ai/api/mcp/auth_callback' }) as any, c.env, {} as any);
    expect(tok.status).toBe(200);
    const t = (await tok.json()) as any;
    expect(t).toMatchObject({ token_type: 'Bearer', scope: 'emera' });

    const init = await rpc(c, t.access_token, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    expect(init.body.result).toMatchObject({ protocolVersion: '2025-06-18', serverInfo: { name: 'emera' } });
    const tools = await rpc(c, t.access_token, 'tools/list');
    expect(tools.body.result.tools.map((x: any) => x.name)).toEqual(['whoami', 'preview_import', 'import_posts', 'auto_post', 'list_connections', 'create_post', 'list_my_posts']);
    expect((await rpc(c, t.access_token, 'tools/call', { name: 'whoami', arguments: {} })).body.result.content[0].text).toContain('@mcpuser');

    const prev = await rpc(c, t.access_token, 'tools/call', { name: 'preview_import', arguments: { from: 'https://pix.test/feed' } });
    expect(prev.body.result.structuredContent.items).toHaveLength(2);

    const imp = await rpc(c, t.access_token, 'tools/call', { name: 'import_posts', arguments: { from: 'https://pix.test/feed', limit: 5 } });
    expect(imp.body.result.isError).toBeUndefined();
    expect(imp.body.result.structuredContent.imported).toHaveLength(2);
    const again = await rpc(c, t.access_token, 'tools/call', { name: 'import_posts', arguments: { from: 'https://pix.test/feed' } });
    expect(again.body.result.structuredContent.imported).toHaveLength(0);
    expect(again.body.result.structuredContent.skipped).toHaveLength(2);

    const profile = await c.json('GET', '/v1/users/mcpuser');
    expect(profile.body.posts.map((p: any) => [p.caption, p.createdAt])).toEqual([['Second kiln & more', '2026-11-11T08:00:00.000Z'], ['First kiln & more', '2026-11-10T08:00:00.000Z']]);

    const locked = await rpc(c, t.access_token, 'tools/call', { name: 'import_posts', arguments: { from: 'instagram.com/roy' } });
    expect(locked.body.result.isError).toBe(true);

    const ref = await worker.fetch!(form({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: reg.body.client_id }) as any, c.env, {} as any);
    expect(ref.status).toBe(200);
    const reuse = await worker.fetch!(form({ grant_type: 'refresh_token', refresh_token: t.refresh_token }) as any, c.env, {} as any);
    expect(reuse.status).toBe(400);
  });

  it('auto-post brings over only posts made after it was turned on', async () => {
    fakeNet();
    const c = new Client();
    await c.signIn('auto@example.test');
    await c.withHandle('autouser', 'Auto User');
    feedXml = FEED([{ guid: 'old', date: 'Mon, 02 Nov 2026 08:00:00 GMT', text: 'Old one', img: 'https://pix.test/img/o.png' }]);
    const on = await c.json('POST', '/v1/sources', { from: 'https://pix.test/feed?u=auto' });
    expect(on.body.source.autoPost).toBe(true);
    const env = makeEnv();
    await env.DB.prepare("UPDATE sources SET since = ? WHERE spec LIKE '%u=auto'").bind(Date.now() - 10 * 60_000).run();
    feedXml = FEED([
      { guid: 'old', date: 'Mon, 02 Nov 2026 08:00:00 GMT', text: 'Old one', img: 'https://pix.test/img/o.png' },
      { guid: 'new', date: new Date(Date.now() - 60_000).toUTCString(), text: 'New one', img: 'https://pix.test/img/n.png' },
    ]);
    const report = await runAutoImports(env, 'https://internal.emera');
    expect(report.find((r) => r.source.includes('pix.test'))).toMatchObject({ imported: 1 });
    const profile = await c.json('GET', '/v1/users/autouser');
    expect(profile.body.posts.map((p: any) => p.caption)).toEqual(['New one & more']);
    expect((await runAutoImports(env, 'https://internal.emera')).find((r) => r.source.includes('pix.test'))).toMatchObject({ imported: 0 });
    const list = await c.json('GET', '/v1/sources');
    expect(list.body.sources[0]).toMatchObject({ autoPost: true, lastError: null });
  });
});
