#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSource, parseSource, fmtBytes } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const USAGE = 'usage: node tools/import/import.mjs <export.zip|folder> --api <url> --token <session token> [--dry-run] [--limit N] [--state file]';

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dry = true;
    else if (['--api', '--token', '--limit', '--state'].includes(a)) out[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}

const pad = (s, n) => (s.length > n ? s.slice(0, n - 1) + '~' : s.padEnd(n));
const oneLine = (s) => s.replace(/\s+/g, ' ').trim();

function table(posts, done) {
  console.log(`${pad('#', 4)}${pad('date', 11)}${pad('caption', 62)}${pad('media', 6)}${pad('size', 10)}status`);
  posts.forEach((p, i) => {
    const bytes = p.usable.reduce((n, m) => n + m.bytes, 0);
    const status = done.has(p.key) ? 'imported' : p.reason ? `skip: ${p.reason}` : p.skipped.length ? `ok (${p.skipped.length} files skipped)` : 'ready';
    const date = p.date ? p.date.toISOString().slice(0, 10) : 'unknown';
    console.log(`${pad(String(i + 1), 4)}${pad(date, 11)}${pad(oneLine(p.caption).slice(0, 60), 62)}${pad(String(p.usable.length), 6)}${pad(p.usable.length ? fmtBytes(bytes) : '-', 10)}${status}`);
  });
}

async function call(api, token, path, init = {}) {
  const res = await fetch(api + path, {
    ...init,
    headers: { 'X-TG-Tester': '1', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    const e = new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${json?.error?.code ?? ''} ${json?.error?.message ?? text.slice(0, 120)}`);
    e.status = res.status;
    throw e;
  }
  return json;
}

async function uploadMedia(api, token, m, state, postKey) {
  const cached = state.posts[postKey]?.uploads?.[m.uri];
  if (cached) return cached;
  const slot = await call(api, token, '/v1/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: m.contentType, bytes: m.bytes }),
  });
  const body = readFileSync(m.path);
  const url = new URL(slot.uploadUrl);
  const put = await call(api, token, url.pathname, { method: 'PUT', headers: { 'Content-Type': m.contentType }, body });
  return put.media.id;
}

async function main() {
  const a = args(process.argv.slice(2));
  const input = a._[0];
  if (!input) return console.error(USAGE), process.exit(2);
  if (!a.dry && (!a.api || !a.token)) return console.error(`--api and --token are required unless --dry-run\n${USAGE}`), process.exit(2);

  const src = openSource(input);
  const { mode, posts: all } = parseSource(src.root);
  const limit = a.limit ? Number(a.limit) : Infinity;
  const stateFile = resolve(a.state ?? join(here, 'state', createHash('sha1').update(resolve(input) + (a.api ?? '')).digest('hex').slice(0, 12) + '.json'));
  const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { posts: {} };
  const save = () => {
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  };
  const done = new Set(Object.entries(state.posts).filter(([, v]) => v.postId).map(([k]) => k));

  const posts = all.slice(0, limit);
  console.log(`source: ${src.label}\nlayout: ${mode}\nposts found: ${all.length}${posts.length < all.length ? ` (showing first ${posts.length} by --limit)` : ''}\n`);
  table(posts, done);
  const todo = posts.filter((p) => !p.reason && !done.has(p.key));
  console.log(`\nready ${todo.length}, already imported ${posts.filter((p) => done.has(p.key)).length}, skipped ${posts.filter((p) => p.reason).length}`);
  if (a.dry) return console.log('dry run: nothing uploaded');

  const api = a.api.replace(/\/$/, '');
  const me = await call(api, a.token, '/v1/me');
  console.log(`\nimporting as @${me.user.handle}, oldest first so the feed order matches the originals`);
  let ok = 0;
  let failed = 0;
  for (const [n, p] of todo.entries()) {
    const entry = (state.posts[p.key] ??= { uploads: {} });
    try {
      const ids = [];
      for (const m of p.usable) {
        const id = await uploadMedia(api, a.token, m, state, p.key);
        entry.uploads[m.uri] = id;
        save();
        ids.push(id);
      }
      const res = await call(api, a.token, '/v1/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaIds: ids, caption: p.caption, ...(p.date ? { createdAt: p.date.toISOString() } : {}) }),
      });
      entry.postId = res.post.id;
      entry.originalDate = p.date?.toISOString() ?? null;
      save();
      ok++;
      console.log(`[${n + 1}/${todo.length}] ${p.date?.toISOString().slice(0, 10) ?? 'unknown'} -> ${res.post.url ?? res.post.id}`);
    } catch (e) {
      failed++;
      console.log(`[${n + 1}/${todo.length}] FAILED ${e.message}`);
      if (e.status === 401) break;
    }
  }
  console.log(`\ndone: ${ok} posted, ${failed} failed. state: ${stateFile}`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => (console.error(e.message), process.exit(1)));
