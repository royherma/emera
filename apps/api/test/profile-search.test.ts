import { describe, expect, it } from 'vitest';
import { Client, pngBytes } from './helpers';

async function member(email: string, handle: string, displayName = handle) {
  const c = new Client();
  await c.signIn(email);
  const res = await c.withHandle(handle, displayName);
  return { c, user: res.body.user };
}

async function postWith(c: Client, caption: string, alt?: string) {
  const up = await c.upload(pngBytes(8, 8));
  const media = up.body.media;
  const body: Record<string, unknown> = { mediaIds: [media.id], caption };
  if (alt !== undefined) body.alt = { [media.id]: alt };
  return { media, res: await c.json('POST', '/v1/posts', body) };
}

describe('profile edit', () => {
  it('updates name, bio, links and avatar, and rejects bad input', async () => {
    const { c } = await member('edit1@example.test', 'editor_one', 'Editor One');

    const ok = await c.json('PATCH', '/v1/me', { displayName: '  Edie Makes ', bio: 'Ceramics and glaze notes', links: ['https://edie.example/work', 'https://edie.example/work'] });
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ handle: 'editor_one', displayName: 'Edie Makes', bio: 'Ceramics and glaze notes', links: ['https://edie.example/work'] });
    expect((await c.json('GET', '/v1/me')).body.user.bio).toBe('Ceramics and glaze notes');

    const up = await c.upload(pngBytes(16, 16));
    const withAvatar = await c.json('PATCH', '/v1/me', { avatarMediaId: up.body.media.id });
    expect(withAvatar.status).toBe(200);
    expect(withAvatar.body.user.avatarUrl).toBe(up.body.media.url);
    expect(withAvatar.body.user.bio).toBe('Ceramics and glaze notes');
    const cleared = await c.json('PATCH', '/v1/me', { avatarMediaId: null });
    expect(cleared.body.user.avatarUrl).toBeNull();

    expect((await c.json('PATCH', '/v1/me', {})).body.error.code).toBe('nothing_to_change');
    expect((await c.json('PATCH', '/v1/me', { bio: 'x'.repeat(281) })).body.error.code).toBe('bad_bio');
    expect((await c.json('PATCH', '/v1/me', { displayName: '   ' })).body.error.code).toBe('bad_name');
    expect((await c.json('PATCH', '/v1/me', { links: ['javascript:alert(1)'] })).body.error.code).toBe('bad_links');
    expect((await c.json('PATCH', '/v1/me', { links: Array(6).fill('https://a.example') })).body.error.code).toBe('bad_links');
    expect((await c.json('PATCH', '/v1/me', { avatarMediaId: 'nope' })).body.error.code).toBe('bad_avatar');
  });

  it('refuses someone else\'s upload as an avatar, and needs sign-in and a handle', async () => {
    const a = await member('edit2@example.test', 'editor_two');
    const b = await member('edit3@example.test', 'editor_three');
    const up = await a.c.upload(pngBytes(8, 8));
    const stolen = await b.c.json('PATCH', '/v1/me', { avatarMediaId: up.body.media.id });
    expect(stolen.status).toBe(400);
    expect(stolen.body.error.code).toBe('bad_avatar');

    expect((await new Client().json('PATCH', '/v1/me', { bio: 'hi' })).status).toBe(401);
    const bare = new Client();
    await bare.signIn('edit4@example.test');
    expect((await bare.json('PATCH', '/v1/me', { bio: 'hi' })).status).toBe(403);
  });

  it('shows the new profile on the public page', async () => {
    const { c } = await member('edit5@example.test', 'editor_five');
    await c.json('PATCH', '/v1/me', { displayName: 'Five Studio', bio: 'Block prints' });
    const page = await c.call('GET', '/@editor_five');
    const html = await page.text();
    expect(html).toContain('Five Studio');
    expect(html).toContain('Block prints');
  });
});

describe('alt text', () => {
  it('stores alt per media, returns it in post JSON and uses it on the public pages', async () => {
    const { c } = await member('alt1@example.test', 'alt_maker');
    const { media, res } = await postWith(c, 'Morning at the pier', 'A grey pier stretching into fog at sunrise');
    expect(res.status).toBe(201);
    expect(res.body.post.media[0].alt).toBe('A grey pier stretching into fog at sunrise');
    expect(res.body.post.media[0].id).toBe(media.id);

    const got = await c.json('GET', `/v1/posts/${res.body.post.id}`);
    expect(got.body.post.media[0].alt).toBe('A grey pier stretching into fog at sunrise');

    const html = await (await c.call('GET', `/p/${res.body.post.id}`)).text();
    expect(html).toContain('alt="A grey pier stretching into fog at sunrise"');
    const profile = await (await c.call('GET', '/@alt_maker')).text();
    expect(profile).toContain('alt="A grey pier stretching into fog at sunrise"');
  });

  it('defaults to an empty alt and validates input', async () => {
    const { c } = await member('alt2@example.test', 'alt_plain');
    const { res } = await postWith(c, 'No alt here');
    expect(res.body.post.media[0].alt).toBe('');
    const html = await (await c.call('GET', `/p/${res.body.post.id}`)).text();
    expect(html).toContain('alt="No alt here"');

    const up = await c.upload(pngBytes(8, 8));
    const tooLong = await c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], alt: { [up.body.media.id]: 'x'.repeat(1001) } });
    expect(tooLong.body.error.code).toBe('bad_alt');
    const stranger = await c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], alt: { other: 'nope' } });
    expect(stranger.body.error.code).toBe('bad_alt');
    const wrongShape = await c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], alt: ['nope'] });
    expect(wrongShape.body.error.code).toBe('bad_alt');
    expect((await c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], alt: { [up.body.media.id]: 'fine' } })).status).toBe(201);
  });
});

describe('search', () => {
  it('finds people by handle, name and bio, by prefix, and hides handle-less accounts', async () => {
    const a = await member('s1@example.test', 'quill_ceramics', 'Quillon Ashby');
    await a.c.json('PATCH', '/v1/me', { bio: 'Stoneware potter from Lisbon' });
    await member('s2@example.test', 'brass_studio', 'Brass Studio');
    const ghost = new Client();
    await ghost.signIn('s3-ghost@example.test');

    const anon = new Client();
    const byHandle = await anon.json('GET', '/v1/search?q=quill&type=people');
    expect(byHandle.status).toBe(200);
    expect(byHandle.body.users.map((u: any) => u.handle)).toEqual(['quill_ceramics']);
    expect(byHandle.body.cursor).toBeNull();

    expect((await anon.json('GET', '/v1/search?q=Quillon')).body.users).toHaveLength(1);
    expect((await anon.json('GET', '/v1/search?q=stoneware%20lisb')).body.users[0].handle).toBe('quill_ceramics');
    expect((await anon.json('GET', '/v1/search?q=brass&type=people')).body.users[0].handle).toBe('brass_studio');
    expect((await anon.json('GET', '/v1/search?q=zzzznomatch')).body.users).toEqual([]);
    expect((await anon.json('GET', '/v1/search?q=s3-ghost')).body.users).toEqual([]);

    await a.c.json('PATCH', '/v1/me', { displayName: 'Renamed Person', bio: 'Now a weaver' });
    expect((await anon.json('GET', '/v1/search?q=weaver')).body.users[0].handle).toBe('quill_ceramics');
    expect((await anon.json('GET', '/v1/search?q=stoneware')).body.users).toEqual([]);
  });

  it('finds posts by caption and alt text, and drops deleted posts', async () => {
    const { c } = await member('s4@example.test', 'search_poster');
    const first = await postWith(c, 'Walnut stool, oiled this morning', 'Low stool with three legs on a pale floor');
    await postWith(c, 'Sketchbook spread');

    const byCaption = await c.json('GET', '/v1/search?q=walnut&type=posts');
    expect(byCaption.status).toBe(200);
    expect(byCaption.body.posts.map((p: any) => p.id)).toEqual([first.res.body.post.id]);
    expect(byCaption.body.posts[0].author.handle).toBe('search_poster');

    const byAlt = await c.json('GET', '/v1/search?q=three%20legs&type=posts');
    expect(byAlt.body.posts.map((p: any) => p.id)).toEqual([first.res.body.post.id]);

    await c.json('DELETE', `/v1/posts/${first.res.body.post.id}`);
    expect((await c.json('GET', '/v1/search?q=walnut&type=posts')).body.posts).toEqual([]);
  });

  it('pages results and validates the query', async () => {
    const c = new Client();
    for (let i = 0; i < 22; i++) {
      const m = await member(`page${i}@example.test`, `pagecraft_${String(i).padStart(2, '0')}`);
      expect(m.user.handle).toBeTruthy();
    }
    const one = await c.json('GET', '/v1/search?q=pagecraft&type=people');
    expect(one.body.users).toHaveLength(20);
    expect(one.body.cursor).toBe('20');
    const two = await c.json('GET', `/v1/search?q=pagecraft&type=people&cursor=${one.body.cursor}`);
    expect(two.body.users).toHaveLength(2);
    expect(two.body.cursor).toBeNull();
    const seen = new Set([...one.body.users, ...two.body.users].map((u: any) => u.handle));
    expect(seen.size).toBe(22);

    expect((await c.json('GET', '/v1/search')).body.error.code).toBe('bad_query');
    expect((await c.json('GET', '/v1/search?q=a&type=tags')).body.error.code).toBe('bad_type');
    expect((await c.json('GET', '/v1/search?q=%22%20OR%20*%20%22')).status).toBe(200);
    expect((await c.json('GET', '/v1/search?q=!!!')).body.users).toEqual([]);
  });
});

describe('flags', () => {
  it('reports a post and an account, deduplicates, and lists my reports', async () => {
    const owner = await member('f1@example.test', 'flag_owner');
    const reporter = await member('f2@example.test', 'flag_reporter');
    const { res } = await postWith(owner.c, 'Questionable post');
    const postId = res.body.post.id;

    const first = await reporter.c.json('POST', '/v1/flags', { targetType: 'post', targetId: postId, reason: 'spam', note: ' looks automated ' });
    expect(first.status).toBe(201);
    expect(first.body.flag).toMatchObject({ targetType: 'post', targetId: postId, reason: 'spam', note: 'looks automated', status: 'new' });
    expect(first.body.duplicate).toBe(false);

    const again = await reporter.c.json('POST', '/v1/flags', { targetType: 'post', targetId: postId, reason: 'scam' });
    expect(again.status).toBe(200);
    expect(again.body.duplicate).toBe(true);
    expect(again.body.flag.id).toBe(first.body.flag.id);

    const acct = await reporter.c.json('POST', '/v1/flags', { targetType: 'user', targetId: owner.user.id, reason: 'impersonation' });
    expect(acct.status).toBe(201);

    const mine = await reporter.c.json('GET', '/v1/flags');
    expect(mine.body.flags).toHaveLength(2);
    expect((await owner.c.json('GET', '/v1/flags')).body.flags).toEqual([]);
  });

  it('rejects bad targets, reasons, notes, own content and signed-out callers', async () => {
    const owner = await member('f3@example.test', 'flag_owner2');
    const other = await member('f4@example.test', 'flag_other');
    const { res } = await postWith(owner.c, 'Mine');
    const postId = res.body.post.id;

    expect((await other.c.json('POST', '/v1/flags', { targetType: 'comment', targetId: postId, reason: 'spam' })).body.error.code).toBe('bad_target');
    expect((await other.c.json('POST', '/v1/flags', { targetType: 'post', targetId: postId, reason: 'rude' })).body.error.code).toBe('bad_reason');
    expect((await other.c.json('POST', '/v1/flags', { targetType: 'post', targetId: postId, reason: 'spam', note: 'x'.repeat(1001) })).body.error.code).toBe('bad_note');
    expect((await other.c.json('POST', '/v1/flags', { targetType: 'post', targetId: 'missing', reason: 'spam' })).status).toBe(404);
    expect((await other.c.json('POST', '/v1/flags', { targetType: 'user', targetId: 'missing', reason: 'spam' })).status).toBe(404);
    const own = await owner.c.json('POST', '/v1/flags', { targetType: 'post', targetId: postId, reason: 'spam' });
    expect(own.status).toBe(400);
    expect(own.body.error.code).toBe('own_content');
    expect((await owner.c.json('POST', '/v1/flags', { targetType: 'user', targetId: owner.user.id, reason: 'spam' })).body.error.code).toBe('own_content');
    expect((await new Client().json('POST', '/v1/flags', { targetType: 'post', targetId: postId, reason: 'spam' })).status).toBe(401);
  });
});
