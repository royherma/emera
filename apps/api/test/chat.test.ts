import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { Client, makeEnv, pngBytes } from './helpers';

async function person(handle: string) {
  const c = new Client();
  await c.signIn(`${handle}@example.test`);
  await c.withHandle(handle);
  return c;
}

describe('channels', () => {
  it('lists the starting channels, posts, reads new messages after a cursor', async () => {
    const [ana, ben] = [await person('ana_ch'), await person('ben_ch')];
    const list = await ana.json('GET', '/v1/channels');
    expect(list.body.channels.map((c: any) => c.id)).toEqual(['lobby', 'feedback', 'news']);

    const first = await ana.json('GET', '/v1/channels/feedback/messages');
    const sent = await ana.json('POST', '/v1/channels/feedback/messages', { body: '  hello all  ' });
    expect(sent.status).toBe(201);
    expect(sent.body.message).toMatchObject({ body: 'hello all', mine: true, user: { handle: 'ana_ch' } });

    const news = await ben.json('GET', `/v1/channels/feedback/messages?after=${first.body.latest ?? ''}`);
    expect(news.body.messages.map((m: any) => m.body)).toContain('hello all');
    expect(news.body.messages.find((m: any) => m.body === 'hello all').mine).toBe(false);
    expect((await ben.json('GET', '/v1/channels')).body.channels.find((c: any) => c.id === 'feedback').unread).toBe(true);
    await ben.json('POST', '/v1/channels/feedback/read');
    expect((await ben.json('GET', '/v1/channels')).body.channels.find((c: any) => c.id === 'feedback').unread).toBe(false);

    const again = await ben.json('GET', `/v1/channels/feedback/messages?after=${news.body.latest}`);
    expect(again.body.messages).toHaveLength(0);
    expect(again.body.latest).toBe(news.body.latest);
  });

  it('rejects empty, long, signed-out and unknown-channel posts', async () => {
    const cy = await person('cy_ch');
    expect((await cy.json('POST', '/v1/channels/lobby/messages', { body: '   ' })).body.error.code).toBe('bad_message');
    expect((await cy.json('POST', '/v1/channels/lobby/messages', { body: 'x'.repeat(2001) })).body.error.code).toBe('message_too_long');
    expect((await new Client().json('GET', '/v1/channels')).status).toBe(401);
    expect((await cy.json('GET', '/v1/channels/nope/messages')).status).toBe(404);
  });

  it('hides messages from people you blocked or muted', async () => {
    const [dee, eve] = [await person('dee_ch'), await person('eve_ch')];
    await eve.json('POST', '/v1/channels/news/messages', { body: 'from eve' });
    const seen = async () => (await dee.json('GET', '/v1/channels/news/messages')).body.messages.map((m: any) => m.body);
    expect(await seen()).toContain('from eve');
    await dee.json('POST', '/v1/mutes/eve_ch');
    expect(await seen()).not.toContain('from eve');
    await dee.json('DELETE', '/v1/mutes/eve_ch');
    await eve.json('POST', '/v1/blocks/dee_ch');
    expect(await seen()).not.toContain('from eve');
  });

  it('lets authors and moderators delete, nobody else', async () => {
    const [fay, gus, mod] = [await person('fay_ch'), await person('gus_ch'), await person('mod_ch')];
    const m = (await fay.json('POST', '/v1/channels/lobby/messages', { body: 'delete me' })).body.message;
    expect((await gus.json('DELETE', `/v1/channels/lobby/messages/${m.id}`)).status).toBe(403);
    const modId = (await mod.json('GET', '/v1/me')).body.user.id;
    await env.DB.prepare(`INSERT INTO channel_mods (channel_id, user_id, created_at) VALUES ('*', ?, 0)`).bind(modId).run();
    expect((await mod.json('DELETE', `/v1/channels/lobby/messages/${m.id}`)).status).toBe(200);
    const after = (await gus.json('GET', '/v1/channels/lobby/messages')).body.messages.find((x: any) => x.id === m.id);
    expect(after).toMatchObject({ deleted: true, body: '' });
  });

  it('shows a role badge on names and lets a mod role delete', async () => {
    const [ivy, jon] = [await person('ivy_ch'), await person('jon_ch')];
    const m = (await jon.json('POST', '/v1/channels/lobby/messages', { body: 'hi all' })).body.message;
    expect(m.user.role).toBeNull();
    await env.DB.prepare(`UPDATE users SET role = 'mod' WHERE handle = 'ivy_ch'`).run();
    const said = (await ivy.json('POST', '/v1/channels/lobby/messages', { body: 'welcome' })).body.message;
    expect(said.user.role).toBe('mod');
    const list = (await jon.json('GET', '/v1/channels/lobby/messages')).body.messages;
    expect(list.find((x: any) => x.id === said.id).user.role).toBe('mod');
    expect((await ivy.json('GET', '/v1/users/ivy_ch')).body.user.role).toBe('mod');
    expect((await ivy.json('DELETE', `/v1/channels/lobby/messages/${m.id}`)).status).toBe(200);
  });

  it('enforces slow mode and the per-minute cap', async () => {
    const hal = await person('hal_ch');
    await env.DB.prepare(`UPDATE channels SET slow_seconds = 30 WHERE id = 'news'`).run();
    expect((await hal.json('POST', '/v1/channels/news/messages', { body: 'one' })).status).toBe(201);
    expect((await hal.json('POST', '/v1/channels/news/messages', { body: 'two' })).body.error.code).toBe('slow_mode');
    await env.DB.prepare(`UPDATE channels SET slow_seconds = 0 WHERE id = 'news'`).run();
    let last = 0;
    for (let i = 0; i < 20; i++) last = (await hal.json('POST', '/v1/channels/lobby/messages', { body: `m${i}` })).status;
    expect(last).toBe(429);
  });
});

describe('direct messages', () => {
  it('stores DM text sealed, never as plain text', async () => {
    const [ivy, jo] = [await person('ivy_dm'), await person('jo_dm')];
    const r = await ivy.json('POST', '/v1/dms', { handle: 'jo_dm', body: 'secret plan 42' });
    expect(r.status).toBe(201);
    const raw = await env.DB.prepare('SELECT sealed FROM dm_messages WHERE id = ?').bind(r.body.message.id).first<{ sealed: string }>();
    expect(raw!.sealed.startsWith('v1.')).toBe(true);
    expect(raw!.sealed).not.toContain('secret');
    const read = await jo.json('GET', `/v1/dms/${r.body.thread.id}/messages`);
    expect(read.body.messages[0]).toMatchObject({ body: 'secret plan 42', mine: false });
  });

  it('puts strangers in requests, caps them at 3 until accepted, and a reply accepts', async () => {
    const [kai, lu] = [await person('kai_dm'), await person('lu_dm')];
    const t = (await kai.json('POST', '/v1/dms', { handle: 'lu_dm', body: 'hi' })).body.thread;
    expect((await lu.json('GET', '/v1/dms')).body.threads).toHaveLength(0);
    const req = (await lu.json('GET', '/v1/dms?box=requests')).body.threads;
    expect(req).toHaveLength(1);
    expect(req[0]).toMatchObject({ with: { handle: 'kai_dm' }, unread: true, accepted: false, last: { body: 'hi' } });
    expect((await lu.json('GET', '/v1/dms/unread')).body).toEqual({ inbox: 0, requests: 1 });

    await kai.json('POST', `/v1/dms/${t.id}/messages`, { body: 'two' });
    await kai.json('POST', `/v1/dms/${t.id}/messages`, { body: 'three' });
    expect((await kai.json('POST', `/v1/dms/${t.id}/messages`, { body: 'four' })).body.error.code).toBe('request_pending');

    await lu.json('POST', `/v1/dms/${t.id}/messages`, { body: 'hey back' });
    expect((await lu.json('GET', '/v1/dms')).body.threads).toHaveLength(1);
    expect((await kai.json('POST', `/v1/dms/${t.id}/messages`, { body: 'four' })).status).toBe(201);
  });

  it('goes straight to the inbox when they follow you', async () => {
    const [mo, ned] = [await person('mo_dm'), await person('ned_dm')];
    await ned.json('POST', '/v1/follows/mo_dm');
    await mo.json('POST', '/v1/dms', { handle: 'ned_dm', body: 'thanks for the follow' });
    expect((await ned.json('GET', '/v1/dms')).body.threads).toHaveLength(1);
    expect((await ned.json('GET', '/v1/dms/unread')).body.inbox).toBe(1);
  });

  it('declining hides it for good; a third person cannot read the thread', async () => {
    const [oz, pia, quin] = [await person('oz_dm'), await person('pia_dm'), await person('quin_dm')];
    const t = (await oz.json('POST', '/v1/dms', { handle: 'pia_dm', body: 'buy my course' })).body.thread;
    await pia.json('DELETE', `/v1/dms/${t.id}`);
    await oz.json('POST', `/v1/dms/${t.id}/messages`, { body: 'hello??' });
    expect((await pia.json('GET', '/v1/dms?box=requests')).body.threads).toHaveLength(0);
    expect((await quin.json('GET', `/v1/dms/${t.id}/messages`)).status).toBe(404);
    expect((await quin.json('POST', `/v1/dms/${t.id}/messages`, { body: 'x' })).status).toBe(404);
  });

  it('blocks stop new threads and hide existing ones on both sides', async () => {
    const [ray, sol] = [await person('ray_dm'), await person('sol_dm')];
    const t = (await ray.json('POST', '/v1/dms', { handle: 'sol_dm', body: 'hi' })).body.thread;
    await sol.json('POST', `/v1/dms/${t.id}/accept`);
    await sol.json('POST', '/v1/blocks/ray_dm');
    expect((await ray.json('POST', '/v1/dms', { handle: 'sol_dm', body: 'again' })).body.error.code).toBe('cant_message');
    expect((await ray.json('POST', `/v1/dms/${t.id}/messages`, { body: 'again' })).status).toBe(404);
    expect((await ray.json('GET', '/v1/dms')).body.threads).toHaveLength(0);
    expect((await sol.json('GET', '/v1/dms')).body.threads).toHaveLength(0);
  });

  it('reports attach the reported message only, and dedupe', async () => {
    const [tia, uma] = [await person('tia_dm'), await person('uma_dm')];
    const r = (await tia.json('POST', '/v1/dms', { handle: 'uma_dm', body: 'nasty words' })).body;
    expect((await tia.json('POST', '/v1/chat/flags', { kind: 'dm', messageId: r.message.id, reason: 'harassment' })).body.error.code).toBe('own_content');
    const f = await uma.json('POST', '/v1/chat/flags', { kind: 'dm', messageId: r.message.id, reason: 'harassment' });
    expect(f.status).toBe(201);
    const row = await env.DB.prepare(`SELECT evidence FROM flags WHERE target_type = 'dm_message' AND target_id = ?`).bind(r.message.id).first<{ evidence: string }>();
    expect(row!.evidence).toBe('nasty words');
    expect((await uma.json('POST', '/v1/chat/flags', { kind: 'dm', messageId: r.message.id, reason: 'harassment' })).body.duplicate).toBe(true);
    const outsider = await person('vic_dm');
    expect((await outsider.json('POST', '/v1/chat/flags', { kind: 'dm', messageId: r.message.id, reason: 'spam' })).status).toBe(404);
  });

  it('deletes own message for both, refuses yourself and missing key in production', async () => {
    const [wes, xan] = [await person('wes_dm'), await person('xan_dm')];
    expect((await wes.json('POST', '/v1/dms', { handle: 'wes_dm', body: 'me' })).body.error.code).toBe('self');
    const r = (await wes.json('POST', '/v1/dms', { handle: 'xan_dm', body: 'oops' })).body;
    expect((await xan.json('DELETE', `/v1/dms/${r.thread.id}/messages/${r.message.id}`)).status).toBe(403);
    await wes.json('DELETE', `/v1/dms/${r.thread.id}/messages/${r.message.id}`);
    expect((await xan.json('GET', `/v1/dms/${r.thread.id}/messages`)).body.messages[0]).toMatchObject({ deleted: true, body: '' });

    const prod = await person('yul_dm');
    prod.env = makeEnv({ ENVIRONMENT: 'production', PROOF_SECRET: 'real-secret', CHAT_KEY: '' });
    expect((await prod.json('POST', '/v1/dms', { handle: 'xan_dm', body: 'hi' })).body.error.code).toBe('chat_not_configured');
  });
});

describe('chat settings, mute and posts in messages', () => {
  it('who can message me: everyone, following, nobody', async () => {
    const [ana, ben] = [await person('ana_pref'), await person('ben_pref')];
    expect((await ben.json('GET', '/v1/chat/settings')).body.settings).toEqual({ dmFrom: 'everyone', channelsHidden: false });
    expect((await ben.json('PUT', '/v1/chat/settings', { dmFrom: 'sometimes' })).status).toBe(400);
    await ben.json('PUT', '/v1/chat/settings', { dmFrom: 'following' });
    const check = await ana.json('GET', '/v1/dms/with/ben_pref');
    expect(check.body).toMatchObject({ canMessage: false, thread: null });
    expect(check.body.reason).toContain('people they follow');
    expect((await ana.json('POST', '/v1/dms', { handle: 'ben_pref', body: 'hi' })).body.error.code).toBe('cant_message');
    await ben.json('POST', '/v1/follows/ana_pref');
    expect((await ana.json('GET', '/v1/dms/with/ben_pref')).body.canMessage).toBe(true);
    expect((await ana.json('POST', '/v1/dms', { handle: 'ben_pref', body: 'hi' })).status).toBe(201);
    await ben.json('PUT', '/v1/chat/settings', { dmFrom: 'nobody', channelsHidden: true });
    expect((await ben.json('GET', '/v1/chat/settings')).body.settings).toEqual({ dmFrom: 'nobody', channelsHidden: true });
    expect((await ana.json('POST', '/v1/dms', { handle: 'ben_pref', body: 'still here' })).status).toBe(201);
  });

  it('a muted conversation stops counting as unread', async () => {
    const [ana, ben] = [await person('ana_mute'), await person('ben_mute')];
    await ben.json('POST', '/v1/follows/ana_mute');
    const tid = (await ana.json('POST', '/v1/dms', { handle: 'ben_mute', body: 'ping' })).body.thread.id;
    expect((await ben.json('GET', '/v1/dms/unread')).body.inbox).toBe(1);
    const m = await ben.json('POST', `/v1/dms/${tid}/mute`, { muted: true });
    expect(m.body.thread.muted).toBe(true);
    expect((await ben.json('GET', '/v1/dms/unread')).body.inbox).toBe(0);
    await ben.json('POST', `/v1/dms/${tid}/mute`, { muted: false });
    expect((await ben.json('GET', '/v1/dms/unread')).body.inbox).toBe(1);
  });

  it('sends a post in a message, with or without words', async () => {
    const [ana, ben] = [await person('ana_share'), await person('ben_share')];
    const up = await ana.upload(pngBytes(64, 64));
    const postId = (await ana.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], caption: 'a bowl I made' })).body.post.id;
    const r = await ana.json('POST', '/v1/dms', { handle: 'ben_share', postId });
    expect(r.status).toBe(201);
    expect(r.body.message).toMatchObject({ body: '', postId, post: { id: postId, caption: 'a bowl I made' } });
    expect(r.body.thread.last.body).toBe('Sent a post');
    const page = await ben.json('GET', `/v1/dms/${r.body.thread.id}/messages`);
    expect(page.body.messages[0].post.id).toBe(postId);
    expect((await ana.json('POST', `/v1/dms/${r.body.thread.id}/messages`, { postId: 'nope' })).status).toBe(404);
    expect((await ana.json('POST', `/v1/dms/${r.body.thread.id}/messages`, {})).body.error.code).toBe('bad_message');
  });
});
