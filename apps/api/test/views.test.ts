import { describe, expect, it } from 'vitest';
import { Client, makeEnv, pngBytes } from './helpers';

const box = (type: string, ...parts: Uint8Array[]) => {
  const len = 8 + parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  new DataView(out.buffer).setUint32(0, len);
  out.set(new TextEncoder().encode(type), 4);
  let o = 8;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

function mp4(): Uint8Array {
  const mvhd = new Uint8Array(100);
  new DataView(mvhd.buffer).setUint32(12, 1000);
  new DataView(mvhd.buffer).setUint32(16, 5000);
  const tkhd = new Uint8Array(84);
  const tk = new DataView(tkhd.buffer);
  tk.setInt32(40, 0x10000); tk.setInt32(56, 0x10000);
  tk.setUint32(76, 1080 * 65536); tk.setUint32(80, 1920 * 65536);
  const ftyp = box('ftyp', new TextEncoder().encode('isom\0\0\0\0isom'));
  const mdat = box('mdat', new Uint8Array(512).map((_, i) => (i * 7) % 251));
  const moov = box('moov', box('mvhd', mvhd), box('trak', box('tkhd', tkhd)));
  const out = new Uint8Array(ftyp.length + mdat.length + moov.length);
  out.set(ftyp); out.set(mdat, ftyp.length); out.set(moov, ftyp.length + mdat.length);
  return out;
}

async function member(env: ReturnType<typeof makeEnv>, handle: string) {
  const c = new Client(env);
  await c.signIn(`${handle}@example.test`);
  await c.withHandle(handle, handle);
  return c;
}

async function post(c: Client, bytes: Uint8Array, type?: string) {
  const up = await c.upload(bytes, type);
  return (await c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], caption: 'clip' })).body.post.id as string;
}

describe('video views', () => {
  it('counts each signed-in person once and never the maker', async () => {
    const env = makeEnv();
    const s = Math.random().toString(36).slice(2, 7);
    const maya = await member(env, `maya_${s}`);
    const theo = await member(env, `theo_${s}`);
    const ines = await member(env, `ines_${s}`);
    const id = await post(maya, mp4(), 'video/mp4');

    expect((await maya.json('POST', `/v1/posts/${id}/view`)).body).toEqual({ viewCount: 0 });
    expect((await theo.json('POST', `/v1/posts/${id}/view`)).body).toEqual({ viewCount: 1 });
    expect((await theo.json('POST', `/v1/posts/${id}/view`)).body).toEqual({ viewCount: 1 });
    expect((await ines.json('POST', `/v1/posts/${id}/view`)).body).toEqual({ viewCount: 2 });

    expect((await new Client(env).json('GET', `/v1/posts/${id}`)).body.post.viewCount).toBe(2);
    const feed = await theo.json('GET', '/v1/feed');
    expect(feed.body.posts.find((p: any) => p.id === id).viewCount).toBe(2);
  });

  it('needs a sign-in, a real post and a video', async () => {
    const env = makeEnv();
    const s = Math.random().toString(36).slice(2, 7);
    const maya = await member(env, `maya_${s}`);
    const theo = await member(env, `theo_${s}`);
    const photo = await post(maya, pngBytes(8, 8));
    expect((await new Client(env).json('POST', `/v1/posts/${photo}/view`)).status).toBe(401);
    expect((await theo.json('POST', '/v1/posts/nope/view')).status).toBe(404);
    const r = await theo.json('POST', `/v1/posts/${photo}/view`);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('not_video');
    expect((await theo.json('GET', `/v1/posts/${photo}`)).body.post.viewCount).toBe(0);
  });
});

describe('view ledger', () => {
  it('is public, matches the count, and never names the viewer', async () => {
    const env = makeEnv();
    const s = Math.random().toString(36).slice(2, 7);
    const maya = await member(env, `maya_${s}`);
    const theo = await member(env, `theo_${s}`);
    const ines = await member(env, `ines_${s}`);
    const id = await post(maya, mp4(), 'video/mp4');
    const other = await post(maya, mp4(), 'video/mp4');
    const theoUser = (await theo.json('GET', '/v1/me')).body.user;
    expect((await theo.json('POST', `/v1/follows/maya_${s}`)).status).toBe(200);
    await theo.json('POST', `/v1/posts/${id}/view`);
    await ines.json('POST', `/v1/posts/${id}/view`);
    await theo.json('POST', `/v1/posts/${other}/view`);

    const res = await new Client(env).json('GET', `/v1/posts/${id}/views`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ postId: id, viewCount: 2, followers: 1, newAccounts: 2, more: false });
    expect(res.body.ledger).toHaveLength(2);
    expect(res.body.rule).toContain('2 seconds');
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(theoUser.id);
    expect(text).not.toContain('theo_');
    for (const row of res.body.ledger) {
      expect(row.viewer).toMatch(/^[0-9a-f]{12}$/);
      expect(new Date(row.hour).getUTCMinutes()).toBe(0);
      expect(row.accountAge).toBe('under a week');
    }
    expect(res.body.ledger.filter((r: any) => r.follower)).toHaveLength(1);
    const otherLedger = (await new Client(env).json('GET', `/v1/posts/${other}/views`)).body.ledger;
    expect(res.body.ledger.map((r: any) => r.viewer)).not.toContain(otherLedger[0].viewer);
    expect((await new Client(env).json('GET', '/v1/posts/nope/views')).status).toBe(404);
  });
});
