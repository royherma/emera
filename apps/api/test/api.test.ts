import { describe, expect, it } from 'vitest';
import app from '../src/index';
import brand from '../../../packages/brand/brand.json';
import { Client, ORIGIN, makeEnv, pngBytes } from './helpers';

describe('sign-up and handle', () => {
  it('signs up with a 6-digit code, picks a handle, reads /me, logs out', async () => {
    const c = new Client();
    const { start, verify, code } = await c.signIn('maya@example.test');
    expect(start.status).toBe(200);
    expect(code).toMatch(/^\d{6}$/);
    expect(verify!.status).toBe(200);
    expect(verify!.body.isNew).toBe(true);
    expect(verify!.body.token).toHaveLength(64);
    expect(verify!.body.user.handle).toBeNull();

    const noHandle = await c.json('POST', '/v1/uploads', { contentType: 'image/png', bytes: 10 });
    expect(noHandle.status).toBe(403);
    expect(noHandle.body.error.code).toBe('handle_required');

    const bad = await c.withHandle('No');
    expect(bad.status).toBe(400);
    const ok = await c.withHandle('Maya_Makes', 'Maya Makes');
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ handle: 'maya_makes', displayName: 'Maya Makes', bio: '', avatarUrl: null });

    const again = await c.withHandle('another');
    expect(again.status).toBe(409);

    const other = new Client();
    await other.signIn('theo@example.test');
    const taken = await other.withHandle('maya_makes');
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe('handle_taken');

    const me = await c.json('GET', '/v1/me');
    expect(me.body.user.handle).toBe('maya_makes');

    expect((await c.json('POST', '/v1/auth/logout')).body).toEqual({ ok: true });
    expect((await c.json('GET', '/v1/me')).status).toBe(401);
  });

  it('rejects a wrong code and signs the same person back in as not new', async () => {
    const c = new Client();
    await c.signIn('repeat@example.test');
    const c2 = new Client();
    const r = await c2.signIn('repeat@example.test');
    expect(r.verify!.body.isNew).toBe(false);
    const wrong = await c2.json('POST', '/v1/auth/verify', { email: 'repeat@example.test', code: '000000' });
    expect(wrong.status).toBe(400);
  });
});

describe('invite gate', () => {
  const env = () => makeEnv({ INVITES_REQUIRED: 'true' });

  it('blocks new emails without an invite and accepts a member invite once', async () => {
    const blocked = await new Client(env()).signIn('nope@example.test');
    expect(blocked.start.status).toBe(403);
    expect(blocked.start.body.error.code).toBe('invite_required');

    const bad = await new Client(env()).signIn('nope@example.test', 'zzzzzzzz');
    expect(bad.start.body.error.code).toBe('invite_invalid');

    const founder = new Client(env());
    expect((await founder.signIn('founder@example.test', 'welcome-dev')).verify!.status).toBe(200);
    await founder.withHandle('founder', 'Founder');
    const inv = await founder.json('POST', '/v1/invites');
    expect(inv.status).toBe(200);
    expect(inv.body.code).toMatch(/^[a-z0-9]{8}$/);
    expect(inv.body.url).toBe(`${ORIGIN}/invite/${inv.body.code}`);

    const look = await founder.json('GET', `/v1/invites/${inv.body.code}`);
    expect(look.body).toEqual({ valid: true, invitedBy: 'founder' });
    expect((await founder.json('GET', '/v1/invites/unknown1')).body).toEqual({ valid: false, invitedBy: null });

    const friend = new Client(env());
    const joined = await friend.signIn('friend@example.test', inv.body.code);
    expect(joined.verify!.status).toBe(200);
    expect((await founder.json('GET', `/v1/invites/${inv.body.code}`)).body.valid).toBe(false);

    const late = await new Client(env()).signIn('late@example.test', inv.body.code);
    expect(late.start.body.error.code).toBe('invite_invalid');

    const existing = await new Client(env()).signIn('friend@example.test');
    expect(existing.verify!.body.isNew).toBe(false);
  });
});

describe('uploads, posts, profiles, pages', () => {
  it('uploads an image, reads it back, posts it, and serves profile JSON and pages', async () => {
    const c = new Client();
    await c.signIn('ana@example.test');
    await c.withHandle('ana', 'Ana <Lens>');
    const png = pngBytes(64, 48);

    const up = await c.upload(png);
    expect(up.status).toBe(200);
    const media = up.body.media;
    expect(media).toMatchObject({ kind: 'image', contentType: 'image/png', width: 64, height: 48 });
    expect(media.sha256).toMatch(/^[0-9a-f]{64}$/);
    const digest = Buffer.from(await crypto.subtle.digest('SHA-256', png)).toString('hex');
    expect(media.sha256).toBe(digest);
    expect(media.proof).toMatchObject({ sha256: digest, signer: 'ana', alg: 'hmac-sha256' });
    expect(media.proof.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(Date.parse(media.proof.signedAt)).toBeGreaterThan(0);

    const back = await app.fetch(new Request(media.url), c.env);
    expect(back.status).toBe(200);
    expect(back.headers.get('content-type')).toBe('image/png');
    expect(back.headers.get('cache-control')).toContain('immutable');
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(png);
    const ranged = await app.fetch(new Request(media.url, { headers: { Range: 'bytes=0-7' } }), c.env);
    expect(ranged.status).toBe(206);
    expect((await ranged.arrayBuffer()).byteLength).toBe(8);

    const again = await c.call('PUT', new URL(media.url).pathname.replace('/media/', '/v1/uploads/').replace(/\.png$/, ''), undefined, png);
    expect(again.status).toBe(409);

    const post = await c.json('POST', '/v1/posts', { mediaIds: [media.id], caption: 'First light <b>over</b> the bay' });
    expect(post.status).toBe(201);
    expect(post.body.post).toMatchObject({ caption: 'First light <b>over</b> the bay', url: `${ORIGIN}/p/${post.body.post.id}` });
    expect(post.body.post.author.handle).toBe('ana');
    expect(post.body.post.media[0].id).toBe(media.id);

    const reuse = await c.json('POST', '/v1/posts', { mediaIds: [media.id], caption: 'again' });
    expect(reuse.status).toBe(400);

    const got = await c.json('GET', `/v1/posts/${post.body.post.id}`);
    expect(got.body.post.id).toBe(post.body.post.id);

    const profile = await c.json('GET', '/v1/users/ANA');
    expect(profile.status).toBe(200);
    expect(profile.body.user.handle).toBe('ana');
    expect(profile.body.posts).toHaveLength(1);
    expect(profile.body.cursor).toBeNull();
    expect(JSON.stringify(profile.body)).not.toContain('example.test');
    expect((await c.json('GET', '/v1/users/ghost')).status).toBe(404);

    const feed = await c.json('GET', '/v1/feed');
    expect(feed.body.posts.some((p: any) => p.id === post.body.post.id)).toBe(true);

    const page = await app.fetch(new Request(`${ORIGIN}/@ana`), c.env);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    const html = await page.text();
    expect(html).toContain(`<meta property="og:title" content="Ana &lt;Lens&gt; (@ana) on ${brand.name}">`);
    expect(html).toContain(`<meta property="og:image" content="${media.url}">`);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('og:description');
    expect(html).not.toContain('Ana <Lens>');

    const postPage = await (await app.fetch(new Request(`${ORIGIN}/p/${post.body.post.id}`), c.env)).text();
    expect(postPage).toContain(`og:image" content="${media.url}"`);
    expect(postPage).toContain('First light &lt;b&gt;over&lt;/b&gt; the bay');
    expect(postPage).toContain(digest);

    expect((await app.fetch(new Request(`${ORIGIN}/@nobody`), c.env)).status).toBe(404);

    const other = new Client();
    await other.signIn('bo@example.test');
    await other.withHandle('bo');
    expect((await other.json('DELETE', `/v1/posts/${post.body.post.id}`)).status).toBe(403);
    expect((await c.json('DELETE', `/v1/posts/${post.body.post.id}`)).body).toEqual({ ok: true });
    expect((await c.json('GET', `/v1/posts/${post.body.post.id}`)).status).toBe(404);
    expect((await app.fetch(new Request(media.url), c.env)).status).toBe(404);
  });

  it('rejects files that are not what they claim, and unsupported types', async () => {
    const c = new Client();
    await c.signIn('liar@example.test');
    await c.withHandle('liar');
    const fake = await c.upload(new TextEncoder().encode('not an image at all'), 'image/png');
    expect(fake.status).toBe(415);
    expect((await c.json('POST', '/v1/uploads', { contentType: 'application/pdf', bytes: 5 })).status).toBe(415);
    expect((await c.json('POST', '/v1/uploads', { contentType: 'image/png', bytes: 26 * 1024 * 1024 })).status).toBe(413);
  });

  it('streams a video into storage with its sha256', async () => {
    const c = new Client();
    await c.signIn('vid@example.test');
    await c.withHandle('vid');
    const mp4 = new Uint8Array(2048).map((_, i) => (i * 7) % 251);
    mp4.set(new TextEncoder().encode('ftypisom'), 4);
    const up = await c.upload(mp4, 'video/mp4');
    expect(up.status).toBe(200);
    expect(up.body.media).toMatchObject({ kind: 'video', contentType: 'video/mp4' });
    expect(up.body.media.sha256).toBe(Buffer.from(await crypto.subtle.digest('SHA-256', mp4)).toString('hex'));
    const back = await app.fetch(new Request(up.body.media.url), c.env);
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(mp4);
  });
});
