import { describe, expect, it } from 'vitest';
import { Client, makeEnv, pngBytes } from './helpers';
import { notify } from '../src/notifications';

async function member(env: ReturnType<typeof makeEnv>, email: string, handle: string) {
  const c = new Client(env);
  await c.signIn(email);
  await c.withHandle(handle, handle);
  return c;
}

async function makePost(c: Client, caption = 'hello') {
  const up = await c.upload(pngBytes(8, 8));
  const res = await c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], caption });
  return res.body.post.id as string;
}

async function setup() {
  const env = makeEnv();
  const stamp = Math.random().toString(36).slice(2, 7);
  const maya = await member(env, `maya-${stamp}@example.test`, `maya_${stamp}`);
  const theo = await member(env, `theo-${stamp}@example.test`, `theo_${stamp}`);
  const ines = await member(env, `ines-${stamp}@example.test`, `ines_${stamp}`);
  const postId = await makePost(maya);
  return { env, maya, theo, ines, postId };
}

describe('likes', () => {
  it('likes once, counts, unlikes, and shows viewer.liked', async () => {
    const { maya, theo, postId } = await setup();
    const first = await theo.json('POST', `/v1/posts/${postId}/like`);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ liked: true, likeCount: 1 });
    expect((await theo.json('POST', `/v1/posts/${postId}/like`)).body.likeCount).toBe(1);
    expect((await maya.json('POST', `/v1/posts/${postId}/like`)).body.likeCount).toBe(2);

    const seen = await theo.json('GET', `/v1/posts/${postId}`);
    expect(seen.body.post).toMatchObject({ likeCount: 2, commentCount: 0, viewer: { liked: true } });
    const anon = await new Client(theo.env).json('GET', `/v1/posts/${postId}`);
    expect(anon.body.post).toMatchObject({ likeCount: 2, viewer: { liked: false } });
    const feed = await theo.json('GET', '/v1/feed');
    expect(feed.body.posts.find((p: any) => p.id === postId).viewer.liked).toBe(true);

    const gone = await theo.json('DELETE', `/v1/posts/${postId}/like`);
    expect(gone.body).toEqual({ liked: false, likeCount: 1 });
    expect((await theo.json('GET', `/v1/posts/${postId}`)).body.post.viewer.liked).toBe(false);
  });

  it('needs a sign-in and a real post', async () => {
    const { theo, postId, env } = await setup();
    expect((await new Client(env).json('POST', `/v1/posts/${postId}/like`)).status).toBe(401);
    expect((await theo.json('POST', '/v1/posts/nope/like')).status).toBe(404);
    expect((await theo.json('DELETE', '/v1/posts/nope/like')).status).toBe(404);
  });
});

describe('comments', () => {
  it('posts a comment and a reply, lists them as threads, counts them', async () => {
    const { maya, theo, ines, postId } = await setup();
    const top = await theo.json('POST', `/v1/posts/${postId}/comments`, { body: '  Love the light  ' });
    expect(top.status).toBe(201);
    expect(top.body.comment).toMatchObject({ body: 'Love the light', parentId: null, replies: [] });
    const reply = await maya.json('POST', `/v1/posts/${postId}/comments`, { body: 'Thank you', parentId: top.body.comment.id });
    expect(reply.status).toBe(201);
    expect(reply.body.comment.parentId).toBe(top.body.comment.id);
    await ines.json('POST', `/v1/posts/${postId}/comments`, { body: 'Same' });

    const list = await ines.json('GET', `/v1/posts/${postId}/comments`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(3);
    expect(list.body.comments).toHaveLength(2);
    expect(list.body.comments[0].body).toBe('Love the light');
    expect(list.body.comments[0].replies).toHaveLength(1);
    expect(list.body.comments[0].replies[0].author.handle).toMatch(/^maya_/);
    expect((await ines.json('GET', `/v1/posts/${postId}`)).body.post.commentCount).toBe(3);
  });

  it('pages top-level comments with a cursor', async () => {
    const { theo, postId } = await setup();
    for (let i = 0; i < 3; i++) await theo.json('POST', `/v1/posts/${postId}/comments`, { body: `c${i}` });
    const a = await theo.json('GET', `/v1/posts/${postId}/comments?limit=2`);
    expect(a.body.comments.map((x: any) => x.body)).toEqual(['c0', 'c1']);
    expect(a.body.cursor).toBeTruthy();
    const b = await theo.json('GET', `/v1/posts/${postId}/comments?limit=2&cursor=${a.body.cursor}`);
    expect(b.body.comments.map((x: any) => x.body)).toEqual(['c2']);
    expect(b.body.cursor).toBeNull();
  });

  it('rejects empty, long, bad-parent and second-level replies', async () => {
    const { maya, theo, postId } = await setup();
    const other = await makePost(maya, 'other');
    const top = (await theo.json('POST', `/v1/posts/${postId}/comments`, { body: 'one' })).body.comment;
    const reply = (await maya.json('POST', `/v1/posts/${postId}/comments`, { body: 'two', parentId: top.id })).body.comment;
    expect((await theo.json('POST', `/v1/posts/${postId}/comments`, { body: '   ' })).body.error.code).toBe('bad_comment');
    expect((await theo.json('POST', `/v1/posts/${postId}/comments`, { body: 'x'.repeat(501) })).body.error.code).toBe('comment_too_long');
    expect((await theo.json('POST', `/v1/posts/${postId}/comments`, { body: 'x'.repeat(500) })).status).toBe(201);
    expect((await theo.json('POST', `/v1/posts/${postId}/comments`, { body: 'hi', parentId: 'missing' })).body.error.code).toBe('bad_parent');
    expect((await theo.json('POST', `/v1/posts/${other}/comments`, { body: 'hi', parentId: top.id })).body.error.code).toBe('bad_parent');
    expect((await theo.json('POST', `/v1/posts/${postId}/comments`, { body: 'hi', parentId: reply.id })).body.error.code).toBe('bad_parent');
    expect((await new Client(theo.env).json('POST', `/v1/posts/${postId}/comments`, { body: 'hi' })).status).toBe(401);
  });

  it('rate-limits a burst of comments', async () => {
    const { theo, postId } = await setup();
    let last = 201;
    for (let i = 0; i < 11; i++) last = (await theo.json('POST', `/v1/posts/${postId}/comments`, { body: `n${i}` })).status;
    expect(last).toBe(429);
  });

  it('lets the commenter or the post author delete, nobody else', async () => {
    const { maya, theo, ines, postId } = await setup();
    const mine = (await theo.json('POST', `/v1/posts/${postId}/comments`, { body: 'mine' })).body.comment;
    const reply = (await ines.json('POST', `/v1/posts/${postId}/comments`, { body: 'reply', parentId: mine.id })).body.comment;
    expect((await ines.json('DELETE', `/v1/comments/${mine.id}`)).status).toBe(403);
    expect((await theo.json('DELETE', `/v1/comments/${mine.id}`)).body).toEqual({ ok: true });
    expect((await theo.json('GET', `/v1/posts/${postId}`)).body.post.commentCount).toBe(0);
    expect((await theo.json('DELETE', `/v1/comments/${reply.id}`)).status).toBe(404);

    const again = (await theo.json('POST', `/v1/posts/${postId}/comments`, { body: 'again' })).body.comment;
    expect((await maya.json('DELETE', `/v1/comments/${again.id}`)).body).toEqual({ ok: true });
    expect((await maya.json('DELETE', `/v1/comments/${again.id}`)).status).toBe(404);
  });

  it('removes likes, comments and notifications when the post is deleted', async () => {
    const { maya, theo, postId } = await setup();
    await theo.json('POST', `/v1/posts/${postId}/like`);
    await theo.json('POST', `/v1/posts/${postId}/comments`, { body: 'nice' });
    expect((await maya.json('GET', '/v1/notifications')).body.notifications.length).toBeGreaterThan(0);
    expect((await maya.json('DELETE', `/v1/posts/${postId}`)).status).toBe(200);
    expect((await maya.json('GET', '/v1/notifications')).body.notifications).toHaveLength(0);
  });
});

describe('notifications', () => {
  it('notifies the author of likes, comments and replies, never yourself', async () => {
    const { maya, theo, ines, postId } = await setup();
    await maya.json('POST', `/v1/posts/${postId}/like`);
    await maya.json('POST', `/v1/posts/${postId}/comments`, { body: 'my own' });
    expect((await maya.json('GET', '/v1/notifications')).body.notifications).toHaveLength(0);

    await theo.json('POST', `/v1/posts/${postId}/like`);
    const top = (await theo.json('POST', `/v1/posts/${postId}/comments`, { body: 'Beautiful' })).body.comment;
    await ines.json('POST', `/v1/posts/${postId}/comments`, { body: 'Agreed', parentId: top.id });

    const mine = await maya.json('GET', '/v1/notifications');
    expect(mine.body.unread).toBe(3);
    expect(mine.body.notifications.map((n: any) => n.kind).sort()).toEqual(['comment', 'comment', 'like']);
    const likeNote = mine.body.notifications.find((n: any) => n.kind === 'like');
    expect(likeNote).toMatchObject({ postId, read: false, count: 1 });
    expect(likeNote.actor.handle).toMatch(/^theo_/);
    expect(likeNote.thumbUrl).toContain('/media/');
    const commentNote = mine.body.notifications.find((n: any) => n.preview === 'Beautiful');
    expect(commentNote.commentId).toBe(top.id);

    const theirs = await theo.json('GET', '/v1/notifications');
    expect(theirs.body.notifications.map((n: any) => [n.kind, n.preview])).toEqual([['reply', 'Agreed']]);
  });

  it('groups likes on the same post while unread, and re-likes by the same person add nothing', async () => {
    const { maya, theo, ines, postId } = await setup();
    await theo.json('POST', `/v1/posts/${postId}/like`);
    await theo.json('DELETE', `/v1/posts/${postId}/like`);
    await theo.json('POST', `/v1/posts/${postId}/like`);
    await ines.json('POST', `/v1/posts/${postId}/like`);
    const list = (await maya.json('GET', '/v1/notifications')).body;
    expect(list.notifications).toHaveLength(1);
    expect(list.notifications[0]).toMatchObject({ kind: 'like', count: 2 });
    expect(list.notifications[0].actor.handle).toMatch(/^ines_/);
  });

  it('marks read, all or by id, and reports the unread count', async () => {
    const { maya, theo, ines, postId } = await setup();
    await theo.json('POST', `/v1/posts/${postId}/comments`, { body: 'a' });
    await ines.json('POST', `/v1/posts/${postId}/comments`, { body: 'b' });
    expect((await maya.json('GET', '/v1/notifications/unread-count')).body).toEqual({ unread: 2 });
    const [first] = (await maya.json('GET', '/v1/notifications')).body.notifications;
    expect((await maya.json('POST', '/v1/notifications/read', { ids: [first.id] })).body).toEqual({ ok: true, unread: 1 });
    expect((await theo.json('POST', '/v1/notifications/read', { ids: [first.id] })).body.unread).toBe(0);
    expect((await maya.json('GET', '/v1/notifications/unread-count')).body.unread).toBe(1);
    expect((await maya.json('POST', '/v1/notifications/read')).body).toEqual({ ok: true, unread: 0 });
    const after = (await maya.json('GET', '/v1/notifications')).body.notifications;
    expect(after.every((n: any) => n.read)).toBe(true);
  });

  it('pages with a cursor, newest first', async () => {
    const { maya, theo, ines, postId } = await setup();
    await theo.json('POST', `/v1/posts/${postId}/comments`, { body: 'a' });
    await ines.json('POST', `/v1/posts/${postId}/comments`, { body: 'b' });
    await theo.json('POST', `/v1/posts/${postId}/like`);
    const a = (await maya.json('GET', '/v1/notifications?limit=2')).body;
    expect(a.notifications).toHaveLength(2);
    expect(a.cursor).toBeTruthy();
    const b = (await maya.json('GET', `/v1/notifications?limit=2&cursor=${a.cursor}`)).body;
    expect(b.notifications).toHaveLength(1);
    expect(b.cursor).toBeNull();
  });

  it('needs a sign-in', async () => {
    const { env } = await setup();
    expect((await new Client(env).json('GET', '/v1/notifications')).status).toBe(401);
    expect((await new Client(env).json('POST', '/v1/notifications/read')).status).toBe(401);
  });

  it('notify() takes a follow, skips self, and leaves follows ungrouped', async () => {
    const { env, maya, theo } = await setup();
    const me = (await maya.json('GET', '/v1/me')).body.user.id;
    const them = (await theo.json('GET', '/v1/me')).body.user.id;
    await notify(env, { userId: me, kind: 'follow', actorId: me });
    await notify(env, { userId: me, kind: 'follow', actorId: them });
    await notify(env, { userId: me, kind: 'follow', actorId: them });
    const list = (await maya.json('GET', '/v1/notifications')).body.notifications;
    expect(list.map((n: any) => n.kind)).toEqual(['follow', 'follow']);
    expect(list[0].postId).toBeNull();
  });
});
