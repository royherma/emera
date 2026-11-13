import { describe, expect, it } from 'vitest';
import { Client, pngBytes } from './helpers';

async function person(handle: string) {
  const c = new Client();
  await c.signIn(`${handle}@example.test`);
  await c.withHandle(handle);
  return c;
}

async function post(c: Client, caption: string) {
  const up = await c.upload(pngBytes(8, 8));
  const res = await c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], caption });
  return res.body.post.id as string;
}

describe('follow', () => {
  it('follows, counts, lists and unfollows', async () => {
    const [ana, ben, cy] = [await person('ana_f'), await person('ben_f'), await person('cy_f')];
    const r = await ana.json('POST', '/v1/follows/ben_f');
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({ handle: 'ben_f', followers: 1, following: 0, viewer: { following: true, blocked: false, muted: false } });
    expect((await ana.json('POST', '/v1/follows/ben_f')).body.user.followers).toBe(1);
    await cy.json('POST', '/v1/follows/ben_f');
    await ben.json('POST', '/v1/follows/ana_f');

    const followers = await ben.json('GET', '/v1/users/ben_f/followers');
    expect(followers.body.users.map((u: any) => u.handle).sort()).toEqual(['ana_f', 'cy_f']);
    expect(followers.body.cursor).toBeNull();
    const following = await ana.json('GET', '/v1/users/ana_f/following');
    expect(following.body.users.map((u: any) => u.handle)).toEqual(['ben_f']);

    const prof = await ana.json('GET', '/v1/users/ben_f');
    expect(prof.body.user).toMatchObject({ followers: 2, following: 1, viewer: { following: true } });
    const anon = await new Client().json('GET', '/v1/users/ben_f');
    expect(anon.body.user.followers).toBe(2);
    expect(anon.body.user.viewer).toBeUndefined();

    const un = await ana.json('DELETE', '/v1/follows/ben_f');
    expect(un.body.user).toMatchObject({ followers: 1, viewer: { following: false } });
    expect((await ana.json('DELETE', '/v1/follows/ben_f')).status).toBe(200);
  });

  it('rejects self follow, unknown handles and signed-out calls', async () => {
    const dee = await person('dee_f');
    expect((await dee.json('POST', '/v1/follows/dee_f')).body.error.code).toBe('self');
    expect((await dee.json('POST', '/v1/follows/nobody_here')).status).toBe(404);
    expect((await new Client().json('POST', '/v1/follows/dee_f')).status).toBe(401);
    expect((await new Client().json('GET', '/v1/users/nobody_here/followers')).status).toBe(404);
  });

  it('pages follower lists with a cursor', async () => {
    const star = await person('star_p');
    for (const n of ['p_one', 'p_two', 'p_three']) await (await person(n)).json('POST', '/v1/follows/star_p');
    const first = await star.json('GET', '/v1/users/star_p/followers?limit=2');
    expect(first.body.users).toHaveLength(2);
    expect(first.body.cursor).toBeTruthy();
    const second = await star.json('GET', `/v1/users/star_p/followers?limit=2&cursor=${first.body.cursor}`);
    expect(second.body.users).toHaveLength(1);
    expect(second.body.cursor).toBeNull();
    const all = [...first.body.users, ...second.body.users].map((u: any) => u.handle);
    expect(new Set(all).size).toBe(3);
  });
});

describe('following feed', () => {
  it('shows only people you follow, and everyone by default', async () => {
    const [me, a, b] = [await person('me_ff'), await person('a_ff'), await person('b_ff')];
    const pa = await post(a, 'from a');
    const pb = await post(b, 'from b');
    await me.json('POST', '/v1/follows/a_ff');

    const mine = await me.json('GET', '/v1/feed?mode=following');
    expect(mine.status).toBe(200);
    expect(mine.body.posts.map((p: any) => p.id)).toEqual([pa]);
    expect(mine.body.posts[0].author.viewer.following).toBe(true);

    const everyone = (await me.json('GET', '/v1/feed')).body.posts.map((p: any) => p.id);
    expect(everyone).toEqual(expect.arrayContaining([pa, pb]));

    expect((await new Client().json('GET', '/v1/feed?mode=following')).status).toBe(401);
    expect((await me.json('GET', '/v1/feed?mode=nope')).status).toBe(400);
    const anon = (await new Client().json('GET', '/v1/feed')).body.posts.map((p: any) => p.id);
    expect(anon).toEqual(expect.arrayContaining([pa, pb]));
  });
});

describe('block and mute', () => {
  it('mute hides posts from every feed, unmute restores them', async () => {
    const [me, loud] = [await person('me_m'), await person('loud_m')];
    const p = await post(loud, 'loud post');
    await me.json('POST', '/v1/follows/loud_m');
    const m = await me.json('POST', '/v1/mutes/loud_m');
    expect(m.body.user.viewer).toMatchObject({ muted: true, following: true });
    expect((await me.json('GET', '/v1/feed')).body.posts.map((x: any) => x.id)).not.toContain(p);
    expect((await me.json('GET', '/v1/feed?mode=following')).body.posts).toEqual([]);
    expect((await me.json('GET', '/v1/me/mutes')).body.users.map((u: any) => u.handle)).toEqual(['loud_m']);
    expect((await me.json('GET', '/v1/users/loud_m')).body.posts).toHaveLength(1);
    await me.json('DELETE', '/v1/mutes/loud_m');
    expect((await me.json('GET', '/v1/feed')).body.posts.map((x: any) => x.id)).toContain(p);
  });

  it('block removes follows both ways, hides posts and lists, and stops follows', async () => {
    const [me, bad, third] = [await person('me_b'), await person('bad_b'), await person('third_b')];
    const p = await post(bad, 'bad post');
    const mp = await post(me, 'my post');
    await me.json('POST', '/v1/follows/bad_b');
    await bad.json('POST', '/v1/follows/me_b');
    await bad.json('POST', '/v1/follows/third_b');
    await third.json('POST', '/v1/follows/me_b');

    const b = await me.json('POST', '/v1/blocks/bad_b');
    expect(b.body.user.viewer).toMatchObject({ blocked: true, following: false });
    expect((await me.json('GET', '/v1/users/me_b/followers')).body.users.map((u: any) => u.handle)).toEqual(['third_b']);
    expect((await bad.json('GET', '/v1/users/me_b/following')).status).toBe(404);

    expect((await me.json('GET', '/v1/feed')).body.posts.map((x: any) => x.id)).not.toContain(p);
    expect((await bad.json('GET', '/v1/feed')).body.posts.map((x: any) => x.id)).not.toContain(mp);
    expect((await bad.json('GET', '/v1/feed?mode=following')).body.posts.map((x: any) => x.id)).not.toContain(mp);

    const hidden = await bad.json('POST', '/v1/follows/me_b');
    expect(hidden.status).toBe(404);
    expect((await bad.json('GET', '/v1/users/me_b')).status).toBe(404);
    expect((await me.json('POST', '/v1/follows/bad_b')).body.error.code).toBe('blocked');

    const seen = await me.json('GET', '/v1/users/third_b/followers');
    expect(seen.body.users.map((u: any) => u.handle)).not.toContain('bad_b');
    const thirdSeesBad = await bad.json('GET', '/v1/users/third_b/followers');
    expect(thirdSeesBad.body.users.map((u: any) => u.handle)).not.toContain('me_b');

    expect((await me.json('GET', '/v1/me/blocks')).body.users.map((u: any) => u.handle)).toEqual(['bad_b']);
    await me.json('DELETE', '/v1/blocks/bad_b');
    expect((await me.json('GET', '/v1/me/blocks')).body.users).toEqual([]);
    expect((await me.json('GET', '/v1/feed')).body.posts.map((x: any) => x.id)).toContain(p);
    expect((await bad.json('POST', '/v1/follows/me_b')).status).toBe(200);
  });

  it('requires sign-in and refuses self', async () => {
    const me = await person('me_s');
    expect((await me.json('POST', '/v1/blocks/me_s')).status).toBe(400);
    expect((await me.json('POST', '/v1/mutes/me_s')).status).toBe(400);
    expect((await new Client().json('GET', '/v1/me/blocks')).status).toBe(401);
    expect((await new Client().json('POST', '/v1/mutes/me_s')).status).toBe(401);
  });
});
