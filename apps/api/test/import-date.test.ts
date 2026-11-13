import { describe, expect, it } from 'vitest';
import { Client, pngBytes } from './helpers';

describe('imported posts keep their date', () => {
  it('accepts a past createdAt, rejects future and junk, and orders the profile by it', async () => {
    const c = new Client();
    await c.signIn('olddate@example.test');
    await c.withHandle('olddate', 'Old Date');
    const post = async (body: Record<string, unknown>) => {
      const up = await c.upload(pngBytes(8, 8));
      return c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], ...body });
    };

    const old = await post({ caption: 'from 2019', createdAt: '2019-06-01T10:00:00Z' });
    expect(old.status).toBe(201);
    const fresh = await post({ caption: 'today' });
    expect(fresh.status).toBe(201);

    expect((await post({ createdAt: '2999-01-01T00:00:00Z' })).body.error.code).toBe('bad_date');
    expect((await post({ createdAt: 'yesterday-ish' })).body.error.code).toBe('bad_date');

    const profile = await c.json('GET', '/v1/users/olddate');
    expect(profile.body.posts.map((p: { caption: string }) => p.caption)).toEqual(['today', 'from 2019']);
    expect(Date.parse(profile.body.posts[1].createdAt)).toBe(Date.parse('2019-06-01T10:00:00Z'));
  });
});
