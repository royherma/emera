import { describe, expect, it } from 'vitest';
import app from '../src/index';
import { Client, ORIGIN, makeEnv } from './helpers';

async function person(handle: string) {
  const c = new Client();
  await c.signIn(`${handle}@example.test`);
  await c.withHandle(handle);
  return c;
}

async function open(path: string) {
  const res = await app.fetch(new Request(`${ORIGIN}${path}`, { headers: { Upgrade: 'websocket' } }), makeEnv());
  expect(res.status).toBe(101);
  const ws = res.webSocket!;
  ws.accept();
  const got: string[] = [];
  ws.addEventListener('message', (e) => { got.push(String(e.data)); });
  return { ws, got };
}

const settle = async (got: string[], n = 1) => {
  for (let i = 0; i < 50 && got.length < n; i++) await new Promise((r) => setTimeout(r, 20));
};

describe('live delivery', () => {
  it('pings a channel socket when someone posts or deletes, never sends the text', async () => {
    const [ana, ben] = [await person('ana_live'), await person('ben_live')];
    const t = await ben.json('POST', '/v1/chat/live', { kind: 'channel', id: 'news' });
    expect(t.status).toBe(200);
    const { ws, got } = await open(t.body.path);
    const sent = await ana.json('POST', '/v1/channels/news/messages', { body: 'secret-ish words' });
    await settle(got);
    expect(JSON.parse(got[0])).toEqual({ t: 'new', room: 'channel:news' });
    await ana.json('DELETE', `/v1/channels/news/messages/${sent.body.message.id}`);
    await settle(got, 2);
    expect(JSON.parse(got[1]).t).toBe('deleted');
    expect(got.join('')).not.toContain('secret-ish');
    ws.close();
  });

  it('pings both people in a conversation and only members get a ticket', async () => {
    const [ana, ben, cy] = [await person('ana_live2'), await person('ben_live2'), await person('cy_live2')];
    const start = await ana.json('POST', '/v1/dms', { handle: 'ben_live2', body: 'hi' });
    const tid = start.body.thread.id;
    expect((await cy.json('POST', '/v1/chat/live', { kind: 'dm', id: tid })).status).toBe(404);
    const { ws, got } = await open((await ben.json('POST', '/v1/chat/live', { kind: 'dm', id: tid })).body.path);
    await ana.json('POST', `/v1/dms/${tid}/messages`, { body: 'are you there' });
    await settle(got);
    expect(JSON.parse(got[0])).toEqual({ t: 'new', room: `dm:${tid}` });
    ws.close();
  });

  it('refuses a forged, expired or missing ticket and a plain GET', async () => {
    const ana = await person('ana_live3');
    const { path } = (await ana.json('POST', '/v1/chat/live', { kind: 'channel', id: 'lobby' })).body;
    const forged = path.replace('channel%253Alobby', 'channel%253Anews');
    for (const p of [forged, '/v1/chat/live?ticket=x.1.y', '/v1/chat/live']) {
      const res = await app.fetch(new Request(`${ORIGIN}${p}`, { headers: { Upgrade: 'websocket' } }), makeEnv());
      expect(res.status).toBe(401);
    }
    expect((await app.fetch(new Request(`${ORIGIN}${path}`), makeEnv())).status).toBe(426);
    expect((await ana.json('POST', '/v1/chat/live', { kind: 'channel', id: 'nope' })).status).toBe(404);
    expect((await new Client().json('POST', '/v1/chat/live', { kind: 'channel', id: 'lobby' })).status).toBe(401);
  });
});
