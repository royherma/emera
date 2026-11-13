import type { Context } from 'hono';
import type { AppEnv } from './env';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const fail = (status: number, code: string, message: string) => new ApiError(status, code, message);

export const originOf = (c: Context<AppEnv>): string => new URL(c.req.url).origin;

export function siteOrigin(c: Context<AppEnv>): string {
  const fixed = c.env.PUBLIC_ORIGIN;
  return fixed ? fixed.replace(/\/$/, '') : originOf(c);
}

export async function readJson(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {}
  throw fail(400, 'bad_json', 'Send a JSON object.');
}
