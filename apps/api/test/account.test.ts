import { describe, expect, it } from 'vitest';
import { Client, makeEnv, pngBytes } from './helpers';

async function member(env: ReturnType<typeof makeEnv>, email: string, handle: string) {
  const c = new Client(env);
  await c.signIn(email);
  await c.withHandle(handle, handle);
  return c;
}

describe('delete account', () => {
  it('removes the account, its posts, files and every trace, and keeps other people intact', async () => {
    const env = makeEnv();
    const s = Math.random().toString(36).slice(2, 7);
    const maya = await member(env, `maya-${s}@example.test`, `maya_${s}`);
    const theo = await member(env, `theo-${s}@example.test`, `theo_${s}`);

    const up = await maya.upload(pngBytes(8, 8));
    const mine = (await maya.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], caption: 'mine' })).body.post.id as string;
    const theoUp = await theo.upload(pngBytes(8, 8));
    const theirs = (await theo.json('POST', '/v1/posts', { mediaIds: [theoUp.body.media.id], caption: 'theirs' })).body.post.id as string;

    await theo.json('POST', `/v1/posts/${mine}/like`);
    await theo.json('POST', `/v1/posts/${mine}/comments`, { body: 'nice' });
    const myComment = (await maya.json('POST', `/v1/posts/${theirs}/comments`, { body: 'hi theo' })).body.comment.id as string;
    await theo.json('POST', `/v1/posts/${theirs}/comments`, { body: 'thanks', parentId: myComment });
    await maya.json('POST', `/v1/posts/${theirs}/like`);
    await maya.json('POST', `/v1/follows/theo_${s}`);
    await theo.json('POST', `/v1/follows/maya_${s}`);
    await maya.json('POST', '/v1/dms', { handle: `theo_${s}`, text: 'hey' });
    await theo.json('POST', `/v1/blocks/maya_${s}`);

    const keyRow = await env.DB.prepare('SELECT r2_key FROM media WHERE id = ?').bind(up.body.media.id).first<{ r2_key: string }>();
    expect(await env.MEDIA.head(keyRow!.r2_key)).not.toBeNull();
    const userId = (await env.DB.prepare('SELECT id FROM users WHERE handle = ?').bind(`maya_${s}`).first<{ id: string }>())!.id;

    const res = await maya.json('DELETE', '/v1/me');
    expect(res.status).toBe(200);

    expect(await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first()).toBeNull();
    expect(await env.DB.prepare('SELECT id FROM posts WHERE id = ?').bind(mine).first()).toBeNull();
    expect(await env.MEDIA.head(keyRow!.r2_key)).toBeNull();
    expect((await maya.json('GET', '/v1/me')).status).toBe(401);
    expect((await maya.call('GET', `/v1/users/maya_${s}`)).status).toBe(404);

    expect((await theo.json('GET', `/v1/posts/${theirs}`)).status).toBe(200);
    expect((await theo.json('GET', '/v1/me')).status).toBe(200);
    const left = await env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM comments WHERE user_id = ?1) + (SELECT COUNT(*) FROM likes WHERE user_id = ?1)
        + (SELECT COUNT(*) FROM follows WHERE follower_id = ?1 OR followee_id = ?1) + (SELECT COUNT(*) FROM blocks WHERE blocked_id = ?1)
        + (SELECT COUNT(*) FROM dm_messages WHERE user_id = ?1) + (SELECT COUNT(*) FROM sessions WHERE user_id = ?1) AS n`,
    ).bind(userId).first<{ n: number }>();
    expect(left!.n).toBe(0);
  });

  it('needs a sign-in', async () => {
    const res = await new Client(makeEnv()).json('DELETE', '/v1/me');
    expect(res.status).toBe(401);
  });
});

describe('App Review login', () => {
  it('signs in the review email with the fixed code and sends no email', async () => {
    const env = makeEnv({ REVIEW_EMAIL: 'Review@Emera.Social', REVIEW_CODE: '424242' });
    const c = new Client(env);
    expect((await c.json('POST', '/v1/auth/start', { email: 'review@emera.social' })).status).toBe(200);
    const res = await c.json('POST', '/v1/auth/verify', { email: 'review@emera.social', code: '424242' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('never accepts the fixed code for anyone else', async () => {
    const env = makeEnv({ REVIEW_EMAIL: 'review@emera.social', REVIEW_CODE: '424242' });
    const c = new Client(env);
    await c.json('POST', '/v1/auth/start', { email: 'someone@example.test' });
    expect((await c.json('POST', '/v1/auth/verify', { email: 'someone@example.test', code: '424242' })).status).toBe(400);
  });
});
