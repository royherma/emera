import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative, extname, basename, resolve } from 'node:path';

const MB = 1024 * 1024;
export const TYPES = {
  '.jpg': ['image/jpeg', 25 * MB],
  '.jpeg': ['image/jpeg', 25 * MB],
  '.png': ['image/png', 25 * MB],
  '.webp': ['image/webp', 25 * MB],
  '.heic': ['image/heic', 25 * MB],
  '.mp4': ['video/mp4', 200 * MB],
  '.mov': ['video/quicktime', 200 * MB],
};
export const MAX_CAPTION = 2200;
export const MAX_MEDIA = 10;
const POST_FILES = [
  'your_instagram_activity/media/posts_1.json',
  'your_instagram_activity/content/posts_1.json',
  'content/posts_1.json',
];

export function mojibake(s) {
  if (typeof s !== 'string' || !/[\u0080-ÿ]/.test(s)) return s;
  if ([...s].some((ch) => ch.charCodeAt(0) > 255)) return s;
  const fixed = Buffer.from(s, 'latin1').toString('utf8');
  return fixed.includes('�') ? s : fixed;
}

export function openSource(input) {
  const abs = resolve(input);
  if (!existsSync(abs)) throw new Error(`not found: ${abs}`);
  if (statSync(abs).isDirectory()) return { root: abs, label: abs };
  if (!abs.toLowerCase().endsWith('.zip')) throw new Error('give a .zip export or a folder');
  const root = mkdtempSync(join(tmpdir(), 'emera-import-'));
  execFileSync('unzip', ['-q', '-o', abs, '-d', root]);
  return { root, label: abs };
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function findPostsJson(root) {
  for (const rel of POST_FILES) if (existsSync(join(root, rel))) return join(root, rel);
  const hit = walk(root).find((p) => /(^|\/)posts_1\.json$/.test(relative(root, p)));
  return hit ?? null;
}

function mediaItem(root, uri, ts) {
  const path = join(root, uri);
  const ext = extname(uri).toLowerCase();
  const spec = TYPES[ext];
  if (!existsSync(path)) return { uri, skip: 'file missing in export' };
  const bytes = statSync(path).size;
  if (!spec) return { uri, skip: `unsupported type ${ext || 'none'}` };
  if (bytes > spec[1]) return { uri, skip: `over ${spec[1] / MB} MB limit` };
  return { uri, path, bytes, contentType: spec[0], ts };
}

function fromInstagram(root, file) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const list = Array.isArray(data) ? data : data.posts ?? data.media ?? [];
  return list.map((p, i) => {
    const media = (p.media ?? []).map((m) => ({ ...m, creation_timestamp: m.creation_timestamp ?? m.taken_at }));
    const stamps = media.map((m) => m.creation_timestamp).filter(Number.isFinite);
    const ts = p.creation_timestamp ?? (stamps.length ? Math.min(...stamps) : null);
    const caption = mojibake(p.title ?? media.find((m) => m.title)?.title ?? '');
    return {
      key: `ig:${media.map((m) => m.uri).join('|')}`,
      index: i,
      date: ts ? new Date(ts * 1000) : null,
      caption,
      media: media.map((m) => mediaItem(root, m.uri, m.creation_timestamp)),
    };
  });
}

function fromFolder(root) {
  const files = walk(root).filter((p) => TYPES[extname(p).toLowerCase()]).sort();
  return files.map((p, i) => {
    const rel = relative(root, p);
    const side = p.replace(/\.[^.]+$/, '.txt');
    const caption = existsSync(side) ? readFileSync(side, 'utf8').trim() : '';
    return {
      key: `file:${rel}`,
      index: i,
      date: statSync(p).mtime,
      caption,
      media: [mediaItem(root, rel, null)],
      name: basename(p),
    };
  });
}

export function parseSource(root) {
  const file = findPostsJson(root);
  const posts = file ? fromInstagram(root, file) : fromFolder(root);
  const mode = file ? `instagram (${relative(root, file)})` : 'plain folder';
  for (const p of posts) {
    p.usable = p.media.filter((m) => !m.skip).slice(0, MAX_MEDIA);
    p.skipped = p.media.filter((m) => m.skip);
    if (p.media.length > MAX_MEDIA) p.skipped.push({ uri: `${p.media.length - MAX_MEDIA} extra files`, skip: `post limit is ${MAX_MEDIA} files` });
    if (p.caption.length > MAX_CAPTION) {
      p.caption = p.caption.slice(0, MAX_CAPTION);
      p.trimmed = true;
    }
    p.reason = p.usable.length ? null : p.skipped[0]?.skip ?? 'no media';
  }
  posts.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0) || a.index - b.index);
  return { mode, posts };
}

export const fmtBytes = (n) => (n >= MB ? `${(n / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
