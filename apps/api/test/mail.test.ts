import { afterEach, describe, expect, it, vi } from 'vitest';
import { postResend } from '../src/mail';
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
