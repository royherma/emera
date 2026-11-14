// Walks every core flow against a live API with two signed-in test accounts, then deletes both.
// Usage: TOKEN_A=... TOKEN_B=... node tools/prod-check.mjs [https://api.emera.social]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API = process.argv[2] ?? 'https://api.emera.social';
const SITE = API.includes('api.emera.social') ? 'https://emera.social' : API;
const A = process.env.TOKEN_A, B = process.env.TOKEN_B;
if (!A || !B) { console.error('set TOKEN_A and TOKEN_B'); process.exit(2); }

const results = [];
const tag = Math.random().toString(36).slice(2, 7);
const work = mkdtempSync(join(tmpdir(), 'emera-check-'));

async function call(token, method, path, body, raw) {
  const headers = { 'X-TG-Tester': '1' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !raw) headers['Content-Type'] = 'application/json';
  if (raw) headers['Content-Type'] = raw;
  const res = await fetch(path.startsWith('http') ? path : API + path, { method, headers, body: raw ? body : body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function step(name, fn) {
  try {
    const note = await fn();
    results.push({ ok: true, name, note: note ?? '' });
  } catch (e) {
    results.push({ ok: false, name, note: String(e.message ?? e).slice(0, 160) });
  }
}

function want(r, status, what = '') {
  if (r.status !== status) throw new Error(`${what} ${r.status} ${r.text.slice(0, 120)}`);
  return r.json;
}

async function upload(token, file, contentType, seconds) {
  const bytes = readFileSync(file);
  const up = want(await call(token, 'POST', '/v1/uploads', { contentType, bytes: bytes.length, seconds }), 200, 'start');
  const put = await call(token, 'PUT', up.uploadUrl, bytes, contentType);
  if (put.status !== 200 && put.status !== 201) throw new Error(`put ${put.status} ${put.text.slice(0, 120)}`);
  return put.json.media;
}

const png = join(work, 'pic.png');
execFileSync('node', [new URL('../apps/api/scripts/make-png.mjs', import.meta.url).pathname, png, '640', '480']);
const mp4 = join(work, 'clip.mp4');
execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=720x1280:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', mp4]);

const s = {};
await step('pick handles', async () => {
  for (const [k, t] of [['a', A], ['b', B]]) {
    const r = await call(t, 'POST', '/v1/auth/handle', { handle: `check${k}${tag}`, displayName: `Check ${k.toUpperCase()}` });
    s[k] = want(r, 200, k).user.handle;
  }
  return `${s.a}, ${s.b}`;
});
await step('edit profile', async () => {
  want(await call(A, 'PATCH', '/v1/me', { bio: 'Launch check account', links: ['https://emera.social'] }), 200);
});
await step('post a photo', async () => {
  const m = await upload(A, png, 'image/png');
  s.photoMedia = m;
  const p = want(await call(A, 'POST', '/v1/posts', { mediaIds: [m.id], caption: `launch check photo ${tag}` }), 201, 'post');
  s.photo = p.post;
  return `${m.contentType} ${m.width}x${m.height}, proof ${m.proof ? 'yes' : 'no'}`;
});
await step('post a video', async () => {
  const m = await upload(A, mp4, 'video/mp4', 4);
  const p = want(await call(A, 'POST', '/v1/posts', { mediaIds: [m.id], caption: `launch check video ${tag}` }), 201, 'post');
  s.video = p.post;
  return `${m.width}x${m.height}`;
});
await step('feed shows the post', async () => {
  const f = want(await call(B, 'GET', '/v1/feed'), 200);
  if (!f.posts.some((p) => p.id === s.photo.id)) throw new Error('photo missing from feed');
});
await step('public post + profile pages', async () => {
  const out = [];
  for (const path of [`/p/${s.photo.id}`, `/p/${s.photo.id}/card.png`, `/@${s.a}`, `/embed/${s.photo.id}`, `/feed.xml`]) {
    const r = await fetch(SITE + path, { headers: { 'X-TG-Tester': '1' } });
    out.push(`${r.status}`);
    if (r.status !== 200) throw new Error(`${path} ${r.status}`);
  }
  const o = await call(null, 'GET', `/oembed?url=${encodeURIComponent(`${SITE}/p/${s.photo.id}`)}`);
  want(o, 200, 'oembed');
  return 'post, card, profile, embed, rss, oembed';
});
await step('follow + following feed', async () => {
  want(await call(B, 'POST', `/v1/follows/${s.a}`), 200);
  const f = want(await call(B, 'GET', '/v1/feed?mode=following'), 200);
  if (!f.posts.some((p) => p.id === s.photo.id)) throw new Error('following feed missing post');
});
await step('like + comment + reply', async () => {
  want(await call(B, 'POST', `/v1/posts/${s.photo.id}/like`), 200);
  const c = want(await call(B, 'POST', `/v1/posts/${s.photo.id}/comments`, { body: 'Love this' }), 201).comment;
  want(await call(A, 'POST', `/v1/posts/${s.photo.id}/comments`, { body: 'Thank you', parentId: c.id }), 201);
  const list = want(await call(null, 'GET', `/v1/posts/${s.photo.id}/comments`), 200);
  if (list.total !== 2) throw new Error(`total ${list.total}`);
});
await step('notifications', async () => {
  const n = want(await call(A, 'GET', '/v1/notifications'), 200);
  const kinds = [...new Set(n.notifications.map((x) => x.kind))].sort().join(',');
  if (!/comment/.test(kinds) || !/follow/.test(kinds) || !/like/.test(kinds)) throw new Error(`got ${kinds}`);
  want(await call(A, 'POST', '/v1/notifications/read', {}), 200);
  return kinds;
});
await step('video view counts', async () => {
  const v = want(await call(B, 'POST', `/v1/posts/${s.video.id}/view`), 200);
  if (v.viewCount !== 1) throw new Error(`viewCount ${v.viewCount}`);
});
await step('search people + posts', async () => {
  const p = want(await call(null, 'GET', `/v1/search?q=${s.a}&type=people`), 200);
  if (!p.users.some((u) => u.handle === s.a)) throw new Error('person not found');
  const q = want(await call(null, 'GET', `/v1/search?q=${tag}&type=posts`), 200);
  if (q.posts.length < 2) throw new Error(`${q.posts.length} posts found`);
});
await step('report a copy', async () => {
  const r = want(await call(A, 'POST', '/v1/reports', { postId: s.photo.id, url: 'https://example.com/copied-photo', note: 'launch check' }), 201);
  const l = want(await call(A, 'GET', '/v1/reports'), 200);
  if (!l.reports.some((x) => x.id === r.report.id)) throw new Error('report not listed');
  return `status ${r.report.status}`;
});
await step('report a post (abuse)', async () => {
  want(await call(B, 'POST', '/v1/flags', { targetType: 'post', targetId: s.photo.id, reason: 'spam', note: 'launch check' }), 201);
});
await step('direct messages', async () => {
  const d = want(await call(B, 'POST', '/v1/dms', { handle: s.a, body: 'hi from the launch check' }), 201);
  const req = want(await call(A, 'GET', '/v1/dms?box=requests'), 200);
  const t = req.threads.find((x) => x.id === d.thread.id);
  if (!t) throw new Error('request not in A requests');
  want(await call(A, 'POST', `/v1/dms/${t.id}/accept`), 200);
  want(await call(A, 'POST', `/v1/dms/${t.id}/messages`, { body: 'hi back', postId: s.photo.id }), 201);
  const m = want(await call(B, 'GET', `/v1/dms/${t.id}/messages`), 200);
  if (m.messages.length !== 2) throw new Error(`${m.messages.length} messages`);
});
await step('channels', async () => {
  const c = want(await call(A, 'GET', '/v1/channels'), 200);
  if (!c.channels.length) throw new Error('no channels');
  const id = c.channels[0].id;
  const m = want(await call(A, 'POST', `/v1/channels/${id}/messages`, { body: 'launch check, deleting now' }), 201).message;
  want(await call(A, 'DELETE', `/v1/channels/${id}/messages/${m.id}`), 200);
  want(await call(A, 'POST', '/v1/chat/live', { kind: 'me' }), 200);
  return `${c.channels.length} channels`;
});
await step('invite link', async () => {
  const i = want(await call(A, 'POST', '/v1/invites', {}), 200, 'create');
  const v = want(await call(null, 'GET', `/v1/invites/${i.code}`), 200);
  if (!v.valid) throw new Error('invite not valid');
  const page = await fetch(i.url, { headers: { 'X-TG-Tester': '1' } });
  if (page.status !== 200) throw new Error(`invite page ${page.status}`);
});
await step('mute + block', async () => {
  want(await call(B, 'POST', `/v1/mutes/${s.a}`), 200);
  const f = want(await call(B, 'GET', '/v1/feed'), 200);
  if (f.posts.some((p) => p.author.handle === s.a)) throw new Error('muted posts still in feed');
  want(await call(B, 'DELETE', `/v1/mutes/${s.a}`), 200);
  want(await call(B, 'POST', `/v1/blocks/${s.a}`), 200);
  const p = await call(A, 'GET', `/v1/users/${s.b}`);
  if (p.status !== 404) throw new Error(`blocked profile ${p.status}`);
  want(await call(B, 'DELETE', `/v1/blocks/${s.a}`), 200);
});
await step('delete a post', async () => {
  want(await call(A, 'DELETE', `/v1/posts/${s.video.id}`), 200);
  const g = await call(null, 'GET', `/v1/posts/${s.video.id}`);
  if (g.status !== 404) throw new Error(`deleted post ${g.status}`);
});
await step('delete both accounts', async () => {
  for (const t of [A, B]) want(await call(t, 'DELETE', '/v1/me'), 200);
  const g = await call(null, 'GET', `/v1/users/${s.a}`);
  if (g.status !== 404) throw new Error(`deleted profile ${g.status}`);
  const pub = await fetch(`${SITE}/p/${s.photo.id}`, { headers: { 'X-TG-Tester': '1' } });
  if (pub.status !== 404 && pub.status !== 410) throw new Error(`public post after delete ${pub.status}`);
});

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(28)} ${r.note}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
