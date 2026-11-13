import { describe, expect, it, vi } from 'vitest';
import app from '../src/index';
import { makePoster, posterKey, runVideoJob, shrinkVideo, videoNeedsShrink } from '../src/media';
import { hmacHex } from '../src/crypto';
import { captionsKey, cuesFrom, makeCaptions } from '../src/captions';
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

    expect(await runVideoJob(env, { mediaId: id, shrink: false })).toEqual({ poster: 'done', shrink: 'skipped', captions: 'skipped' });
    expect(outputs).toEqual(['frame@1s', 'frame@0s']);
    expect(await makePoster(env, id)).toBe('skipped');

    const post = await c.json('POST', '/v1/posts', { caption: 'clip', mediaIds: [id] });
    const media = post.body.post.media[0];
    expect(media.posterUrl).toMatch(new RegExp(`/media/${posterKey(id)}$`));
    const served = await app.fetch(new Request(media.posterUrl), env);
    expect(served.headers.get('content-type')).toBe('image/jpeg');
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(jpg);

    const page = await (await app.fetch(new Request(post.body.post.url.replace(/^https?:\/\/[^/]+/, new URL(media.url).origin)), env)).text();
    expect(page).toContain(`<meta property="og:image" content="${post.body.post.url}/card.png">`);
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

describe('video captions', () => {
  it('splits what was said into short cues and drops silence', () => {
    const w = (word: string, start: number) => ({ word, start, end: start + 0.3 });
    const cues = cuesFrom([
      { start: 0, end: 6, text: 'Hi there. This is my first ever video on here and I love it', words: [w('Hi', 0), w('there.', 0.4), ...'This is my first ever video on here and I love it'.split(' ').map((x, i) => w(x, 1 + i * 0.4))] },
      { start: 7, end: 9, text: 'It took me a whole week to film.', words: 'It took me a whole week to film.'.split(' ').map((x, i) => w(x, 7 + i * 0.25)) },
      { start: 9, end: 10, text: 'Thank you.', no_speech_prob: 0.9 },
    ], 60);
    expect(cues.map((c) => c.text)).toEqual(['Hi there.', 'This is my first ever video on', 'here and I love it', 'It took me a whole week to film.']);
    expect(cues[0].start).toBe(60);
  });

  it('writes captions for a video in 60 s pieces, serves them, shows them on the page, deletes them with the post', async () => {
    const send = vi.fn(async () => {});
    const audio: string[] = [];
    const out = (o: { mode: string; time?: string; duration?: string }) => ({ response: async () => {
      if (o.mode !== 'audio') return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
      audio.push(`${o.time}+${o.duration}`);
      return new Response(new Uint8Array([1, 2, 3]));
    } });
    const VIDEO = { input: () => ({ output: out, transform: () => ({ output: out }) }) };
    const AI = { run: vi.fn(async (_m: string, input: Record<string, unknown>) => {
      expect(input.audio).toBe('AQID');
      return { segments: [{ start: 1, end: 2, text: 'Hello world', words: [{ word: 'Hello', start: 1, end: 1.4 }, { word: 'world', start: 1.5, end: 2 }] }] };
    }) };
    const env = makeEnv({ VIDEO_JOBS: { send } as any, VIDEO: VIDEO as any, AI });
    const c = new Client(env);
    await c.signIn('cc@example.test');
    await c.withHandle('talker');
    const id = (await c.upload(mp4(1080, 1920, 130), 'video/mp4')).body.media.id;

    expect((await runVideoJob(env, { mediaId: id, shrink: false })).captions).toBe('done');
    expect(audio).toEqual(['0s+60s', '60s+60s', '120s+10s']);
    expect(AI.run).toHaveBeenCalledWith('@cf/openai/whisper-large-v3-turbo', expect.objectContaining({ vad_filter: true }));
    expect(await makeCaptions(env, id)).toBe('skipped');

    const post = await c.json('POST', '/v1/posts', { caption: 'talk', mediaIds: [id] });
    const media = post.body.post.media[0];
    expect(media.captionsUrl).toMatch(new RegExp(`/media/${captionsKey(id)}$`));
    const vtt = await app.fetch(new Request(media.captionsUrl), env);
    expect(vtt.headers.get('content-type')).toBe('text/vtt; charset=utf-8');
    expect(await vtt.text()).toBe('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello world\n\n00:01:01.000 --> 00:01:02.000\nHello world\n\n00:02:01.000 --> 00:02:02.000\nHello world\n');

    const page = await (await app.fetch(new Request(post.body.post.url.replace(/^https?:\/\/[^/]+/, new URL(media.url).origin)), env)).text();
    expect(page).toContain(`<track kind="captions" src="${media.captionsUrl}" label="Captions">`);

    await c.json('DELETE', `/v1/posts/${post.body.post.id}`);
    expect(await env.MEDIA.head(captionsKey(id))).toBeNull();
  });

  it('leaves captionsUrl empty when nobody speaks', async () => {
    const VIDEO = { input: () => ({ output: () => ({ response: async () => new Response(new Uint8Array([1])) }), transform: () => ({ output: () => ({ response: async () => new Response(new Uint8Array([0xff, 0xd9])) }) }) }) };
    const env = makeEnv({ VIDEO_JOBS: { send: vi.fn(async () => {}) } as any, VIDEO: VIDEO as any, AI: { run: async () => ({ segments: [] }) } });
    const c = new Client(env);
    await c.signIn('quiet@example.test');
    await c.withHandle('quiet');
    const id = (await c.upload(mp4(1080, 1920, 5), 'video/mp4')).body.media.id;
    expect((await runVideoJob(env, { mediaId: id, shrink: false })).captions).toBe('skipped');
    const post = await c.json('POST', '/v1/posts', { caption: 'quiet', mediaIds: [id] });
    expect(post.body.post.media[0].captionsUrl).toBeNull();
  });
});
