import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client, makeEnv } from './helpers';
import { sendWelcomeOnce } from '../src/mail';

const mailEnv = makeEnv({ RESEND_API_KEY: 're_test' });
let seq = 0;

afterEach(() => vi.restoreAllMocks());

async function newUser() {
  const c = new Client();
  const tag = `${Date.now().toString(36)}${seq++}`;
  await c.signIn(`w${tag}@example.test`);
  c.env = mailEnv;
  return { c, tag, email: `w${tag}@example.test` };
}

const resendCalls = (f: { mock: { calls: unknown[][] } }) =>
  f.mock.calls.filter(([u]) => String(u).includes('api.resend.com')).map(([, init]) => JSON.parse((init as RequestInit).body as string));

describe('welcome email', () => {
  it('sends once on first handle: the ask when not opted in, never again', async () => {
    const { c, tag, email } = await newUser();
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 200 }));
    expect((await c.withHandle(`w${tag}`.slice(0, 20), 'W')).status).toBe(200);
    expect((await c.withHandle(`x${tag}`.slice(0, 20), 'W')).status).toBe(409);
    const sent = resendCalls(fetch);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual([email]);
    expect(sent[0].text).toContain('https://emera.social/protect?optin=1&ref=welcome-email');
    expect(sent[0].text).not.toContain('—');
  });

  it('says protected and links home when opted in before it sends', async () => {
    const { c, tag, email } = await newUser();
    const me = await c.withHandle(`w${tag}`.slice(0, 20), 'W');
    await mailEnv.DB.prepare('DELETE FROM scan_meta WHERE key = ?').bind(`welcome:${me.body.user.id}`).run();
    await mailEnv.DB.prepare('UPDATE users SET protect_opt_in_at = ? WHERE id = ?').bind(Date.now(), me.body.user.id).run();
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 200 }));
    expect(await sendWelcomeOnce(mailEnv, me.body.user.id)).toBe(true);
    expect(await sendWelcomeOnce(mailEnv, me.body.user.id)).toBe(false);
    const sent = resendCalls(fetch);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual([email]);
    expect(sent[0].text).toContain("You're protected on Emera. Post your first thing and we start checking it for copies.");
    expect(sent[0].text).toContain('https://emera.social/?ref=welcome-email');
  });

  it('skips the App Review account', async () => {
    const env = makeEnv({ RESEND_API_KEY: 're_test', REVIEW_EMAIL: 'review@emera.social', REVIEW_CODE: '123456' });
    const c = new Client(env);
    await c.json('POST', '/v1/auth/start', { email: 'review@emera.social' });
    const v = await c.json('POST', '/v1/auth/verify', { email: 'review@emera.social', code: '123456' });
    c.token = v.body.token;
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 200 }));
    await c.withHandle(`rv${seq++}${Date.now().toString(36)}`.slice(0, 20), 'Review');
    expect(resendCalls(fetch)).toHaveLength(0);
  });
});
