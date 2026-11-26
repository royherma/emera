import { deflateSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client, crc32, makeEnv, pngBytes } from './helpers';
import { isOwnUrl, keepForeign, ownAccounts, parseLens, rescoreMatches, runScan } from '../src/scan';
import { pdqDistance, pdqOf } from '../src/pdq';

const env = makeEnv({ SERP_API_KEY: 'serp_test', PUBLIC_ORIGIN: 'https://emera.social', SCAN_MONTHLY_LIMIT: '200', IMAGES: undefined });
const db = env.DB;
let seq = 0;
let lensCalls: string[] = [];
let thumbCalls: string[] = [];

function grayPng(size: number, pixel: (x: number, y: number) => number): Uint8Array {
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
  dv.setUint32(0, size);
  dv.setUint32(4, size);
  ihdr.set([8, 0, 0, 0, 0], 8);
  const raw = new Uint8Array((size + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) raw[y * (size + 1) + 1 + x] = pixel(x, y);
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const part of parts) { out.set(part, o); o += part.length; }
  return out;
}

const blocks = (seed: number) => {
  const level: number[] = [];
  let r = seed;
  for (let i = 0; i < 64; i++) { r = (r * 1103515245 + 12345) & 0x7fffffff; level.push(r % 256); }
  return level;
};
const picture = (seed: number, size = 128, noise = 0) => {
  const level = blocks(seed);
  return grayPng(size, (x, y) => {
    const base = level[Math.floor((y * 8) / size) * 8 + Math.floor((x * 8) / size)];
    return Math.max(0, Math.min(255, base + (noise ? ((x * 7 + y * 13) % (2 * noise + 1)) - noise : 0)));
  });
};
const ORIGINAL = picture(11);
const THUMBS: Record<string, Uint8Array> = {
  copy: picture(11, 128, 4),
  smallcopy: picture(11, 96),
  other1: picture(22),
  other2: picture(33),
  other3: picture(44),
};

const LENS = {
  visual_matches: [
    { title: 'Stolen print', link: 'https://shop.example.org/p/1', source: 'Example Shop', thumbnail: 'https://t.example.org/copy.png' },
    { title: 'Snyk', link: 'https://snyk.io/blog/x', source: 'Snyk', thumbnail: 'https://t.example.org/other1.png' },
    { title: 'Pictory', link: 'https://pictory.ai/', source: 'Pictory', thumbnail: 'https://t.example.org/other2.png' },
    { title: 'Spotify', link: 'https://www.spotify.com/premium', source: 'Spotify', thumbnail: 'https://t.example.org/other3.png' },
    { title: 'Random video', link: 'https://www.youtube.com/watch?v=abc', source: 'YouTube', thumbnail: 'https://t.example.org/other1.png' },
    { title: 'My TikTok', link: 'https://www.tiktok.com/@TIKHANDLE', source: 'TikTok', thumbnail: 'https://t.example.org/copy.png' },
    { title: 'My IG', link: 'https://www.instagram.com/IGHANDLE/', source: 'Instagram', thumbnail: 'https://t.example.org/copy.png' },
    { title: 'My Emera', link: 'https://emera.social/p/abc', source: 'Emera', thumbnail: 'https://t.example.org/copy.png' },
    { title: 'Own site', link: 'https://www.myart.test/work', source: 'myart', thumbnail: 'https://t.example.org/copy.png' },
    { title: 'Reposter', link: 'https://www.instagram.com/p/XyZ/', source: 'Instagram', thumbnail: 'https://t.example.org/smallcopy.png' },
    { title: 'No picture', link: 'https://nopic.example.org/a', source: 'NoPic' },
    { title: 'Dead thumb', link: 'https://dead.example.org/a', source: 'Dead', thumbnail: 'https://t.example.org/missing.png' },
  ],
  exact_matches: [
    { title: 'Exact copy', link: 'https://blog.example.net/x', source: 'Blog' },
    { title: 'Exact on my own YouTube', link: 'https://www.youtube.com/@YTHANDLE/videos', source: 'YouTube' },
  ],
};

function fakeLens(body: unknown = LENS, status = 200) {
  lensCalls = [];
  thumbCalls = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('serpapi.com')) {
      lensCalls.push(url);
      return Response.json(body as object, { status });
    }
    thumbCalls.push(url);
    const name = /\/([a-z0-9]+)\.png$/.exec(url)?.[1] ?? '';
    return THUMBS[name] ? new Response(THUMBS[name], { headers: { 'content-type': 'image/png' } }) : new Response('nope', { status: 404 });
  });
}

async function creator(plan: string | null, until: number | null = Date.now() + 86_400_000) {
  const c = new Client(env);
  const tag = `${Date.now().toString(36)}${seq++}`;
  await c.signIn(`s${tag}@example.test`);
  const handle = `s${tag}`.slice(0, 20);
  const me = await c.withHandle(handle, 'S');
  const id = me.body.user.id as string;
  await db.prepare('UPDATE users SET links = ?, other_handles = ? WHERE id = ?')
    .bind(JSON.stringify(['https://myart.test', 'https://www.tiktok.com/@tk' + tag]), `yt${tag}, @unused`, id).run();
  await db.prepare('INSERT INTO instagram_links (user_id, ig_user_id, username, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, '1', `ig${tag}`, 't', Date.now() + 1e9, Date.now()).run();
  if (plan) await db.prepare('UPDATE users SET plan = ?, plan_until = ? WHERE id = ?').bind(plan, until, id).run();
  const up = await c.upload(pngBytes(8, 8));
  const post = await c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], caption: 'x' });
  const postId = post.body.post.id as string;
  const media = await db.prepare('SELECT r2_key FROM media WHERE post_id = ?').bind(postId).first<{ r2_key: string }>();
  await env.MEDIA.put(media!.r2_key, ORIGINAL);
  const lens = JSON.parse(
    JSON.stringify(LENS).replace('TIKHANDLE', `tk${tag}`).replace('IGHANDLE', `ig${tag}`).replace('YTHANDLE', `yt${tag}`),
  );
  return { c, id, postId, handle, lens };
}

afterEach(() => vi.restoreAllMocks());

describe('own accounts', () => {
  const own = ownAccounts({ PUBLIC_ORIGIN: 'https://emera.social' }, {
    handle: 'roy', links: JSON.stringify(['https://myart.test', 'https://www.tiktok.com/@royt', 'https://youtube.com/channel/royyt']), other_handles: '@roy_alt, https://www.instagram.com/roy.ig/', ig_username: 'royig',
  });
  it('collects handles from every source and hosts only from non-platform links', () => {
    expect(own.handles.sort()).toEqual(['roy', 'roy.ig', 'roy_alt', 'royig', 'royt', 'royyt'].sort());
    expect(own.hosts).toEqual(['emera.social', 'myart.test']);
  });
  it('matches /@handle and /handle/ on platforms, never other people', () => {
    for (const u of ['https://www.tiktok.com/@royt/video/1', 'https://instagram.com/roy.ig/', 'https://www.instagram.com/royig', 'https://youtube.com/@roy', 'https://m.myart.test/x'])
      expect(isOwnUrl(u, own), u).toBe(true);
    for (const u of ['https://www.tiktok.com/@someoneelse', 'https://instagram.com/p/roy/', 'https://random.example/roy/', 'https://www.instagram.com/royig2/'])
      expect(isOwnUrl(u, own), u).toBe(false);
  });
  it('keepForeign drops the creator own pages', () => {
    expect(keepForeign(parseLens(LENS), own).map((c) => c.url)).toContain('https://shop.example.org/p/1');
    const exactMode = parseLens({ search_parameters: { type: 'exact_matches' }, visual_matches: [{ link: 'https://avatar.example/x', title: 'cropped avatar' }] });
    expect(exactMode[0].kind).toBe('exact');
    expect(keepForeign(parseLens(LENS), own).map((c) => c.url)).not.toContain('https://emera.social/p/abc');
  });
});

describe('pdq', () => {
  it('is close for a recompressed copy and far for another picture', async () => {
    const a = (await pdqOf({}, ORIGINAL))!;
    expect(pdqDistance(a, (await pdqOf({}, THUMBS.copy))!)).toBeLessThanOrEqual(31);
    expect(pdqDistance(a, (await pdqOf({}, THUMBS.smallcopy))!)).toBeLessThanOrEqual(31);
    expect(pdqDistance(a, (await pdqOf({}, THUMBS.other1))!)).toBeGreaterThan(60);
  });
});

describe('scanner', () => {
  it('asks Lens for exact matches once and keeps only likely copies, each explained', async () => {
    const { c, id, postId, lens } = await creator('creator');
    fakeLens(lens);
    const stats = await runScan(env);
    expect(stats.scanned).toBeGreaterThanOrEqual(1);
    expect(lensCalls.filter((u) => u.includes(encodeURIComponent('https://emera.social/media/')))).toHaveLength(1);
    expect(lensCalls[0]).toContain('type=exact_matches');
    const list = await c.json('GET', '/v1/protect/matches');
    expect(list.body.matches).toHaveLength(3);
    const byUrl = Object.fromEntries(list.body.matches.map((m: any) => [m.url, m.reason]));
    expect(byUrl['https://blog.example.net/x']).toBe('Lens exact match on Blog');
    expect(byUrl['https://shop.example.org/p/1']).toMatch(/^PDQ distance \d+ of 256 vs your original/);
    expect(byUrl['https://www.instagram.com/p/XyZ/']).toMatch(/^PDQ distance/);
    expect(list.body.matches[0].postId).toBe(postId);
    const rows = (await db.prepare('SELECT kind, score FROM matches WHERE user_id = ?').bind(id).all<any>()).results;
    expect(rows.map((r) => r.kind).sort()).toEqual(['exact', 'visual', 'visual']);
    expect(rows.filter((r) => r.kind === 'visual').every((r) => r.score <= 31)).toBe(true);
    const scan = await db.prepare('SELECT last_scanned_at, next_scan_at FROM scans WHERE user_id = ?').bind(id).first<any>();
    expect(scan.next_scan_at - scan.last_scanned_at).toBe(7 * 86_400_000);
    lensCalls = [];
    await runScan(env);
    expect(lensCalls).toHaveLength(0);
    expect((await c.json('GET', '/v1/protect/matches')).body.matches).toHaveLength(3);
    console.log(`fixture: ${lens.visual_matches.length + lens.exact_matches.length} Lens results, ${list.body.matches.length} survive`);
  });

  it('pro scans new posts daily', async () => {
    const { id, lens } = await creator('pro');
    fakeLens(lens);
    await runScan(env);
    const scan = await db.prepare('SELECT last_scanned_at, next_scan_at FROM scans WHERE user_id = ?').bind(id).first<any>();
    expect(scan.next_scan_at - scan.last_scanned_at).toBe(86_400_000);
  });

  it('skips free and expired plans', async () => {
    fakeLens();
    const free = await creator(null);
    const old = await creator('creator', Date.now() - 1000);
    await runScan(env);
    for (const u of [free, old]) expect((await db.prepare('SELECT COUNT(*) AS n FROM scans WHERE user_id = ?').bind(u.id).first<any>()).n).toBe(0);
  });

  it('stops at the monthly limit', async () => {
    fakeLens();
    await creator('creator');
    const tight = makeEnv({ SERP_API_KEY: 'k', PUBLIC_ORIGIN: 'https://emera.social', SCAN_MONTHLY_LIMIT: '0' });
    tight.DB = db;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const stats = await runScan(tight);
    expect(stats.stoppedByBudget).toBe(true);
    expect(lensCalls).toHaveLength(0);
  });

  it('retries in an hour when Lens errors', async () => {
    fakeLens({ error: 'boom' }, 500);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { id } = await creator('creator');
    const stats = await runScan(env);
    expect(stats.failed).toBeGreaterThanOrEqual(1);
    const scan = await db.prepare('SELECT last_scanned_at, next_scan_at FROM scans WHERE user_id = ?').bind(id).first<any>();
    expect(scan.last_scanned_at).toBeNull();
  });
});

describe('video frames', () => {
  const box = (type: string, ...parts: Uint8Array[]) => {
    const out = new Uint8Array(8 + parts.reduce((n, p) => n + p.length, 0));
    new DataView(out.buffer).setUint32(0, out.length);
    out.set(new TextEncoder().encode(type), 4);
    let o = 8;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  };
  const mp4 = (seconds: number) => {
    const mvhd = new Uint8Array(100);
    const mv = new DataView(mvhd.buffer);
    mv.setUint32(12, 1000);
    mv.setUint32(16, seconds * 1000);
    const tkhd = new Uint8Array(84);
    const tk = new DataView(tkhd.buffer);
    tk.setInt32(40, 0x10000);
    tk.setInt32(56, 0x10000);
    tk.setUint32(76, 720 * 65536);
    tk.setUint32(80, 1280 * 65536);
    const parts = [box('ftyp', new TextEncoder().encode('isom\0\0\0\0isom')), box('mdat', new Uint8Array(64)), box('moov', box('mvhd', mvhd), box('trak', box('tkhd', tkhd)))];
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  };

  async function videoCreator(seconds: number, withVideoBinding: boolean) {
    const u = await creator('creator');
    const file = mp4(seconds);
    const row = await db.prepare('SELECT id FROM media WHERE post_id = ?').bind(u.postId).first<{ id: string }>();
    await env.MEDIA.put(`${row!.id}.mp4`, file);
    await env.MEDIA.put(`${row!.id}-poster.jpg`, ORIGINAL);
    await db.prepare(`UPDATE media SET kind = 'video', r2_key = ?, poster_key = ?, bytes = ? WHERE id = ?`).bind(`${row!.id}.mp4`, `${row!.id}-poster.jpg`, file.length, row!.id).run();
    const times: string[] = [];
    const VIDEO = { input: () => ({ transform: () => ({ output: (o: { time: string }) => ({ response: async () => { times.push(o.time); return new Response(ORIGINAL); } }) }) }) };
    const withVideo = withVideoBinding ? makeEnv({ SERP_API_KEY: 'serp_test', PUBLIC_ORIGIN: 'https://emera.social', SCAN_MONTHLY_LIMIT: '200', IMAGES: undefined, VIDEO: VIDEO as any }) : env;
    withVideo.DB = db;
    withVideo.MEDIA = env.MEDIA;
    return { ...u, mediaId: row!.id, times, scanEnv: withVideo };
  }

  function lensPerFrame(byFrame: Record<string, object>) {
    lensCalls = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes('serpapi.com')) {
        lensCalls.push(decodeURIComponent(url));
        const hit = Object.keys(byFrame).find((k) => decodeURIComponent(url).includes(k));
        return Response.json(hit ? byFrame[hit] : {});
      }
      return new Response(THUMBS.copy, { headers: { 'content-type': 'image/png' } });
    });
  }

  it('searches 3 frames at 15, 50 and 85 percent, merges by URL and names the frame', async () => {
    const { c, mediaId, times, scanEnv, id } = await videoCreator(20, true);
    lensPerFrame({
      [`${mediaId}-f1.jpg`]: { exact_matches: [{ title: 'Repost', link: 'https://repost.example.net/a', source: 'Repost' }] },
      [`${mediaId}-f2.jpg`]: { exact_matches: [{ title: 'Repost again', link: 'https://repost.example.net/a', source: 'Repost' }] },
      [`${mediaId}-f3.jpg`]: { exact_matches: [{ title: 'Tok', link: 'https://www.tiktok.com/@thief/video/9', source: 'TikTok' }] },
    });
    const stats = await runScan(scanEnv);
    expect(times).toEqual(['3s', '10s', '17s']);
    expect(lensCalls).toHaveLength(3);
    expect(stats.found).toBe(2);
    const reasons = Object.fromEntries((await c.json('GET', '/v1/protect/matches')).body.matches.map((m: any) => [m.url, m.reason]));
    expect(reasons['https://repost.example.net/a']).toBe('Lens exact match on Repost, frame at 0:03');
    expect(reasons['https://www.tiktok.com/@thief/video/9']).toBe('Lens exact match on TikTok, frame at 0:17');
    expect(await env.MEDIA.head(`${mediaId}-f1.jpg`)).toBeNull();
    const spent = await db.prepare('SELECT n FROM scan_meta WHERE key = ?').bind(`serp:${new Date().toISOString().slice(0, 7)}`).first<any>();
    expect(spent.n).toBeGreaterThanOrEqual(3);
    console.log(`video: ${lensCalls.length} Lens calls, frames ${times.join(' ')}, ${stats.found} matches for ${id.slice(0, 4)}`);
  });

  it('uses the poster alone when there is no video binding', async () => {
    const { mediaId, scanEnv } = await videoCreator(20, false);
    lensPerFrame({});
    await runScan(scanEnv);
    expect(lensCalls).toHaveLength(1);
    expect(lensCalls[0]).toContain(`${mediaId}-poster.jpg`);
  });

  it('stops mid-video when the monthly budget runs out and keeps what it found', async () => {
    const { c, mediaId, scanEnv } = await videoCreator(20, true);
    const month = `serp:${new Date().toISOString().slice(0, 7)}`;
    const used = (await db.prepare('SELECT n FROM scan_meta WHERE key = ?').bind(month).first<any>())?.n ?? 0;
    scanEnv.SCAN_MONTHLY_LIMIT = String(used + 2);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    lensPerFrame({ [`${mediaId}-f2.jpg`]: { exact_matches: [{ title: 'Repost', link: 'https://repost.example.net/b', source: 'Repost' }] } });
    const stats = await runScan(scanEnv);
    expect(lensCalls).toHaveLength(2);
    expect(stats.stoppedByBudget).toBe(true);
    expect((await c.json('GET', '/v1/protect/matches')).body.matches.map((m: any) => m.url)).toContain('https://repost.example.net/b');
  });
});

describe('rescoreMatches', () => {
  it('dismisses old lookalikes and own accounts with a reason, keeps copies, deletes nothing', async () => {
    const { id, postId, lens } = await creator('creator');
    const all = [...lens.exact_matches.map((m: any) => ({ ...m, k: 'exact' })), ...lens.visual_matches.map((m: any) => ({ ...m, k: 'visual' }))];
    for (const [i, m] of all.entries()) {
      await db.prepare('INSERT INTO matches (id, post_id, user_id, url, page_title, site, thumbnail, found_at, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(`old${seq}-${i}`, postId, id, m.link, m.title, m.source, m.thumbnail ?? null, Date.now(), `Lens ${m.k} match on ${m.source}`).run();
    }
    fakeLens();
    const stats = await rescoreMatches(env, id);
    expect(stats).toMatchObject({ checked: 14, kept: 3, dismissed: 11, retry: 0, remaining: 0 });
    const rows = (await db.prepare('SELECT url, status, reason FROM matches WHERE user_id = ?').bind(id).all<any>()).results;
    expect(rows).toHaveLength(14);
    expect(rows.filter((r) => r.status === 'new')).toHaveLength(3);
    const snyk = rows.find((r) => r.url.includes('snyk.io'));
    expect(snyk.status).toBe('dismissed');
    expect(snyk.reason).toMatch(/^auto: not a copy \(PDQ distance \d+ of 256 vs your original\)$/);
    expect(rows.find((r) => r.url.includes('instagram.com/ig')).reason).toBe('auto: not a copy (your own account)');
    expect((await rescoreMatches(env, id)).checked).toBe(0);
  });
});

describe('matches API', () => {
  async function withMatch() {
    const u = await creator('creator');
    fakeLens(u.lens);
    await runScan(env);
    const list = await u.c.json('GET', '/v1/protect/matches');
    return { ...u, matches: list.body.matches as any[] };
  }

  it('needs sign-in', async () => {
    expect((await new Client(env).json('GET', '/v1/protect/matches')).status).toBe(401);
  });

  it('takedown files a report and is idempotent', async () => {
    const { c, matches } = await withMatch();
    const m = matches[0];
    const t = await c.json('POST', `/v1/protect/matches/${m.id}/takedown`);
    expect(t.status).toBe(201);
    expect(t.body.match.status).toBe('reported');
    const reports = await c.json('GET', '/v1/reports');
    expect(reports.body.reports.map((r: any) => r.url)).toContain(m.url);
    expect(reports.body.reports[0].note).toContain('Lens');
    const again = await c.json('POST', `/v1/protect/matches/${m.id}/takedown`);
    expect(again.body.report.id).toBe(t.body.report.id);
    expect((await c.json('GET', '/v1/reports')).body.reports).toHaveLength(1);
  });

  it('dismiss hides the match and rescans do not bring it back', async () => {
    const { c, id, matches } = await withMatch();
    await c.json('POST', `/v1/protect/matches/${matches[0].id}/dismiss`);
    expect((await c.json('GET', '/v1/protect/matches')).body.matches).toHaveLength(2);
    await db.prepare('UPDATE scans SET next_scan_at = 0 WHERE user_id = ?').bind(id).run();
    await runScan(env);
    expect((await c.json('GET', '/v1/protect/matches')).body.matches).toHaveLength(2);
  });

  it("cannot touch someone else's match", async () => {
    const { matches } = await withMatch();
    const other = await creator('creator');
    expect((await other.c.json('POST', `/v1/protect/matches/${matches[0].id}/takedown`)).status).toBe(404);
    expect((await other.c.json('POST', `/v1/protect/matches/${matches[0].id}/dismiss`)).status).toBe(404);
  });
});

describe('scan-now', () => {
  it('needs a live plan', async () => {
    const { c } = await creator(null);
    expect((await c.json('POST', '/v1/protect/scan-now')).status).toBe(403);
  });

  it('says to turn on free protection first for a non-opted free user', async () => {
    const { c } = await creator(null);
    const res = await c.json('POST', '/v1/protect/scan-now');
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Turn on free protection first.');
  });

  it('allows an opted-in free user once per 30 days', async () => {
    const { c, id } = await creator(null);
    await db.prepare('UPDATE users SET protect_opt_in_at = ? WHERE id = ?').bind(Date.now(), id).run();
    expect((await c.json('POST', '/v1/protect/scan-now')).status).toBe(202);
    const second = await c.json('POST', '/v1/protect/scan-now');
    expect(second.status).toBe(403);
    expect(second.body.error.code).toBe('free_scan_limit');
    await db.prepare('UPDATE scan_meta SET n = ? WHERE key = ?').bind(Date.now() - 31 * 86_400_000, `now30:${id}`).run();
    expect((await c.json('POST', '/v1/protect/scan-now')).status).toBe(202);
  });

  it('queues the posts and allows once an hour', async () => {
    const { c, id, lens } = await creator('creator');
    fakeLens(lens);
    await runScan(env);
    const first = await c.json('POST', '/v1/protect/scan-now');
    expect(first.status).toBe(202);
    expect((await db.prepare('SELECT next_scan_at FROM scans WHERE user_id = ?').bind(id).first<any>()).next_scan_at).toBe(0);
    const second = await c.json('POST', '/v1/protect/scan-now');
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('too_soon');
  });
});

describe('free opted-in scanning', () => {
  it('skips free users who did not opt in', async () => {
    const { id } = await creator(null);
    fakeLens();
    await runScan(env);
    expect((await db.prepare('SELECT COUNT(*) AS n FROM scans WHERE user_id = ?').bind(id).first<any>()).n).toBe(0);
  });

  it('scans at most the 10 newest posts and waits 30 days', async () => {
    const { id } = await creator(null);
    await db.prepare('UPDATE users SET protect_opt_in_at = ? WHERE id = ?').bind(Date.now(), id).run();
    const base = await db.prepare('SELECT * FROM media WHERE user_id = ?').bind(id).first<any>();
    for (let i = 0; i < 12; i++) {
      const pid = `fp${seq}x${i}`;
      await db.prepare('INSERT INTO posts (id, user_id, caption, created_at) VALUES (?, ?, ?, ?)').bind(pid, id, 'x', Date.now() + (i + 1) * 1000).run();
      await db.prepare('INSERT INTO media (id, user_id, kind, content_type, declared_bytes, status, bytes, r2_key, post_id, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)')
        .bind(`fm${seq}x${i}`, id, base.kind, base.content_type, base.declared_bytes, 'done', base.bytes, base.r2_key, pid, Date.now()).run();
    }
    fakeLens();
    for (let i = 0; i < 6; i++) await runScan(env);
    const rows = (await db.prepare('SELECT post_id, next_scan_at, last_scanned_at FROM scans WHERE user_id = ?').bind(id).all<any>()).results;
    expect(rows.length).toBe(10);
    expect(rows.some((r) => r.post_id === base.post_id)).toBe(false);
    for (const r of rows) expect(r.next_scan_at - r.last_scanned_at).toBeGreaterThanOrEqual(30 * 86_400_000 - 1000);
  });
});
