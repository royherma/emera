import { Hono } from 'hono';
import type { AppEnv, Env } from './env';
import { requireAuth, requireHandle } from './auth';
import { fail, originOf, readJson } from './http';
import { hmacHex, newId, toHex } from './crypto';
import { looksLikeVideo, readImageInfo } from './imageSize';
import { mediaJson, type MediaRow } from './serialize';
import { readVideoInfo, readVideoInfoFrom, type VideoInfo } from './videoInfo';

const MB = 1024 * 1024;
const TYPES: Record<string, { kind: 'image' | 'video'; ext: string; max: number }> = {
  'image/jpeg': { kind: 'image', ext: 'jpg', max: 20 * MB },
  'image/png': { kind: 'image', ext: 'png', max: 20 * MB },
  'image/webp': { kind: 'image', ext: 'webp', max: 20 * MB },
  'image/heic': { kind: 'image', ext: 'heic', max: 20 * MB },
  'video/mp4': { kind: 'video', ext: 'mp4', max: 200 * MB },
  'video/quicktime': { kind: 'video', ext: 'mov', max: 200 * MB },
};
const ALIASES: Record<string, string> = { 'image/jpg': 'image/jpeg', 'image/heif': 'image/heic' };

export const IMAGE_MAX_EDGE = 2048;
const IMAGE_QUALITY = 82;

async function shrinkImage(images: ImagesBinding | undefined, buf: Uint8Array): Promise<Uint8Array | null> {
  if (!images) return null;
  try {
    const out = await images
      .input(new Blob([buf]).stream())
      .transform({ width: IMAGE_MAX_EDGE, height: IMAGE_MAX_EDGE, fit: 'scale-down' })
      .output({ format: 'image/webp', quality: IMAGE_QUALITY });
    return new Uint8Array(await out.response().arrayBuffer());
  } catch (e) {
    console.warn('image shrink failed, storing original', e instanceof Error ? e.message : e);
    return null;
  }
}

export const VIDEO_MAX_EDGE = 1920;
const VIDEO_MAX_INPUT = 100 * MB;
const VIDEO_MAX_SECONDS = 60;

export function videoNeedsShrink(info: VideoInfo, bytes: number): boolean {
  return Math.max(info.width, info.height) > VIDEO_MAX_EDGE && bytes < VIDEO_MAX_INPUT && info.seconds > 0 && info.seconds <= VIDEO_MAX_SECONDS;
}

export async function shrinkVideo(env: Env, mediaId: string): Promise<'done' | 'skipped'> {
  const row = await env.DB.prepare(`SELECT * FROM media WHERE id = ? AND kind = 'video' AND status = 'done'`).bind(mediaId).first<MediaRow & { bytes: number }>();
  if (!row || !env.VIDEO || row.r2_key.endsWith('-1080.mp4')) return 'skipped';
  const src = await env.MEDIA.get(row.r2_key);
  if (!src) return 'skipped';
  const res = await env.VIDEO.input(src.body)
    .transform({ width: VIDEO_MAX_EDGE, height: VIDEO_MAX_EDGE, fit: 'scale-down' })
    .output({ mode: 'video' })
    .response();
  if (!res.ok) throw new Error(`video shrink ${res.status}`);
  const out = new Uint8Array(await res.arrayBuffer());
  if (!out.length || out.length >= row.bytes) return 'skipped';

  const key = `${row.id}-1080.mp4`;
  const sha256 = toHex(await crypto.subtle.digest('SHA-256', out));
  const info = await readVideoInfoFrom(async (o, n) => out.subarray(o, o + n), out.length);
  const signature = await hmacHex(env.PROOF_SECRET, `${sha256}.${new Date(row.signed_at!).toISOString()}.${row.signer}`);
  await env.MEDIA.put(key, out, { httpMetadata: { contentType: 'video/mp4' } });
  const moved = await env.DB.prepare(
    `UPDATE media SET r2_key = ?, content_type = 'video/mp4', bytes = ?, sha256 = ?, signature = ?, width = ?, height = ? WHERE id = ? AND r2_key = ?`,
  ).bind(key, out.length, sha256, signature, info?.width ?? row.width, info?.height ?? row.height, row.id, row.r2_key).run();
  if (!moved.meta.changes) { await env.MEDIA.delete(key); return 'skipped'; }
  await env.MEDIA.delete(row.r2_key);
  return 'done';
}

const POSTER_EDGE = 1280;
export const posterKey = (id: string) => `${id}-poster.jpg`;

async function frame(env: Env, key: string, time: string): Promise<Uint8Array | null> {
  const src = await env.MEDIA.get(key);
  if (!src) return null;
  const res = await env.VIDEO!.input(src.body)
    .transform({ width: POSTER_EDGE, height: POSTER_EDGE, fit: 'scale-down' })
    .output({ mode: 'frame', time, format: 'jpg' })
    .response();
  if (!res.ok) throw new Error(`poster ${res.status}`);
  const out = new Uint8Array(await res.arrayBuffer());
  return out.length ? out : null;
}

export async function makePoster(env: Env, mediaId: string): Promise<'done' | 'skipped'> {
  const row = await env.DB.prepare(`SELECT * FROM media WHERE id = ? AND kind = 'video' AND status = 'done'`).bind(mediaId).first<MediaRow & { bytes: number }>();
  if (!row || row.poster_key || !env.VIDEO || row.bytes >= VIDEO_MAX_INPUT) return 'skipped';
  const jpg = await frame(env, row.r2_key, '1s').catch(() => frame(env, row.r2_key, '0s'));
  if (!jpg) return 'skipped';
  const key = posterKey(row.id);
  await env.MEDIA.put(key, jpg, { httpMetadata: { contentType: 'image/jpeg' } });
  await env.DB.prepare('UPDATE media SET poster_key = ? WHERE id = ? AND poster_key IS NULL').bind(key, row.id).run();
  return 'done';
}

export type VideoJob = { mediaId: string; shrink?: boolean };

export async function runVideoJob(env: Env, job: VideoJob) {
  const poster = await makePoster(env, job.mediaId).catch((e) => (console.warn('poster failed', job.mediaId, e instanceof Error ? e.message : e), 'failed' as const));
  const shrink = job.shrink === false ? 'skipped' : await shrinkVideo(env, job.mediaId);
  return { poster, shrink };
}

export const mediaRoutes = new Hono<AppEnv>();

mediaRoutes.post('/v1/uploads', requireAuth, requireHandle, async (c) => {
  const body = await readJson(c);
  const declared = typeof body.contentType === 'string' ? body.contentType.trim().toLowerCase() : '';
  const contentType = ALIASES[declared] ?? declared;
  const spec = TYPES[contentType];
  if (!spec) throw fail(415, 'unsupported_type', 'Use jpeg, png, webp or heic images, or mp4 or mov video.');
  const bytes = body.bytes;
  if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes <= 0) throw fail(400, 'bad_bytes', 'Send the file size in bytes.');
  if (bytes > spec.max) throw fail(413, 'too_large', `${spec.kind === 'image' ? 'Images' : 'Videos'} can be up to ${spec.max / MB} MB.`);

  const id = newId(12);
  await c.env.DB.prepare(
    'INSERT INTO media (id, user_id, kind, content_type, declared_bytes, r2_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, c.get('user').id, spec.kind, contentType, bytes, `${id}.${spec.ext}`, Date.now()).run();
  return c.json({ uploadId: id, uploadUrl: `${originOf(c)}/v1/uploads/${id}` });
});

mediaRoutes.put('/v1/uploads/:id', requireAuth, async (c) => {
  const me = c.get('user');
  const row = await c.env.DB.prepare('SELECT * FROM media WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), me.id).first<MediaRow & { status: string; declared_bytes: number }>();
  if (!row) throw fail(404, 'not_found', 'No such upload.');
  if (row.status !== 'pending') throw fail(409, 'already_uploaded', 'This upload already has a file.');
  const spec = TYPES[row.content_type];
  const length = Number(c.req.header('content-length') ?? '');
  const stream = c.req.raw.body;
  if (!stream) throw fail(400, 'empty_body', 'Send the file bytes as the request body.');
  if (Number.isFinite(length) && length > spec.max) throw fail(413, 'too_large', 'That file is too big.');

  let sha256: string;
  let size: number;
  let width = 0;
  let height = 0;

  let sourceSha256: string | null = null;
  let sourceBytes: number | null = null;
  let key = row.r2_key;
  let storedType = row.content_type;

  if (spec.kind === 'image') {
    const buf = new Uint8Array(await c.req.arrayBuffer());
    if (!buf.length || buf.length > spec.max) throw fail(413, 'too_large', 'That file is too big.');
    const info = readImageInfo(buf);
    if (!info || info.contentType !== row.content_type) throw fail(415, 'bad_file', 'That file is not a valid image of the type you declared.');
    sourceSha256 = toHex(await crypto.subtle.digest('SHA-256', buf));
    sourceBytes = buf.length;
    const small = await shrinkImage(c.env.IMAGES, buf);
    const out = small ?? buf;
    ({ width, height } = (small && readImageInfo(small)) || info);
    if (small) { key = `${row.id}.webp`; storedType = 'image/webp'; }
    size = out.length;
    sha256 = toHex(await crypto.subtle.digest('SHA-256', out));
    await c.env.MEDIA.put(key, out, { httpMetadata: { contentType: storedType } });
  } else {
    if (!Number.isFinite(length) || length <= 0) throw fail(411, 'length_required', 'Videos need a Content-Length header.');
    let first = true;
    let sniffOk = true;
    const checked = stream.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctrl) {
        if (first) {
          first = false;
          sniffOk = looksLikeVideo(chunk);
          if (!sniffOk) return ctrl.error(new Error('not a video'));
        }
        ctrl.enqueue(chunk);
      },
    }));
    const [toR2, toHash] = checked.tee();
    const fixed = new FixedLengthStream(length);
    const digest = new crypto.DigestStream('SHA-256');
    try {
      const [, , hash] = await Promise.all([
        toR2.pipeTo(fixed.writable),
        c.env.MEDIA.put(row.r2_key, fixed.readable, { httpMetadata: { contentType: row.content_type } }),
        toHash.pipeTo(digest).then(() => digest.digest),
      ]);
      sha256 = toHex(hash);
    } catch {
      await c.env.MEDIA.delete(row.r2_key);
      if (!sniffOk) throw fail(415, 'bad_file', 'That file is not a valid video.');
      throw fail(400, 'upload_failed', 'The upload did not finish. Try again.');
    }
    size = length;
    sourceSha256 = sha256;
    sourceBytes = size;
    const info = await readVideoInfo(c.env.MEDIA, key, size).catch(() => null);
    if (info) ({ width, height } = info);
    if (c.env.VIDEO_JOBS) await c.env.VIDEO_JOBS.send({ mediaId: row.id, shrink: !!info && videoNeedsShrink(info, size) });
  }

  const signedAt = Date.now();
  const signer = me.handle!;
  const signature = await hmacHex(c.env.PROOF_SECRET, `${sha256}.${new Date(signedAt).toISOString()}.${signer}`);
  await c.env.DB.prepare(
    `UPDATE media SET status = 'done', width = ?, height = ?, bytes = ?, sha256 = ?, signed_at = ?, signer = ?, signature = ?,
       r2_key = ?, content_type = ?, source_sha256 = ?, source_bytes = ? WHERE id = ?`,
  ).bind(width, height, size, sha256, signedAt, signer, signature, key, storedType, sourceSha256, sourceBytes, row.id).run();
  const done = (await c.env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(row.id).first<MediaRow>())!;
  return c.json({ media: mediaJson(originOf(c), done) });
});

mediaRoutes.on(['GET', 'HEAD'], '/media/:key', async (c) => {
  const key = c.req.param('key');
  if (!/^[A-Za-z0-9]+(-[a-z0-9]+)?\.[a-z0-9]+$/.test(key)) throw fail(404, 'not_found', 'No such file.');
  const range = c.req.header('Range');
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  const head = await c.env.MEDIA.head(key);
  if (!head) throw fail(404, 'not_found', 'No such file.');

  const headers = new Headers({
    'Content-Type': head.httpMetadata?.contentType ?? 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: head.httpEtag,
    'Accept-Ranges': 'bytes',
  });
  if (c.req.header('If-None-Match') === head.httpEtag) return new Response(null, { status: 304, headers });
  if (c.req.method === 'HEAD') {
    headers.set('Content-Length', String(head.size));
    return new Response(null, { headers });
  }
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : head.size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : head.size - 1;
    start = Math.max(0, start);
    end = Math.min(end, head.size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${head.size}` } });
    const part = await c.env.MEDIA.get(key, { range: { offset: start, length: end - start + 1 } });
    if (!part) throw fail(404, 'not_found', 'No such file.');
    headers.set('Content-Range', `bytes ${start}-${end}/${head.size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(part.body, { status: 206, headers });
  }
  const obj = await c.env.MEDIA.get(key);
  if (!obj) throw fail(404, 'not_found', 'No such file.');
  headers.set('Content-Length', String(head.size));
  return new Response(obj.body, { headers });
});
