import { describe, expect, it } from 'vitest';
import { Client } from './helpers';
import { planFor, routesFor } from '../src/advise';

describe('protect advisor', () => {
  it('puts the free route first and adds money routes only when they earned from it', () => {
    const base = { kind: 'repost', where: 'us', registered: 'no', madeMoney: 'no', posts: 'few' } as const;
    expect(routesFor(base).map((r) => r.id)).toEqual(['takedown']);
    expect(routesFor({ ...base, madeMoney: 'yes' }).map((r) => r.id)).toEqual(['takedown', 'claim', 'register', 'ccb']);
    expect(routesFor({ ...base, madeMoney: 'yes', registered: 'yes' }).map((r) => r.id)).toEqual(['takedown', 'claim', 'ccb', 'court']);
    expect(routesFor({ ...base, kind: 'fake' }).map((r) => r.id)).toEqual(['impersonation']);
    expect(routesFor({ ...base, where: 'other', madeMoney: 'yes' }).map((r) => r.id)).toEqual(['takedown', 'claim']);
  });

  it('recommends the cheapest plan that covers the case', () => {
    const base = { kind: 'repost', where: 'us', registered: 'no', madeMoney: 'no', posts: 'few' } as const;
    expect(planFor(base).id).toBe('free');
    expect(planFor({ ...base, posts: 'weekly' }).id).toBe('creator');
    expect(planFor({ ...base, kind: 'fake' }).id).toBe('pro');
  });

  it('answers over HTTP with routes, a plan and a summary even without AI', async () => {
    const res = await new Client().call('POST', '/v1/protect/advise', { kind: 'merch', where: 'us', registered: 'unsure', madeMoney: 'yes', posts: 'weekly' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.routes[0].id).toBe('takedown');
    expect(body.plan.id).toBe('creator');
    expect(body.summary.length).toBeGreaterThan(20);
  });
});
