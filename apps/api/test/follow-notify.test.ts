import { describe, expect, it } from 'vitest';
import { Client } from './helpers';

describe('following someone notifies them', () => {
  it('creates one follow notification, none on a repeat follow', async () => {
    const a = new Client();
    await a.signIn('fan@example.test');
    await a.withHandle('fan', 'Fan');
    const b = new Client(a.env);
    await b.signIn('maker@example.test');
    await b.withHandle('maker', 'Maker');

    expect((await a.json('POST', '/v1/follows/maker')).status).toBe(200);
    await a.json('POST', '/v1/follows/maker');

    const list = await b.json('GET', '/v1/notifications');
    const follows = list.body.notifications.filter((n: { kind: string }) => n.kind === 'follow');
    expect(follows).toHaveLength(1);
    expect(follows[0].actor.handle).toBe('fan');
  });
});
