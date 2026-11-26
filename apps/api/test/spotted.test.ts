import { describe, expect, it } from 'vitest';
import { Client, pngBytes } from './helpers';

async function person(handle: string) {
  const c = new Client();
  await c.signIn(`${handle}@example.test`);
  await c.withHandle(handle);
  return c;
}

async function post(c: Client) {
  const up = await c.upload(pngBytes(8, 8));
  return (await c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], caption: 'mine' })).body.post.id as string;
}

let ipN = 0;
const fan = async (id: string, body: unknown, ip = `203.0.113.${++ipN}`, anon = new Client()) => {
  const res = await anon.call('POST', `/v1/posts/${id}/spotted`, body, undefined, { 'CF-Connecting-IP': ip });
  return { status: res.status, body: (await res.json()) as any };
};

describe('spotted a copy', () => {
  it('takes a valid link from anyone and tells the creator', async () => {
    const ana = await person('ana_sp');
    const id = await post(ana);
    const res = await fan(id, { url: 'https://example.org/stolen#x', email: 'fan@example.test' });
    expect(res.status).toBe(201);
    expect(res.body.duplicate).toBe(false);
    const list = await ana.json('GET', '/v1/me/spotted');
    expect(list.body.spotted).toHaveLength(1);
    expect(list.body.spotted[0]).toMatchObject({ postId: id, url: 'https://example.org/stolen', email: 'fan@example.test', status: 'new' });
    const n = await ana.json('GET', '/v1/notifications');
    expect(n.body.notifications.find((x: any) => x.kind === 'spotted')).toMatchObject({ postId: id, read: false });
    const row = await ana.env.DB.prepare('SELECT ip_hash FROM spotted').first<{ ip_hash: string }>();
    expect(row!.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.ip_hash).not.toContain('203.0.113');
  });

  it('rejects bad links, our own links and bad emails', async () => {
    const id = await post(await person('ben_sp'));
    for (const url of ['nope', 'ftp://example.org/x', 'javascript:alert(1)', 'https://emera.social/p/abc', 'https://api.emera.social/x', undefined]) {
      const r = await fan(id, { url });
      expect(r.status, String(url)).toBe(400);
      expect(r.body.error.code).toBe('bad_url');
    }
    expect((await fan(id, { url: 'https://example.org/a', email: 'not an email' })).body.error.code).toBe('bad_email');
    expect((await fan('missing', { url: 'https://example.org/a' })).status).toBe(404);
  });

  it('allows one per network per post per hour', async () => {
    const id = await post(await person('cy_sp'));
    const ip = '198.51.100.7';
    expect((await fan(id, { url: 'https://example.org/1' }, ip)).status).toBe(201);
    const again = await fan(id, { url: 'https://example.org/2' }, ip);
    expect(again.status).toBe(429);
    expect(again.body.error.code).toBe('too_many');
    expect((await fan(id, { url: 'https://example.org/2' }, '198.51.100.8')).status).toBe(201);
  });

  it('stops one network after 20 in a day', async () => {
    const ip = '198.51.100.99';
    const c = await person('dee_sp');
    const id = await post(c);
    const { hmacHex } = await import('../src/crypto');
    const hash = await hmacHex((c.env as any).PROOF_SECRET || 'dev', `spotted:${ip}`);
    for (let i = 0; i < 20; i++) {
      await c.env.DB.prepare('INSERT INTO spotted (id, post_id, creator_id, url, ip_hash, status, created_at) SELECT ?, id, user_id, ?, ?, ?, ? FROM posts WHERE id = ?')
        .bind(`b${i}`, `https://example.org/bulk${i}`, hash, 'new', Date.now() - 2 * 3_600_000, id).run();
    }
    const r = await fan(id, { url: 'https://example.org/new-one' }, ip);
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('too_many');
  });

  it('counts the same link on the same post once', async () => {
    const id = await post(await person('eli_sp'));
    const a = await fan(id, { url: 'https://example.org/same' });
    const b = await fan(id, { url: 'https://example.org/same#frag' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.body).toMatchObject({ duplicate: true, spotted: { id: a.body.spotted.id } });
  });

  it('filing makes a normal copy report, dismissing files nothing', async () => {
    const fay = await person('fay_sp');
    const id = await post(fay);
    const a = await fan(id, { url: 'https://example.org/copy-a' });
    const b = await fan(id, { url: 'https://example.org/copy-b' });
    expect((await fay.json('GET', '/v1/reports')).body.reports).toHaveLength(0);

    const filed = await fay.json('POST', `/v1/me/spotted/${a.body.spotted.id}`, { action: 'file' });
    expect(filed.status).toBe(200);
    expect(filed.body.spotted.status).toBe('filed');
    const reports = (await fay.json('GET', '/v1/reports')).body.reports;
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ id: filed.body.spotted.reportId, postId: id, url: 'https://example.org/copy-a', status: 'sent' });

    const dismissed = await fay.json('POST', `/v1/me/spotted/${b.body.spotted.id}`, { action: 'dismiss' });
    expect(dismissed.body.spotted.status).toBe('dismissed');
    expect((await fay.json('GET', '/v1/reports')).body.reports).toHaveLength(1);
    expect((await fay.json('POST', `/v1/me/spotted/${b.body.spotted.id}`, { action: 'file' })).status).toBe(409);
    expect((await fay.json('POST', `/v1/me/spotted/${b.body.spotted.id}`, { action: 'nope' })).status).toBe(400);
  });

  it('only the post owner can file or dismiss', async () => {
    const gus = await person('gus_sp');
    const id = await post(gus);
    const s = await fan(id, { url: 'https://example.org/c' });
    const other = await person('hal_sp');
    expect((await other.json('POST', `/v1/me/spotted/${s.body.spotted.id}`, { action: 'file' })).status).toBe(403);
    expect((await other.json('GET', '/v1/me/spotted')).body.spotted).toHaveLength(0);
    expect((await new Client().json('GET', '/v1/me/spotted')).status).toBe(401);
  });

  it('shows the link and form on the public page and takes a form post', async () => {
    const ivy = await person('ivy_sp');
    const id = await post(ivy);
    const page = await (await new Client().call('GET', `/p/${id}`)).text();
    expect(page).toContain(`href="/p/${id}/spotted"`);
    expect(page).toContain('Spotted a copy?');
    const form = await new Client().call('GET', `/p/${id}/spotted`);
    expect(form.status).toBe(200);
    expect(form.headers.get('content-security-policy')).toContain("form-action 'self'");
    const sent = await new Client().call('POST', `/p/${id}/spotted`, undefined, new URLSearchParams({ url: 'https://example.org/form' }), { 'Content-Type': 'application/x-www-form-urlencoded', 'CF-Connecting-IP': '192.0.2.50' });
    expect(sent.status).toBe(200);
    expect(await sent.text()).toContain('Thank you');
    expect((await ivy.json('GET', '/v1/me/spotted')).body.spotted).toHaveLength(1);
    const bad = await new Client().call('POST', `/p/${id}/spotted`, undefined, new URLSearchParams({ url: 'nope' }), { 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(bad.status).toBe(400);
  });
});

describe('protected badge', () => {
  it('serves an svg for a real handle and 404s otherwise', async () => {
    await person('jo_badge');
    const ok = await new Client().call('GET', '/badge/@jo_badge.svg');
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toContain('image/svg+xml');
    expect(ok.headers.get('cache-control')).toContain('max-age=86400');
    const svg = await ok.text();
    expect(svg).toContain('<svg');
    expect(svg).toContain('Protected by Emera');
    expect((await new Client().call('GET', '/badge/@nobody_here.svg')).status).toBe(404);
  });
});
