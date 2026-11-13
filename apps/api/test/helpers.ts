import { deflateSync } from 'node:zlib';
import { env as workerEnv } from 'cloudflare:workers';
import { vi } from 'vitest';
import app from '../src/index';
import type { Env } from '../src/env';

export const ORIGIN = 'http://test.local';

export function makeEnv(over: Partial<Env> = {}): Env {
  return { ...(workerEnv as unknown as Env), ...over };
}

export function crc32(buf: Uint8Array) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

export function pngBytes(width: number, height: number): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const raw = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw.set([x * 4 % 256, y * 4 % 256, 120], y * (width * 3 + 1) + 1 + x * 3);
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export class Client {
  token: string | null = null;
  constructor(public env: Env = makeEnv()) {}

  async call(method: string, path: string, body?: unknown, raw?: BodyInit, headers: Record<string, string> = {}) {
    const h = new Headers(headers);
    if (this.token) h.set('Authorization', `Bearer ${this.token}`);
    let payload: BodyInit | undefined = raw;
    if (body !== undefined) { h.set('Content-Type', 'application/json'); payload = JSON.stringify(body); }
    if (raw instanceof Uint8Array) h.set('Content-Length', String(raw.length));
    return app.fetch(new Request(`${ORIGIN}${path}`, { method, headers: h, body: payload }), this.env);
  }

  async json(method: string, path: string, body?: unknown) {
    const res = await this.call(method, path, body);
    return { status: res.status, body: (await res.json()) as any };
  }

  async signIn(email: string, invite?: string) {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const start = await this.json('POST', '/v1/auth/start', { email, invite });
    const line = log.mock.calls.map((c) => String(c[0])).reverse().find((l) => l.includes(email));
    log.mockRestore();
    if (start.status !== 200) return { start };
    const code = /: (\d{6})$/.exec(line ?? '')![1];
    const verify = await this.json('POST', '/v1/auth/verify', { email, code });
    if (verify.status === 200) this.token = verify.body.token;
    return { start, verify, code };
  }

  async withHandle(handle: string, displayName = handle) {
    return this.json('POST', '/v1/auth/handle', { handle, displayName });
  }

  async upload(bytes: Uint8Array, contentType = 'image/png') {
    const init = await this.json('POST', '/v1/uploads', { contentType, bytes: bytes.length });
    if (init.status !== 200) return init;
    const url = new URL(init.body.uploadUrl);
    const res = await this.call('PUT', url.pathname, undefined, bytes, { 'Content-Type': contentType });
    return { status: res.status, body: (await res.json()) as any };
  }
}
