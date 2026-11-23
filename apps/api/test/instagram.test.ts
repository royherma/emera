import { afterEach, describe, expect, it } from 'vitest';
import { Client, makeEnv, pngBytes } from './helpers';
import { setNet } from '../src/ingest';
import { igItems } from '../src/connectors/instagram';
import { parseFrom } from '../src/connectors';

const png = pngBytes(10, 10);
const media = [
  { id: '901', media_type: 'IMAGE', media_url: 'https://cdn.ig.test/901.png', permalink: 'https://www.instagram.com/p/901/', caption: 'Kiln day', timestamp: '2026-11-10T08:00:00+0000' },
  { id: '902', media_type: 'CAROUSEL_ALBUM', permalink: 'https://www.instagram.com/p/902/', caption: 'Two bowls', timestamp: '2026-11-09T08:00:00+0000', children: { data: [{ media_type: 'IMAGE', media_url: 'https://cdn.ig.test/902a.png' }, { media_type: 'IMAGE', media_url: 'https://cdn.ig.test/902b.png' }] } },
];
let tokenSeen = '';
function fakeInstagram() {
  setNet((async (input: RequestInfo | URL) => {
    const u = new URL(String(input instanceof Request ? input.url : input));
    if (u.hostname === 'graph.instagram.com' && u.pathname.endsWith('/me')) { tokenSeen = u.searchParams.get('access_token') ?? ''; return Response.json({ user_id: '1789', username: 'kilnmaker' }); }
    if (u.hostname === 'graph.instagram.com' && u.pathname.endsWith('/me/media')) return Response.json({ data: media });
    if (u.hostname === 'cdn.ig.test') return new Response(png, { headers: { 'Content-Type': 'image/png', 'Content-Length': String(png.length) } });
    return new Response('nope', { status: 404 });
  }) as typeof fetch);
}
afterEach(() => setNet((i, init) => fetch(i, init)));

describe('Instagram', () => {
  it('maps reels, photos and carousels and accepts any Instagram input', () => {
    const items = igItems([...media, { id: '903', media_type: 'VIDEO', media_url: 'https://cdn.ig.test/903.mp4', timestamp: '2026-11-08T08:00:00+0000' }]);
    expect(items.map((i) => [i.id, i.media.length, i.media[0].type])).toEqual([['ig:901', 1, 'image'], ['ig:902', 2, 'image'], ['ig:903', 1, 'video']]);
    for (const s of ['instagram', '@instagram', 'https://www.instagram.com/techguyver/', 'instagram.com']) expect(parseFrom(s).kind).toBe('instagram');
  });

  it('signs in, lists posts and imports once, over the API and MCP', async () => {
    fakeInstagram();
    const c = new Client(makeEnv({ INSTAGRAM_STUB_TOKEN: 'stub-ig-token' }));
    await c.signIn('ig@example.test');
    await c.withHandle('kilnmaker', 'Kiln Maker');

    const before = await c.json('POST', '/v1/import/preview', { from: 'instagram' });
    expect(before.body.error.code).toBe('instagram_not_connected');

    const st = await c.json('GET', '/v1/instagram');
    expect(st.body).toMatchObject({ connected: false, username: null });
    const start = await c.call('GET', new URL(st.body.connectUrl).pathname + new URL(st.body.connectUrl).search);
    expect(start.status).toBe(302);
    const cb = new URL(start.headers.get('Location')!);
    const done = await c.call('GET', cb.pathname + cb.search);
    expect(done.status).toBe(200);
    expect(await done.text()).toContain('Instagram connected as @kilnmaker');
    expect(tokenSeen).toBe('stub-ig-token');
    expect((await c.json('GET', '/v1/instagram')).body).toMatchObject({ connected: true, username: 'kilnmaker' });

    expect((await c.call('GET', `/instagram/callback?code=x&state=${encodeURIComponent('someone.1.forged')}`)).status).toBe(400);

    const prev = await c.json('POST', '/v1/import/preview', { from: 'instagram' });
    expect(prev.body.items.map((i: any) => [i.id, i.photos])).toEqual([['ig:901', 1], ['ig:902', 2]]);
    const imp = await c.json('POST', '/v1/import', { from: 'https://www.instagram.com/kilnmaker/', only: ['ig:902'] });
    expect(imp.body.imported).toHaveLength(1);
    const profile = await c.json('GET', '/v1/users/kilnmaker');
    expect(profile.body.posts.map((p: any) => [p.caption, p.media.length, p.createdAt])).toEqual([['Two bowls', 2, '2026-11-09T08:00:00.000Z']]);
    expect((await c.json('POST', '/v1/import', { from: 'instagram', only: ['ig:902'] })).body.skipped[0].why).toContain('already on Emera');

    const tools = await c.json('POST', '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'connect_instagram', arguments: {} } });
    expect(tools.body.result.content[0].text).toContain('connected as @kilnmaker');

    expect((await c.json('DELETE', '/v1/instagram')).status).toBe(200);
    expect((await c.json('GET', '/v1/instagram')).body.connected).toBe(false);
  });

  it('is locked with a plain sentence when Meta keys are not set', async () => {
    const c = new Client(makeEnv());
    await c.signIn('lock@example.test');
    await c.withHandle('locked', 'Locked');
    c.env = makeEnv({ ENVIRONMENT: 'production' });
    const list = await c.json('GET', '/v1/connectors');
    expect(list.body.connectors.map((k: any) => k.id)).not.toContain('instagram');
    expect(list.body.locked.map((l: any) => l.name)).toContain('Instagram');
    const prev = await c.json('POST', '/v1/import/preview', { from: 'instagram' });
    expect(prev.body.error.code).toBe('source_locked');
    expect((await c.json('GET', '/v1/instagram')).body).toMatchObject({ connected: false, connectUrl: null });
    const live = await new Client(makeEnv({ ENVIRONMENT: 'production', INSTAGRAM_APP_ID: 'id', INSTAGRAM_APP_SECRET: 's' })).json('GET', '/v1/connectors');
    expect(live.body.connectors.map((k: any) => k.id)).toContain('instagram');
  });
});
