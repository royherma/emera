import { env } from 'cloudflare:workers';
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
  return (await c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], caption })).body.post.id as string;
}

describe('moderator queue', () => {
  it('gives a member 403 on the queue and on resolving', async () => {
    const mem = await person('mem_mq');
    const q = await mem.json('GET', '/v1/mod/queue');
    expect(q.status).toBe(403);
    expect(q.body.error.code).toBe('not_moderator');
    expect((await mem.json('POST', '/v1/mod/queue/report/x', { action: 'resolve' })).status).toBe(403);
    expect((await new Client().json('GET', '/v1/mod/queue')).status).toBe(401);
  });

  it('lets a moderator list and resolve a report, and the row changes', async () => {
    const [ana, ben, mod] = [await person('ana_mq'), await person('ben_mq'), await person('mod_mq')];
    await env.DB.prepare(`UPDATE users SET role = 'mod' WHERE handle = 'mod_mq'`).run();
    const id = await post(ana, 'mine');
    const rep = (await ana.json('POST', '/v1/reports', { postId: id, url: 'https://copy.example/mq', note: 'stolen' })).body.report.id;
    const flag = (await ben.json('POST', '/v1/flags', { targetType: 'post', targetId: id, reason: 'spam' })).body.flag.id;

    const q = await mod.json('GET', '/v1/mod/queue');
    expect(q.status).toBe(200);
    expect(q.body.items.map((i: any) => `${i.kind}:${i.id}`)).toEqual(expect.arrayContaining([`report:${rep}`, `flag:${flag}`]));

    const done = await mod.json('POST', `/v1/mod/queue/report/${rep}`, { action: 'resolve' });
    expect(done.status).toBe(200);
    const row = await env.DB.prepare('SELECT r.status, r.resolved_at, u.handle FROM reports r JOIN users u ON u.id = r.resolved_by WHERE r.id = ?')
      .bind(rep).first<{ status: string; resolved_at: number; handle: string }>();
    expect(row).toMatchObject({ status: 'resolved', handle: 'mod_mq' });
    expect(row!.resolved_at).toBeGreaterThan(0);

    expect((await mod.json('POST', `/v1/mod/queue/flag/${flag}`, { action: 'dismiss' })).status).toBe(200);
    expect((await env.DB.prepare('SELECT status FROM flags WHERE id = ?').bind(flag).first<{ status: string }>())!.status).toBe('dismissed');

    const after = (await mod.json('GET', '/v1/mod/queue')).body.items.map((i: any) => i.id);
    expect(after).not.toContain(rep);
    expect(after).not.toContain(flag);
    expect((await mod.json('POST', `/v1/mod/queue/report/${rep}`, { action: 'dismiss' })).status).toBe(404);
    expect((await mod.json('POST', `/v1/mod/queue/report/${rep}`, { action: 'delete' })).status).toBe(400);
  });

  it('serves the queue page with no data in it', async () => {
    const res = await new Client().call('GET', '/mod');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Moderation queue');
  });
});
