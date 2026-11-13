import { describe, expect, it } from 'vitest';
import { Client, makeEnv, pngBytes } from './helpers';

const fakeLimiter = (allowed: number) => {
  const seen = new Map<string, number>();
  return { async limit({ key }: { key: string }) { const n = (seen.get(key) ?? 0) + 1; seen.set(key, n); return { success: n <= allowed }; } };
};

describe('daily limits', () => {
  it('caps new posts per day but lets backdated history through', async () => {
    const c = new Client(makeEnv({ POSTS_PER_DAY: '2' }));
    await c.signIn('cap@example.test');
    await c.withHandle('capper', 'Capper');
    const post = async (body: Record<string, unknown> = {}) => {
      const up = await c.upload(pngBytes(8, 8));
      return c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], ...body });
    };
    expect((await post()).status).toBe(201);
    expect((await post()).status).toBe(201);
    const third = await post();
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('daily_posts');
    expect((await post({ createdAt: '2020-01-01T00:00:00Z' })).status).toBe(201);
  });

  it('caps uploads per day', async () => {
    const c = new Client(makeEnv({ UPLOADS_PER_DAY: '1' }));
    await c.signIn('upcap@example.test');
    await c.withHandle('upcapper', 'Up Capper');
    expect((await c.upload(pngBytes(8, 8))).status).toBe(200);
    const second = await c.json('POST', '/v1/uploads', { contentType: 'image/png', bytes: 10 });
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('daily_uploads');
  });

  it('stops sign-in emails past the daily total', async () => {
    const c = new Client(makeEnv({ SIGNIN_EMAILS_PER_DAY: '1' }));
    await c.json('POST', '/v1/auth/start', { email: 'first-total@example.test' });
    const res = await c.json('POST', '/v1/auth/start', { email: 'second-total@example.test' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('busy');
  });
});

describe('burst limits', () => {
  it('limits sign-in tries per network, only for internet traffic', async () => {
    const c = new Client(makeEnv({ SIGNIN_LIMIT: fakeLimiter(1) as unknown as RateLimit }));
    const ip = { 'CF-Connecting-IP': '203.0.113.9' };
    const start = (email: string, headers: Record<string, string>) =>
      c.call('POST', '/v1/auth/start', undefined, JSON.stringify({ email }), { 'Content-Type': 'application/json', ...headers });
    expect((await start('burst1@example.test', ip)).status).toBe(200);
    expect((await start('burst2@example.test', ip)).status).toBe(429);
    expect((await start('burst3@example.test', {})).status).toBe(200);
  });
});
