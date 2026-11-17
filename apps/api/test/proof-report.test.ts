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

describe('proof sheet', () => {
  it('says who posted, when, and that the file matches its signature', async () => {
    const ana = await person('ana_pr');
    const id = await post(ana, 'hello');
    const res = await new Client().json('GET', `/v1/posts/${id}/proof`);
    expect(res.status).toBe(200);
    expect(res.body.proof).toMatchObject({ postId: id, author: { handle: 'ana_pr', verifiedBy: 'email' }, files: { total: 1, intact: 1 }, imported: null });
    expect(Date.parse(res.body.proof.firstPostedAt)).toBeGreaterThan(0);
  });

  it('flags a file whose signature no longer matches', async () => {
    const ben = await person('ben_pr');
    const id = await post(ben, 'tamper');
    await ben.env.DB.prepare('UPDATE media SET sha256 = ? WHERE post_id = ?').bind('0'.repeat(64), id).run();
    const res = await ben.json('GET', `/v1/posts/${id}/proof`);
    expect(res.body.proof.files).toEqual({ total: 1, intact: 0 });
  });

  it('shows where an imported post came from', async () => {
    const cy = await person('cy_pr');
    const id = await post(cy, 'imported');
    await cy.env.DB.prepare(`INSERT INTO imported_items (user_id, item_id, source, post_id, created_at, item_url) SELECT id, 'i1', 'feed:x', ?, 1, 'https://www.example.org/p/1' FROM users WHERE handle = 'cy_pr'`).bind(id).run();
    const res = await cy.json('GET', `/v1/posts/${id}/proof`);
    expect(res.body.proof.imported).toMatchObject({ from: 'example.org', link: 'https://www.example.org/p/1' });
  });

  it('404s on a missing post', async () => {
    expect((await new Client().json('GET', '/v1/posts/nope/proof')).status).toBe(404);
  });
});

describe('reports', () => {
  it('files a report, lists it with a thumbnail, and a mod moves its status', async () => {
    const dee = await person('dee_pr');
    const id = await post(dee, 'mine');
    const sent = await dee.json('POST', '/v1/reports', { postId: id, url: 'https://copy.example/x' });
    expect(sent.status).toBe(201);
    expect(sent.body.report.status).toBe('sent');

    const mine = await dee.json('GET', '/v1/reports');
    expect(mine.body.reports).toHaveLength(1);
    expect(mine.body.reports[0]).toMatchObject({ postId: id, status: 'sent', url: 'https://copy.example/x' });
    expect(mine.body.reports[0].thumbUrl).toContain('/media/');

    expect((await dee.json('GET', '/v1/mod/reports')).status).toBe(403);
    expect((await dee.json('PATCH', `/v1/mod/reports/${sent.body.report.id}`, { status: 'filing' })).status).toBe(403);

    const mod = await person('mod_pr');
    await mod.env.DB.prepare(`UPDATE users SET role = 'mod' WHERE handle = 'mod_pr'`).run();
    const all = await mod.json('GET', '/v1/mod/reports');
    expect(all.body.reports.map((r: any) => r.id)).toContain(sent.body.report.id);
    expect((await mod.json('PATCH', `/v1/mod/reports/${sent.body.report.id}`, { status: 'bogus' })).status).toBe(400);
    const moved = await mod.json('PATCH', `/v1/mod/reports/${sent.body.report.id}`, { status: 'filing' });
    expect(moved.body.report).toMatchObject({ status: 'filing', reporter: 'dee_pr' });
    expect((await dee.json('GET', '/v1/reports')).body.reports[0].status).toBe('filing');
    expect((await mod.json('PATCH', '/v1/mod/reports/missing', { status: 'filing' })).status).toBe(404);
  });

  it('only lets people report copies of their own posts', async () => {
    const eve = await person('eve_pr');
    const fay = await person('fay_pr');
    const id = await post(eve, 'mine');
    expect((await fay.json('POST', '/v1/reports', { postId: id, url: 'https://copy.example/y' })).status).toBe(403);
  });
});
