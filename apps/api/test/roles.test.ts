import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { Client } from './helpers';

async function person(handle: string) {
  const c = new Client();
  await c.signIn(`${handle}@example.test`);
  await c.withHandle(handle);
  return c;
}

describe('roles screen API', () => {
  it('refuses a non-admin with 403 on list and change', async () => {
    const [kim] = [await person('kim_ro'), await person('lou_ro')];
    expect((await kim.json('GET', '/v1/admin/users')).status).toBe(403);
    const r = await kim.json('PUT', '/v1/admin/users/lou_ro/role', { role: 'mod' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('not_admin');
    expect((await kim.json('GET', '/v1/users/lou_ro')).body.user.role).toBeNull();
    expect((await kim.json('GET', '/v1/me')).body.user.admin).toBe(false);
  });

  it("saves an admin's change and shows it on the user", async () => {
    const [boss] = [await person('boss_ro'), await person('max_ro')];
    await env.DB.prepare(`UPDATE users SET role = 'admin' WHERE handle = 'boss_ro'`).run();
    expect((await boss.json('GET', '/v1/me')).body.user.admin).toBe(true);
    const r = await boss.json('PUT', '/v1/admin/users/max_ro/role', { role: 'mod' });
    expect(r.status).toBe(200);
    expect(r.body.user.role).toBe('mod');
    const row = await env.DB.prepare(`SELECT role FROM users WHERE handle = 'max_ro'`).first<{ role: string }>();
    expect(row?.role).toBe('mod');
    expect((await boss.json('PUT', '/v1/admin/users/max_ro/role', { role: 'creator' })).body.user.role).toBe('creator');
    expect((await boss.json('PUT', '/v1/admin/users/max_ro/role', { role: 'member' })).body.user.role).toBeNull();
    expect((await boss.json('PUT', '/v1/admin/users/max_ro/role', { role: 'admin' })).status).toBe(400);
    expect((await boss.json('PUT', '/v1/admin/users/boss_ro/role', { role: 'member' })).status).toBe(409);
    const list = (await boss.json('GET', '/v1/admin/users?q=max_ro')).body.users;
    expect(list.map((u: any) => u.handle)).toEqual(['max_ro']);
  });
});
