import { describe, expect, it } from 'vitest';
import app from '../src/index';
import { Client, makeEnv, ORIGIN, pngBytes } from './helpers';

function assertWellFormed(xml: string) {
  expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);
  const body = xml.replace(/^<\?xml[^>]*\?>/, '');
  const tokens = body.match(/<[^>]+>|[^<]+/g) ?? [];
  const stack: string[] = [];
  let roots = 0;
  for (const t of tokens) {
    if (!t.startsWith('<')) {
      expect(t).not.toMatch(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/);
      continue;
    }
    const close = /^<\/([A-Za-z][\w:.-]*)\s*>$/.exec(t);
    if (close) {
      expect(stack.pop()).toBe(close[1]);
      continue;
    }
    const open = /^<([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>$/.exec(t);
    expect(open, `bad tag ${t}`).not.toBeNull();
    expect(open![2]).not.toMatch(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/);
    if (!stack.length) roots++;
    if (!open![3]) stack.push(open![1]);
  }
  expect(stack).toEqual([]);
  expect(roots).toBe(1);
}

async function seed() {
  const c = new Client(makeEnv({ POSTS_PER_DAY: '1000' } as any));
  await c.signIn('share@example.test');
  await c.withHandle('shara', 'Shara <Lens> & Co');
  const up = await c.upload(pngBytes(64, 48));
  const post = await c.json('POST', '/v1/posts', { caption: 'Low tide & "gold" <light>', mediaIds: [up.body.media.id] });
  return { c, post: post.body.post, media: up.body.media };
}

const get = (c: Client, path: string) => app.fetch(new Request(`${ORIGIN}${path}`), c.env);

describe('share card', () => {
  it('serves a 1200x630 png for a post and 404 for an unknown one', async () => {
    const { c, post } = await seed();
    const res = await get(c, `/p/${post.id}/card.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toContain('max-age=3600');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const dv = new DataView(bytes.buffer);
    expect([dv.getUint32(16), dv.getUint32(20)]).toEqual([1200, 630]);
    expect(bytes.length).toBeGreaterThan(5000);

    expect((await get(c, '/p/nope/card.png')).status).toBe(404);
  });

  it('points og:image and twitter:image at the card', async () => {
    const { c, post } = await seed();
    const html = await (await get(c, `/p/${post.id}`)).text();
    expect(html).toContain(`<meta property="og:image" content="${post.url}/card.png">`);
    expect(html).toContain('<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain(`<meta name="twitter:image" content="${post.url}/card.png">`);
  });
});

describe('oEmbed and embed page', () => {
  it('returns rich oEmbed JSON for post links on every Emera host', async () => {
    const { c, post } = await seed();
    for (const host of [new URL(post.url).origin, 'https://emera.social', 'https://api.emera.social', 'https://app.emera.social']) {
      const res = await get(c, `/oembed?url=${encodeURIComponent(`${host}/p/${post.id}`)}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      const j = (await res.json()) as any;
      expect(j).toMatchObject({ version: '1.0', type: 'rich', provider_name: 'Emera', author_name: 'Shara <Lens> & Co', thumbnail_width: 1200 });
      expect(j.html).toContain(`/embed/${post.id}`);
      expect(j.html).not.toContain('<Lens>');
      expect(j.width).toBeLessThanOrEqual(550);
      expect(j.height).toBeGreaterThan(0);
    }
    const small = (await (await get(c, `/oembed?maxwidth=300&url=${encodeURIComponent(post.url)}`)).json()) as any;
    expect(small.width).toBe(300);
  });

  it('rejects missing, malformed, non-Emera and unknown links', async () => {
    const { c, post } = await seed();
    expect((await get(c, '/oembed')).status).toBe(400);
    expect((await get(c, '/oembed?url=not-a-link')).status).toBe(400);
    expect((await get(c, `/oembed?url=${encodeURIComponent('https://example.com/p/abc')}`)).status).toBe(404);
    expect((await get(c, `/oembed?url=${encodeURIComponent('https://emera.social/@someone')}`)).status).toBe(404);
    expect((await get(c, `/oembed?url=${encodeURIComponent('https://emera.social/p/missing')}`)).status).toBe(404);
    expect((await get(c, `/oembed?format=xml&url=${encodeURIComponent(post.url)}`)).status).toBe(501);
  });

  it('renders an iframe-safe embed with a link back and no save affordances', async () => {
    const { c, post, media } = await seed();
    const res = await get(c, `/embed/${post.id}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toContain('frame-ancestors *');
    expect(res.headers.get('x-frame-options')).toBeNull();
    const html = await res.text();
    expect(html).toContain(`href="${post.url}"`);
    expect(html).toContain(`src="${media.url}"`);
    expect(html).toContain('draggable="false"');
    expect(html).toContain('/guard.js');
    expect(html).not.toContain('download');
    expect(html).not.toContain('<Lens>');
    expect((await get(c, '/embed/missing')).status).toBe(404);
  });

  it('advertises the oEmbed endpoint on the post page', async () => {
    const { c, post } = await seed();
    const html = await (await get(c, `/p/${post.id}`)).text();
    expect(html).toContain(`<link rel="alternate" type="application/json+oembed" href="${ORIGIN}/oembed?format=json&amp;url=${encodeURIComponent(post.url)}"`);
  });
});

describe('feeds', () => {
  it('serves a well-formed Atom feed for a creator with media enclosures', async () => {
    const { c, post, media } = await seed();
    const res = await get(c, '/@shara/feed.xml');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/atom+xml');
    const xml = await res.text();
    assertWellFormed(xml);
    expect(xml).toContain(`<id>${post.url}</id>`);
    expect(xml).toContain(`<link rel="enclosure" type="${media.contentType}" href="${media.url}"/>`);
    expect(xml).toContain('Shara &lt;Lens&gt; &amp; Co');
    expect(xml).toContain('Low tide &amp;amp; &amp;quot;gold&amp;quot; &amp;lt;light&amp;gt;');
    expect((await get(c, '/@nobody/feed.xml')).status).toBe(404);
  });

  it('serves the global feed with at most 50 posts, newest first', async () => {
    const c = new Client();
    await c.signIn('many@example.test');
    await c.withHandle('many');
    for (let i = 0; i < 54; i++) {
      const u = await c.upload(pngBytes(8 + (i % 5), 8));
      const p = await c.json('POST', '/v1/posts', { caption: `n${i}`, mediaIds: [u.body.media.id], createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString() });
      expect(p.status).toBe(201);
    }
    const xml = await (await get(c, '/feed.xml')).text();
    assertWellFormed(xml);
    const entries = xml.match(/<entry>/g) ?? [];
    expect(entries.length).toBe(50);
    expect(xml).not.toContain('<title>n0</title>');
    const mine = [...xml.matchAll(/<title>n(\d+)<\/title>/g)].map((m) => Number(m[1]));
    expect(mine[0]).toBe(53);
    expect(mine).toEqual([...mine].sort((x, y) => y - x));
  });

  it('links the feeds from profile and home pages', async () => {
    const { c } = await seed();
    const profile = await (await get(c, '/@shara')).text();
    expect(profile).toContain(`<link rel="alternate" type="application/atom+xml" title="Shara &lt;Lens&gt; &amp; Co on Emera" href="${ORIGIN}/@shara/feed.xml">`);
    expect(await (await get(c, '/')).text()).toContain(`type="application/atom+xml" title="Emera" href="${ORIGIN}/feed.xml"`);
  });
});
