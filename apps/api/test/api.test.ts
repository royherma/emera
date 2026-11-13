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

describe('my invites', () => {
  const env = () => makeEnv({ INVITES_REQUIRED: 'true' });

  it('lists my invites with who joined, and caps how many one person can make', async () => {
    const founder = new Client(env());
    await founder.signIn('lister@example.test', 'welcome-dev');
    await founder.withHandle('lister', 'Lister');
    expect((await founder.json('GET', '/v1/invites')).body).toEqual({ invites: [], limit: 20 });
    expect((await new Client(env()).json('GET', '/v1/invites')).status).toBe(401);

    const team = await founder.json('POST', '/v1/invites', { maxUses: 3 });
    const solo = await founder.json('POST', '/v1/invites');
    expect((await founder.json('POST', '/v1/invites', { maxUses: 0 })).body.error.code).toBe('bad_max_uses');

    for (const [email, handle] of [['joiner1@example.test', 'joiner_one'], ['joiner2@example.test', 'joiner_two']]) {
      const guest = new Client(env());
      await guest.signIn(email, team.body.code);
      await guest.withHandle(handle, handle.toUpperCase());
    }
    await new Client(env()).signIn('nohandle@example.test', team.body.code);

    const list = await founder.json('GET', '/v1/invites');
    expect(list.status).toBe(200);
    const byCode = Object.fromEntries(list.body.invites.map((i: { code: string }) => [i.code, i]));
    expect(byCode[team.body.code]).toMatchObject({ url: `${ORIGIN}/invite/${team.body.code}`, uses: 3, maxUses: 3 });
    expect(byCode[team.body.code].joined).toEqual([{ handle: 'joiner_one', displayName: 'JOINER_ONE' }, { handle: 'joiner_two', displayName: 'JOINER_TWO' }]);
    expect(byCode[solo.body.code]).toMatchObject({ uses: 0, maxUses: 1, joined: [] });

    const other = new Client(env());
    await other.signIn('other@example.test', solo.body.code);
    await other.withHandle('other', 'Other');
    expect((await other.json('GET', '/v1/invites')).body.invites).toEqual([]);
  });

  it('stops at 20 invites', async () => {
    const e = env();
    const founder = new Client(e);
    await founder.signIn('capper@example.test', 'welcome-dev');
    const me = await founder.withHandle('capper', 'Capper');
    const id = me.body.user.id;
    for (let i = 0; i < 20; i++) {
      await e.DB.prepare('INSERT INTO invites (code, created_by, created_at) VALUES (?, ?, ?)').bind(`old${i}`.padEnd(8, 'x'), id, Date.now() - 3 * 86_400_000).run();
    }
    const over = await founder.json('POST', '/v1/invites');
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('invite_limit');
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

describe('reports', () => {
  async function authorWithPost(email: string, handle: string) {
    const c = new Client();
    await c.signIn(email);
    await c.withHandle(handle);
    const up = await c.upload(pngBytes(16, 16));
    const post = await c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], caption: 'mine' });
    return { c, postId: post.body.post.id as string };
  }

  it('lets the author report a copy and lists only their own reports', async () => {
    const { c, postId } = await authorWithPost('rep-author@example.test', 'rep_author');
    const r = await c.json('POST', '/v1/reports', { postId, url: 'https://copycat.example/pic', note: ' stole it ' });
    expect(r.status).toBe(201);
    expect(r.body.report).toMatchObject({ status: 'new' });
    const list = await c.json('GET', '/v1/reports');
    expect(list.body.reports).toHaveLength(1);
    expect(list.body.reports[0]).toMatchObject({ postId, url: 'https://copycat.example/pic', note: 'stole it', status: 'new' });

    const other = new Client();
    await other.signIn('rep-other@example.test');
    expect((await other.json('GET', '/v1/reports')).body.reports).toEqual([]);
  });

  it('rejects other people, missing posts, bad urls and signed-out calls', async () => {
    const { c, postId } = await authorWithPost('rep-a2@example.test', 'rep_a2');
    const other = new Client();
    await other.signIn('rep-b2@example.test');
    expect((await other.json('POST', '/v1/reports', { postId, url: 'https://x.example/a' })).status).toBe(403);
    expect((await c.json('POST', '/v1/reports', { postId: 'nope', url: 'https://x.example/a' })).status).toBe(404);
    for (const url of ['ftp://x.example/a', 'javascript:alert(1)', 'not a url', '', 5, 'https://x.example/' + 'a'.repeat(2100)]) {
      const bad = await c.json('POST', '/v1/reports', { postId, url });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('bad_url');
    }
    expect((await c.json('POST', '/v1/reports', { postId, url: 'https://x.example/a', note: 'n'.repeat(2001) })).status).toBe(400);
    expect((await new Client().json('POST', '/v1/reports', { postId, url: 'https://x.example/a' })).status).toBe(401);
    expect((await new Client().json('GET', '/v1/reports')).status).toBe(401);
  });
});
