import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../src/index';
import { Client, ORIGIN, makeEnv, pngBytes } from './helpers';
import { AUTH_VERSION, buildNotice, judge, recipientFor, registrable, runTakedownRecheck } from '../src/takedown';

const env = makeEnv();
const mailEnv = makeEnv({ RESEND_API_KEY: 're_test' });
let seq = 0;
let calls: { url: string; init?: RequestInit }[] = [];

const RDAP = {
  entities: [{ roles: ['registrar'], entities: [{ roles: ['abuse'], vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['email', {}, 'text', 'abuse@host.example']]] }] }],
};

function fakeNet(routes: Record<string, () => Response> = {}) {
  calls = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, init });
    for (const [prefix, make] of Object.entries(routes)) if (url.startsWith(prefix)) return make();
    return new Response('not mocked', { status: 599 });
  });
}

async function creator() {
  const c = new Client(env);
  const tag = `${Date.now().toString(36)}${seq++}`;
  await c.signIn(`t${tag}@example.test`);
  const me = await c.withHandle(`t${tag}`.slice(0, 20), 'T');
  const up = await c.upload(pngBytes(8, 8));
  const post = await c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], caption: 'x' });
  return { c, id: me.body.user.id as string, handle: me.body.user.handle as string, postId: post.body.post.id as string };
}

async function report(c: Client, postId: string, url: string) {
  const r = await c.json('POST', '/v1/reports', { postId, url });
  return r.body.report.id as string;
}

const admin = (e = env) => {
  const a = new Client(e);
  a.token = 'dev-fund-admin';
  return a;
};
const SIGN = { name: 'Ada Lovelace', agree: true, version: AUTH_VERSION };

afterEach(() => vi.restoreAllMocks());

describe('notice builder', () => {
  it('names the original, the copy, the statements and the signature', () => {
    const n = buildNotice({
      originalUrl: 'https://emera.social/p/abc', uploadedAt: Date.UTC(2026, 10, 1), signedBy: 'ada', infringingUrl: 'https://shop.example/x',
      signerName: 'Ada Lovelace', creatorHandle: 'ada', signedAt: Date.UTC(2026, 10, 23),
    });
    expect(n).toContain('https://emera.social/p/abc');
    expect(n).toContain('2026-11-01');
    expect(n).toContain('https://shop.example/x');
    expect(n).toContain('under penalty of perjury'.replace('under', 'Under'));
    expect(n).toContain('/Ada Lovelace/');
    expect(n).toContain('takedowns@emera.social');
  });
});

describe('recipient lookup', () => {
  it('known hosts file by form', async () => {
    const r = await recipientFor('https://www.instagram.com/p/xyz');
    expect(r).toMatchObject({ method: 'form', site: 'instagram.com', target: 'https://help.instagram.com/contact/552695131608132' });
    expect((await recipientFor('https://m.etsy.com/listing/1')).method).toBe('form');
  });
  it('other hosts use the RDAP abuse email', async () => {
    fakeNet({ 'https://rdap.org/domain/example.co.uk': () => Response.json(RDAP) });
    expect(registrable('shop.example.co.uk')).toBe('example.co.uk');
    const r = await recipientFor('https://shop.example.co.uk/p/1');
    expect(r).toMatchObject({ method: 'email', target: 'abuse@host.example', site: 'example.co.uk' });
  });
  it('falls back to a form with a note when RDAP has nothing', async () => {
    fakeNet({ 'https://rdap.org/': () => Response.json({ entities: [] }) });
    const r = await recipientFor('https://blog.example.net/x');
    expect(r.method).toBe('form');
    expect(r.target).toBeNull();
    expect(r.note).toContain('No abuse contact');
  });
});

describe('creator flow', () => {
  it('confirm needs the signed statement, then the notice is ready for the desk', async () => {
    fakeNet({ 'https://rdap.org/': () => Response.json(RDAP) });
    const { c, postId, handle } = await creator();
    const rid = await report(c, postId, 'https://blog.example.net/x');

    const preview = await c.json('GET', `/v1/reports/${rid}/takedown`);
    expect(preview.body.authorization.required).toBe(true);
    expect(preview.body.recipient).toEqual({ site: 'example.net', method: 'email' });

    const refused = await c.json('POST', `/v1/reports/${rid}/confirm`, {});
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe('authorization_required');

    expect((await c.json('POST', '/v1/protect/authorize', { ...SIGN, agree: false })).status).toBe(400);
    expect((await c.json('POST', '/v1/protect/authorize', { ...SIGN, name: 'Ada' })).status).toBe(400);
    expect((await c.json('POST', '/v1/protect/authorize', { ...SIGN, version: 'old' })).body.error.code).toBe('text_changed');
    expect((await c.json('POST', '/v1/protect/authorize', SIGN)).status).toBe(201);

    const done = await c.json('POST', `/v1/reports/${rid}/confirm`, {});
    expect(done.status).toBe(201);
    expect(done.body.takedown.status).toBe('ready');
    const again = await c.json('POST', `/v1/reports/${rid}/confirm`, {});
    expect(again.body.takedown.id).toBe(done.body.takedown.id);

    const list = await c.json('GET', '/v1/protect/takedowns');
    expect(list.body.takedowns).toHaveLength(1);
    const desk = await admin().json('GET', '/v1/admin/takedowns');
    expect(desk.body.takedowns[0].notice).toContain(`/p/${postId}`);
    expect(desk.body.takedowns[0].notice).toContain('/Ada Lovelace/');
    expect(desk.body.takedowns[0].handle).toBe(handle);

    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM takedown_authorizations WHERE text_version = ?').bind(AUTH_VERSION).first<{ n: number }>();
    expect(row!.n).toBeGreaterThan(0);
  });

  it('confirm can carry the signature inline and never asks twice', async () => {
    const { c, postId } = await creator();
    const r1 = await report(c, postId, 'https://www.tiktok.com/@x/video/1');
    expect((await c.json('POST', `/v1/reports/${r1}/confirm`, { authorization: SIGN })).status).toBe(201);
    const r2 = await report(c, postId, 'https://www.pinterest.com/pin/2');
    expect((await c.json('GET', `/v1/reports/${r2}/takedown`)).body.authorization.required).toBe(false);
    expect((await c.json('POST', `/v1/reports/${r2}/confirm`, {})).status).toBe(201);
  });

  it('cannot confirm someone else\'s report', async () => {
    const a = await creator();
    const b = await creator();
    const rid = await report(a.c, a.postId, 'https://www.etsy.com/listing/1');
    expect((await b.c.json('POST', `/v1/reports/${rid}/confirm`, { authorization: SIGN })).status).toBe(404);
  });
});

describe('desk', () => {
  async function ready(url: string) {
    const x = await creator();
    const rid = await report(x.c, x.postId, url);
    const t = await x.c.json('POST', `/v1/reports/${rid}/confirm`, { authorization: SIGN });
    return { ...x, tid: t.body.takedown.id as string };
  }

  it('admin endpoints need the key', async () => {
    const res = await app.fetch(new Request(`${ORIGIN}/v1/admin/takedowns`), env);
    expect(res.status).toBe(404);
  });

  it('sends the email from the desk address once, only after approval', async () => {
    fakeNet({ 'https://rdap.org/': () => Response.json(RDAP), 'https://api.resend.com/': () => Response.json({ id: 'm1' }) });
    const { c, tid } = await ready('https://blog.example.net/y');
    const sent = await admin(mailEnv).json('POST', `/v1/admin/takedowns/${tid}/send-email`);
    expect(sent.status).toBe(200);
    expect(sent.body.takedown.status).toBe('sent');
    const mail = calls.filter((x) => x.url.startsWith('https://api.resend.com/'));
    expect(mail).toHaveLength(1);
    const body = JSON.parse(String(mail[0].init!.body));
    expect(body).toMatchObject({ from: 'Emera Takedowns <takedowns@emera.social>', to: ['abuse@host.example'], reply_to: 'takedowns@emera.social' });
    expect(body.text).toContain('/Ada Lovelace/');
    expect((await admin(mailEnv).json('POST', `/v1/admin/takedowns/${tid}/send-email`)).status).toBe(409);
    expect(mail).toHaveLength(1);
    expect((await c.json('GET', '/v1/protect/takedowns')).body.takedowns[0].status).toBe('sent');
  });

  it('a failed send goes back to ready', async () => {
    fakeNet({ 'https://rdap.org/': () => Response.json(RDAP), 'https://api.resend.com/': () => new Response('no', { status: 500 }) });
    const { tid } = await ready('https://blog.example.org/y');
    expect((await admin(mailEnv).json('POST', `/v1/admin/takedowns/${tid}/send-email`)).status).toBe(502);
    const row = await env.DB.prepare('SELECT status FROM takedowns WHERE id = ?').bind(tid).first<{ status: string }>();
    expect(row!.status).toBe('ready');
  });

  it('forms are marked filed by hand; email is refused for them', async () => {
    const { tid } = await ready('https://www.etsy.com/listing/9');
    expect((await admin(mailEnv).json('POST', `/v1/admin/takedowns/${tid}/send-email`)).status).toBe(409);
    const filed = await admin().json('POST', `/v1/admin/takedowns/${tid}/mark-filed`);
    expect(filed.body.takedown).toMatchObject({ status: 'sent', method: 'form' });
  });

  it('reject shows the reason to the creator', async () => {
    const { c, tid } = await ready('https://www.etsy.com/listing/10');
    expect((await admin().json('POST', `/v1/admin/takedowns/${tid}/reject`, { reason: '' })).status).toBe(400);
    await admin().json('POST', `/v1/admin/takedowns/${tid}/reject`, { reason: 'That page is your own shop' });
    const t = (await c.json('GET', '/v1/protect/takedowns')).body.takedowns[0];
    expect(t).toMatchObject({ status: 'rejected', rejectReason: 'That page is your own shop' });
  });
});

describe('recheck and receipt', () => {
  async function sent(url: string) {
    const x = await creator();
    const rid = await report(x.c, x.postId, url);
    const t = await x.c.json('POST', `/v1/reports/${rid}/confirm`, { authorization: SIGN });
    await admin().json('POST', `/v1/admin/takedowns/${t.body.takedown.id}/mark-filed`);
    return { ...x, tid: t.body.takedown.id as string };
  }
  const day = 86_400_000;

  it('judge: 404 and 410 remove, 403 and 500 prove nothing, vanished image removes', () => {
    expect(judge(404, '', null).removed).toBe(true);
    expect(judge(410, '', null).removed).toBe(true);
    expect(judge(403, '', null).removed).toBe(false);
    expect(judge(500, '', null).removed).toBe(false);
    expect(judge(200, '<img src="https://x/a.jpg">', 'https://x/a.jpg').removed).toBe(false);
    expect(judge(200, '<p>gone</p>', 'https://x/a.jpg').removed).toBe(true);
  });

  it('keeps checking, then marks removed with the status that decided it, and the receipt page is public', async () => {
    const url = 'https://www.etsy.com/listing/77';
    const { c, tid, handle } = await sent(url);
    fakeNet({ [url]: () => new Response('<meta property="og:image" content="https://cdn.example/a.jpg"><img src="https://cdn.example/a.jpg">') });
    const t0 = Date.now() + 1000;
    expect((await runTakedownRecheck(env, t0)).checked).toBeGreaterThanOrEqual(1);
    let row = await env.DB.prepare('SELECT status, last_http, image_ref FROM takedowns WHERE id = ?').bind(tid).first<any>();
    expect(row).toMatchObject({ status: 'sent', last_http: 200, image_ref: 'https://cdn.example/a.jpg' });

    expect((await runTakedownRecheck(env, t0 + 3_600_000)).checked).toBe(0);

    fakeNet({ [url]: () => new Response('<p>Listing removed</p>') });
    await runTakedownRecheck(env, t0 + 2 * day);
    row = await env.DB.prepare('SELECT status, last_http, check_reason, removed_at FROM takedowns WHERE id = ?').bind(tid).first<any>();
    expect(row.status).toBe('removed');
    expect(row.last_http).toBe(200);
    expect(row.check_reason).toContain('no longer links the image');

    const mine = (await c.json('GET', '/v1/protect/takedowns')).body.takedowns[0];
    expect(mine.status).toBe('removed');
    expect(mine.daysToRemoval).toBe(2);
    expect(mine.receiptUrl).toBe(`https://emera.social/takedown/${tid}`);

    const page = await app.fetch(new Request(`${ORIGIN}/takedown/${tid}`), env);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('Removed in 2 days');
    expect(html).toContain(`@${handle}`);
    expect(html).toContain('og:title');
    expect(html).not.toContain('@example.test');
    expect(html).not.toContain(url);
  });

  it('404 removes at once; 403 is not proof', async () => {
    const a = await sent('https://www.etsy.com/listing/a');
    const b = await sent('https://www.etsy.com/listing/b');
    fakeNet({ 'https://www.etsy.com/listing/a': () => new Response('', { status: 404 }), 'https://www.etsy.com/listing/b': () => new Response('', { status: 403 }) });
    await runTakedownRecheck(env, Date.now() + 1000);
    const get = (id: string) => env.DB.prepare('SELECT status, last_http FROM takedowns WHERE id = ?').bind(id).first<any>();
    expect(await get(a.tid)).toMatchObject({ status: 'removed', last_http: 404 });
    expect(await get(b.tid)).toMatchObject({ status: 'sent', last_http: 403 });
  });

  it('gives up after 30 days as still_up, and an unremoved receipt is a 404', async () => {
    const x = await sent('https://www.etsy.com/listing/c');
    fakeNet({ 'https://www.etsy.com/listing/c': () => new Response('<p>still here</p>') });
    await runTakedownRecheck(env, Date.now() + 31 * day);
    const row = await env.DB.prepare('SELECT status, check_reason FROM takedowns WHERE id = ?').bind(x.tid).first<any>();
    expect(row.status).toBe('still_up');
    expect(row.check_reason).toContain('30 days');
    expect((await app.fetch(new Request(`${ORIGIN}/takedown/${x.tid}`), env)).status).toBe(404);
    expect((await admin().json('POST', `/v1/admin/takedowns/${x.tid}/counter-notice`)).body.takedown.status).toBe('counter_notice');
  });
});
