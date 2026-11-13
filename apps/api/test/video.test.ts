import { describe, expect, it, vi } from 'vitest';
import app from '../src/index';
import { shrinkVideo, videoNeedsShrink } from '../src/media';
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
  const mdat = box('mdat', new Uint8Array(filler).map((_, i) => (i * 7) % 251));
  const moov = box('moov', box('mvhd', mvhd), box('trak', box('tkhd', tkhd)));
  const out = new Uint8Array(ftyp.length + mdat.length + moov.length);
  out.set(ftyp); out.set(mdat, ftyp.length); out.set(moov, ftyp.length + mdat.length);
  return out;
}

describe('video size', () => {
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
    expect(send).toHaveBeenCalledWith({ mediaId: id });
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
});
