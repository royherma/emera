import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import app from '../src/index';
import { makePoster, parts, posterKey, runVideoJob, shrinkVideo, videoNeedsShrink } from '../src/media';
import { hmacHex } from '../src/crypto';
import { Client, makeEnv } from './helpers';

const box = (type: string, ...parts: Uint8Array[]) => {
  const len = 8 + parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  new DataView(out.buffer).setUint32(0, len);
  out.set(new TextEncoder().encode(type), 4);
  let o = 8;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

function mp4(width: number, height: number, seconds: number, rotated = false, filler = 4096): Uint8Array {
  const mvhd = new Uint8Array(100);
  const mv = new DataView(mvhd.buffer);
  mv.setUint32(12, 1000);
  mv.setUint32(16, seconds * 1000);
  const tkhd = new Uint8Array(84);
  const tk = new DataView(tkhd.buffer);
  const m = 40;
  if (rotated) { tk.setInt32(m + 4, 0x10000); tk.setInt32(m + 12, -0x10000); } else { tk.setInt32(m, 0x10000); tk.setInt32(m + 16, 0x10000); }
  tk.setUint32(m + 36, width * 65536);
  tk.setUint32(m + 40, height * 65536);
  const ftyp = box('ftyp', new TextEncoder().encode('isom\0\0\0\0isom'));
  const mdat = box('mdat', new Uint8Array(filler).fill(7));
  const moov = box('moov', box('mvhd', mvhd), box('trak', box('tkhd', tkhd)));
  const out = new Uint8Array(ftyp.length + mdat.length + moov.length);
  out.set(ftyp); out.set(mdat, ftyp.length); out.set(moov, ftyp.length + mdat.length);
  return out;
}

describe('video size', () => {
  it('cuts real uploads into 50 MiB parts, under the 100 MiB Cloudflare body cap', () => expect(parts.size).toBe(50 * 1024 * 1024));
  it('reads width, height and length from the file, and turns phone-held clips upright', async () => {
    const c = new Client();
    await c.signIn('clip@example.test');
    await c.withHandle('clip');
    const flat = await c.upload(mp4(1920, 1080, 12), 'video/mp4');
    expect(flat.body.media).toMatchObject({ width: 1920, height: 1080 });
    const held = await c.upload(mp4(3840, 2160, 5, true), 'video/quicktime');
    expect(held.body.media).toMatchObject({ width: 2160, height: 3840 });
  });

  it('only queues clips bigger than 1080p that the shrinker can take', () => {
    expect(videoNeedsShrink({ width: 2160, height: 3840, seconds: 30 }, 80e6)).toBe(true);
    expect(videoNeedsShrink({ width: 1080, height: 1920, seconds: 30 }, 80e6)).toBe(false);
    expect(videoNeedsShrink({ width: 2160, height: 3840, seconds: 90 }, 80e6)).toBe(false);
    expect(videoNeedsShrink({ width: 2160, height: 3840, seconds: 30 }, 150e6)).toBe(false);
  });

  it('swaps a 4K clip for its 1080p copy, re-signed, and drops the original', async () => {
    const send = vi.fn(async () => {});
    const small = mp4(1080, 1920, 5, false, 512);
    const VIDEO = { input: () => ({ transform: () => ({ output: () => ({ response: async () => new Response(small) }) }) }) };
    const env = makeEnv({ VIDEO_JOBS: { send } as any, VIDEO: VIDEO as any });
    const c = new Client(env);
    await c.signIn('fourk@example.test');
    await c.withHandle('fourk');
    const big = mp4(2160, 3840, 5);
    const up = await c.upload(big, 'video/quicktime');
    const id = up.body.media.id;
    expect(send).toHaveBeenCalledWith({ mediaId: id, shrink: true });
    const oldUrl = up.body.media.url;

    expect(await shrinkVideo(env, id)).toBe('done');
    const row = await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(id).first<any>();
    expect(row).toMatchObject({ r2_key: `${id}-1080.mp4`, content_type: 'video/mp4', width: 1080, height: 1920, bytes: small.length, source_sha256: up.body.media.sha256 });
    const sha = Buffer.from(await crypto.subtle.digest('SHA-256', small)).toString('hex');
    expect(row.sha256).toBe(sha);
    expect(row.signature).toBe(await hmacHex(env.PROOF_SECRET, `${sha}.${new Date(row.signed_at).toISOString()}.fourk`));
    expect((await app.fetch(new Request(oldUrl), env)).status).toBe(404);
    const served = await app.fetch(new Request(oldUrl.replace(/[^/]+$/, row.r2_key)), env);
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(small);
    expect(await shrinkVideo(env, id)).toBe('skipped');
  });

  it('grabs a poster frame for every video, shows it in posts, and deletes it with the post', async () => {
    const send = vi.fn(async () => {});
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    const outputs: string[] = [];
    const VIDEO = { input: () => ({ transform: () => ({ output: (o: { mode: string; time?: string }) => ({ response: async () => {
      outputs.push(`${o.mode}@${o.time ?? ''}`);
      if (o.time === '1s') return new Response('too short', { status: 400 });
      return new Response(jpg);
    } }) }) }) };
    const env = makeEnv({ VIDEO_JOBS: { send } as any, VIDEO: VIDEO as any });
    const c = new Client(env);
    await c.signIn('poster@example.test');
    await c.withHandle('poster');
    const up = await c.upload(mp4(1080, 1920, 1), 'video/mp4');
    const id = up.body.media.id;
    expect(send).toHaveBeenCalledWith({ mediaId: id, shrink: false });
    expect(up.body.media.posterUrl).toBeNull();

    expect(await runVideoJob(env, { mediaId: id, shrink: false })).toEqual({ poster: 'done', shrink: 'skipped' });
    expect(outputs).toEqual(['frame@1s', 'frame@0s']);
    expect(await makePoster(env, id)).toBe('skipped');

    const post = await c.json('POST', '/v1/posts', { caption: 'clip', mediaIds: [id] });
    const media = post.body.post.media[0];
    expect(media.posterUrl).toMatch(new RegExp(`/media/${posterKey(id)}$`));
    const served = await app.fetch(new Request(media.posterUrl), env);
    expect(served.headers.get('content-type')).toBe('image/jpeg');
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(jpg);

    const page = await (await app.fetch(new Request(post.body.post.url.replace(/^https?:\/\/[^/]+/, new URL(media.url).origin)), env)).text();
    expect(page).toContain(`<meta property="og:image" content="${media.posterUrl}">`);
    expect(page).toContain('<meta property="og:video:width" content="1080"><meta property="og:video:height" content="1920">');
    expect(page).toContain('summary_large_image');
    expect(page).toContain(`poster="${media.posterUrl}"`);
    expect(page).toMatch(/aspect-ratio:1080\/1920;width:min\(100%,calc\(\(100svh - 150px\) \* 0\.5625\)\)/);

    await c.json('DELETE', `/v1/posts/${post.body.post.id}`);
    expect(await env.MEDIA.head(posterKey(id))).toBeNull();
  });
});

describe('video length', () => {
  it('takes a 10 minute video and refuses anything longer, before or after the upload', async () => {
    const c = new Client();
    await c.signIn('long@example.test');
    await c.withHandle('long');
    expect((await c.upload(mp4(1080, 1920, 600), 'video/mp4')).status).toBe(200);

    const late = await c.upload(mp4(1080, 1920, 601), 'video/mp4');
    expect(late.status).toBe(413);
    expect(late.body.error.code).toBe('too_long');

    const early = await c.json('POST', '/v1/uploads', { contentType: 'video/mp4', bytes: 5000, seconds: 900 });
    expect(early.status).toBe(413);
    expect(early.body.error.code).toBe('too_long');
  });
});

describe('video in parts', () => {
  const PART_SIZE = 5 * 1024 * 1024;
  beforeAll(() => { parts.size = PART_SIZE; });
  afterAll(() => { parts.size = 50 * 1024 * 1024; });
  const sha = async (b: Uint8Array) => Buffer.from(await crypto.subtle.digest('SHA-256', b)).toString('hex');

  it('takes a video bigger than one part as R2 multipart parts and signs the whole file', async () => {
    const send = vi.fn(async () => {});
    const c = new Client(makeEnv({ VIDEO_JOBS: { send } as any }));
    await c.signIn('long@example.test');
    await c.withHandle('long');
    const file = mp4(1080, 1920, 590, false, PART_SIZE + 4096);
    const init = await c.json('POST', '/v1/uploads', { contentType: 'video/mp4', bytes: file.length, seconds: 590 });
    expect(init.body).toMatchObject({ partSize: PART_SIZE, partCount: 2 });
    const path = new URL(init.body.uploadUrl).pathname;

    expect((await c.call('PUT', path, undefined, file.subarray(0, 1024))).status).toBe(409);
    const short = await c.call('PUT', `${path}/parts/1`, undefined, file.subarray(0, 1024));
    expect([short.status, ((await short.json()) as any).error.code]).toEqual([400, 'bad_part_size']);
    const one = await c.call('PUT', `${path}/parts/1`, undefined, file.subarray(0, PART_SIZE));
    expect(one.status).toBe(200);
    const missing = await c.json('POST', `${path}/complete`, { parts: [await one.json()] });
    expect([missing.status, missing.body.error.code]).toEqual([400, 'bad_parts']);

    const up = await c.uploadParts(path, file, PART_SIZE);
    expect(up.status).toBe(200);
    expect(up.body.media).toMatchObject({ kind: 'video', width: 1080, height: 1920, sha256: await sha(file) });
    expect(send).toHaveBeenCalledWith({ mediaId: up.body.media.id, shrink: false });
    const row = await c.env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(up.body.media.id).first<any>();
    expect(row).toMatchObject({ bytes: file.length, multipart_id: null, source_sha256: row.sha256 });
    expect(row.signature).toBe(await hmacHex(c.env.PROOF_SECRET, `${row.sha256}.${new Date(row.signed_at).toISOString()}.long`));
    const head = await app.fetch(new Request(up.body.media.url, { method: 'HEAD' }), c.env);
    expect(head.headers.get('content-length')).toBe(String(file.length));
    expect((await c.json('POST', `${path}/complete`, { parts: [] })).status).toBe(409);
  });

  it('refuses a video over 10 minutes or not a video at all, sent in parts', async () => {
    const c = new Client();
    await c.signIn('parts@example.test');
    await c.withHandle('parts');
    const long = await c.upload(mp4(1080, 1920, 601, false, PART_SIZE + 10), 'video/mp4');
    expect([long.status, long.body.error.code]).toEqual([413, 'too_long']);
    expect(await c.env.DB.prepare("SELECT COUNT(*) AS n FROM media WHERE user_id = (SELECT id FROM users WHERE handle = 'parts')").first('n')).toBe(0);

    const junk = new Uint8Array(PART_SIZE + 10).fill(1);
    const bad = await c.upload(junk, 'video/mp4');
    expect([bad.status, bad.body.error.code]).toEqual([415, 'bad_file']);
  });

  it('caps videos at 2 GB and keeps one-request videos under one part', async () => {
    const c = new Client();
    await c.signIn('cap@example.test');
    await c.withHandle('cap');
    const big = await c.json('POST', '/v1/uploads', { contentType: 'video/mp4', bytes: 2048 * 1024 * 1024 + 1 });
    expect([big.status, big.body.error.code]).toEqual([413, 'too_large']);
    const small = await c.json('POST', '/v1/uploads', { contentType: 'video/mp4', bytes: 1000 });
    expect(small.body.partSize).toBeUndefined();
  });
});
