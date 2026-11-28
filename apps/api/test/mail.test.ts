import { afterEach, describe, expect, it, vi } from 'vitest';
import { postResend, retryDelayMs } from '../src/mail';
import { Client, makeEnv } from './helpers';
import type { Env } from '../src/env';

const env = { RESEND_API_KEY: 're_test' } as Env;
const noWait = async () => {};

afterEach(() => vi.restoreAllMocks());

describe('postResend', () => {
  it('sends again after a 429 and succeeds', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('slow down', { status: 429, headers: { 'retry-after': '1' } }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await postResend(env, { to: ['a@example.com'] }, noWait);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('gives up after 3 tries of 429', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('slow down', { status: 429 }));
    await expect(postResend(env, {}, noWait)).rejects.toThrow('resend 429');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('bad', { status: 422 }));
    await expect(postResend(env, {}, noWait)).rejects.toThrow('resend 422');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('retryDelayMs', () => {
  it('uses retry-after, then ratelimit-reset, then backs off', () => {
    expect(retryDelayMs(new Headers({ 'retry-after': '1' }), 1)).toBe(1000);
    expect(retryDelayMs(new Headers({ 'ratelimit-reset': '1' }), 1)).toBe(1000);
    expect(retryDelayMs(new Headers(), 2)).toBe(800);
    expect(retryDelayMs(new Headers({ 'retry-after': '30' }), 1)).toBe(2000);
  });
});

describe('POST /v1/auth/start with Resend', () => {
  const resendEnv = () => makeEnv({ RESEND_API_KEY: 're_test' });

  it('still delivers the code after a 429, and the code signs in', async () => {
    const email = `rate-${Math.random().toString(36).slice(2, 8)}@example.test`;
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('Too many requests', { status: 429, headers: { 'ratelimit-reset': '0.05' } }))
      .mockResolvedValueOnce(new Response('{"id":"x"}', { status: 200 }));
    const c = new Client(resendEnv());
    const start = await c.json('POST', '/v1/auth/start', { email });
    expect(start.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
    const sent = JSON.parse(String(fetch.mock.calls[1][1]!.body));
    expect(sent.to).toEqual([email]);
    const code = /(\d{6}) is your/.exec(sent.subject)![1];
    expect(sent.text).toContain(code);
    expect((await c.json('POST', '/v1/auth/verify', { email, code })).status).toBe(200);
  });

  it('tells the person to try again when the email never goes out', async () => {
    const email = `down-${Math.random().toString(36).slice(2, 8)}@example.test`;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('Too many requests', { status: 429, headers: { 'retry-after': '0.01' } }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = resendEnv();
    const start = await new Client(env).json('POST', '/v1/auth/start', { email });
    expect(start.status).toBe(503);
    expect(start.body.error).toEqual({ code: 'code_not_sent', message: 'We could not send your code. Try again in a minute.' });
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_codes WHERE email = ?').bind(email).first<{ n: number }>();
    expect(left?.n).toBe(0);
  });
});
