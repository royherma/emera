import { Hono, type Context } from 'hono';
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
  'video/mp4': { kind: 'video', ext: 'mp4', max: 2048 * MB },
  'video/quicktime': { kind: 'video', ext: 'mov', max: 2048 * MB },
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
export const VIDEO_MAX_LENGTH = 600;
const TOO_LONG = 'Videos can be up to 10 minutes.';
// Cloudflare Free refuses request bodies over 100 MiB, so bigger videos arrive as R2 multipart parts of this size.
export const parts = { size: 50 * MB };
const partCount = (bytes: number) => Math.ceil(bytes / parts.size);

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
  if (spec.kind === 'video' && typeof body.seconds === 'number' && body.seconds > VIDEO_MAX_LENGTH) throw fail(413, 'too_long', TOO_LONG);

  const id = newId(12);
  const key = `${id}.${spec.ext}`;
  const multipart = spec.kind === 'video' && bytes > parts.size ? await c.env.MEDIA.createMultipartUpload(key, { httpMetadata: { contentType } }) : null;
  await c.env.DB.prepare(
    'INSERT INTO media (id, user_id, kind, content_type, declared_bytes, r2_key, multipart_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, c.get('user').id, spec.kind, contentType, bytes, key, multipart?.uploadId ?? null, Date.now()).run();
  const uploadUrl = `${originOf(c)}/v1/uploads/${id}`;
  return c.json(multipart ? { uploadId: id, uploadUrl, partSize: parts.size, partCount: partCount(bytes) } : { uploadId: id, uploadUrl });
});

type PendingRow = MediaRow & { status: string; declared_bytes: number; multipart_id: string | null };

async function pendingUpload(c: Context<AppEnv>): Promise<PendingRow> {
  const row = await c.env.DB.prepare('SELECT * FROM media WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('user').id).first<PendingRow>();
  if (!row) throw fail(404, 'not_found', 'No such upload.');
  if (row.status !== 'pending') throw fail(409, 'already_uploaded', 'This upload already has a file.');
  return row;
}

function sniffVideo() {
  let first = true;
  const state = { ok: true };
  const check = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctrl) {
      if (first) {
        first = false;
        state.ok = looksLikeVideo(chunk);
        if (!state.ok) return ctrl.error(new Error('not a video'));
      }
      ctrl.enqueue(chunk);
    },
  });
  return { check, state };
}

async function checkVideo(c: Context<AppEnv>, row: PendingRow, size: number): Promise<{ width: number; height: number }> {
  const info = await readVideoInfo(c.env.MEDIA, row.r2_key, size).catch(() => null);
  if (info && info.seconds > VIDEO_MAX_LENGTH) {
    await c.env.MEDIA.delete(row.r2_key);
    await c.env.DB.prepare('DELETE FROM media WHERE id = ?').bind(row.id).run();
    throw fail(413, 'too_long', TOO_LONG);
  }
  if (c.env.VIDEO_JOBS) await c.env.VIDEO_JOBS.send({ mediaId: row.id, shrink: !!info && videoNeedsShrink(info, size) });
  return info ?? { width: 0, height: 0 };
}

type Stored = { width: number; height: number; size: number; sha256: string; key: string; storedType: string; sourceSha256: string; sourceBytes: number };

async function markDone(c: Context<AppEnv>, row: PendingRow, s: Stored) {
  const signedAt = Date.now();
  const signer = c.get('user').handle!;
  const signature = await hmacHex(c.env.PROOF_SECRET, `${s.sha256}.${new Date(signedAt).toISOString()}.${signer}`);
  await c.env.DB.prepare(
    `UPDATE media SET status = 'done', width = ?, height = ?, bytes = ?, sha256 = ?, signed_at = ?, signer = ?, signature = ?,
       r2_key = ?, content_type = ?, source_sha256 = ?, source_bytes = ?, multipart_id = NULL WHERE id = ?`,
  ).bind(s.width, s.height, s.size, s.sha256, signedAt, signer, signature, s.key, s.storedType, s.sourceSha256, s.sourceBytes, row.id).run();
  const done = (await c.env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(row.id).first<MediaRow>())!;
  return c.json({ media: mediaJson(originOf(c), done) });
}

mediaRoutes.put('/v1/uploads/:id/parts/:n', requireAuth, async (c) => {
  const row = await pendingUpload(c);
  if (!row.multipart_id) throw fail(409, 'not_in_parts', 'Send this file in one request.');
  const count = partCount(row.declared_bytes);
  const n = Number(c.req.param('n'));
  if (!Number.isInteger(n) || n < 1 || n > count) throw fail(400, 'bad_part', `Parts are numbered 1 to ${count}.`);
  const expected = n < count ? parts.size : row.declared_bytes - parts.size * (count - 1);
  if (Number(c.req.header('content-length') ?? '') !== expected) throw fail(400, 'bad_part_size', `Part ${n} must be ${expected} bytes.`);
  const stream = c.req.raw.body;
  if (!stream) throw fail(400, 'empty_body', 'Send the part bytes as the request body.');

  const sniff = n === 1 ? sniffVideo() : null;
  const fixed = new FixedLengthStream(expected);
  const upload = c.env.MEDIA.resumeMultipartUpload(row.r2_key, row.multipart_id);
  try {
    const [, part] = await Promise.all([(sniff ? stream.pipeThrough(sniff.check) : stream).pipeTo(fixed.writable), upload.uploadPart(n, fixed.readable)]);
    return c.json({ partNumber: part.partNumber, etag: part.etag });
  } catch {
    if (sniff && !sniff.state.ok) throw fail(415, 'bad_file', 'That file is not a valid video.');
    throw fail(400, 'upload_failed', 'The upload did not finish. Try again.');
  }
});

mediaRoutes.post('/v1/uploads/:id/complete', requireAuth, async (c) => {
  const row = await pendingUpload(c);
  if (!row.multipart_id) throw fail(409, 'not_in_parts', 'Send this file in one request.');
  const count = partCount(row.declared_bytes);
  const body = await readJson(c);
  const sent = Array.isArray(body.parts) ? body.parts : [];
  const list = sent
    .filter((p: any) => p && Number.isInteger(p.partNumber) && typeof p.etag === 'string')
    .map((p: any) => ({ partNumber: p.partNumber as number, etag: p.etag as string }))
    .sort((a: R2UploadedPart, b: R2UploadedPart) => a.partNumber - b.partNumber);
  if (list.length !== count || list.some((p: R2UploadedPart, i: number) => p.partNumber !== i + 1)) {
    throw fail(400, 'bad_parts', `Send all ${count} parts as { partNumber, etag }.`);
  }
  try {
    await c.env.MEDIA.resumeMultipartUpload(row.r2_key, row.multipart_id).complete(list);
  } catch {
    throw fail(400, 'parts_missing', 'Some parts did not arrive. Send them again.');
  }

  const obj = await c.env.MEDIA.get(row.r2_key);
  if (!obj || obj.size !== row.declared_bytes) {
    await c.env.MEDIA.delete(row.r2_key);
    throw fail(400, 'upload_failed', 'The upload did not finish. Try again.');
  }
  const digest = new crypto.DigestStream('SHA-256');
  await obj.body.pipeTo(digest);
  const sha256 = toHex(await digest.digest);
  const size = obj.size;
  const { width, height } = await checkVideo(c, row, size);
  return markDone(c, row, { width, height, size, sha256, key: row.r2_key, storedType: row.content_type, sourceSha256: sha256, sourceBytes: size });
});

mediaRoutes.put('/v1/uploads/:id', requireAuth, async (c) => {
  const row = await pendingUpload(c);
  if (row.multipart_id) throw fail(409, 'use_parts', 'Send this file in parts.');
  const spec = TYPES[row.content_type];
  const length = Number(c.req.header('content-length') ?? '');
  const stream = c.req.raw.body;
  if (!stream) throw fail(400, 'empty_body', 'Send the file bytes as the request body.');
  if (Number.isFinite(length) && length > spec.max) throw fail(413, 'too_large', 'That file is too big.');

  if (spec.kind === 'image') {
    const buf = new Uint8Array(await c.req.arrayBuffer());
    if (!buf.length || buf.length > spec.max) throw fail(413, 'too_large', 'That file is too big.');
    const info = readImageInfo(buf);
    if (!info || info.contentType !== row.content_type) throw fail(415, 'bad_file', 'That file is not a valid image of the type you declared.');
    const sourceSha256 = toHex(await crypto.subtle.digest('SHA-256', buf));
    const small = await shrinkImage(c.env.IMAGES, buf);
    const out = small ?? buf;
    const { width, height } = (small && readImageInfo(small)) || info;
    const key = small ? `${row.id}.webp` : row.r2_key;
    const storedType = small ? 'image/webp' : row.content_type;
    const sha256 = toHex(await crypto.subtle.digest('SHA-256', out));
    await c.env.MEDIA.put(key, out, { httpMetadata: { contentType: storedType } });
    return markDone(c, row, { width, height, size: out.length, sha256, key, storedType, sourceSha256, sourceBytes: buf.length });
  }

  if (!Number.isFinite(length) || length <= 0) throw fail(411, 'length_required', 'Videos need a Content-Length header.');
  if (length > parts.size) throw fail(413, 'too_large', 'That file is too big.');
  const sniff = sniffVideo();
  const [toR2, toHash] = stream.pipeThrough(sniff.check).tee();
  const fixed = new FixedLengthStream(length);
  const digest = new crypto.DigestStream('SHA-256');
  let sha256: string;
  try {
    const [, , hash] = await Promise.all([
      toR2.pipeTo(fixed.writable),
      c.env.MEDIA.put(row.r2_key, fixed.readable, { httpMetadata: { contentType: row.content_type } }),
      toHash.pipeTo(digest).then(() => digest.digest),
    ]);
    sha256 = toHex(hash);
  } catch {
    await c.env.MEDIA.delete(row.r2_key);
    if (!sniff.state.ok) throw fail(415, 'bad_file', 'That file is not a valid video.');
    throw fail(400, 'upload_failed', 'The upload did not finish. Try again.');
  }
  const { width, height } = await checkVideo(c, row, length);
  return markDone(c, row, { width, height, size: length, sha256, key: row.r2_key, storedType: row.content_type, sourceSha256: sha256, sourceBytes: length });
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
