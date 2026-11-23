import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client, makeEnv, pngBytes } from './helpers';
import { keepForeign, parseLens, runScan } from '../src/scan';

const env = makeEnv({ SERP_API_KEY: 'serp_test', PUBLIC_ORIGIN: 'https://emera.social', SCAN_MONTHLY_LIMIT: '200' });
const db = env.DB;
let seq = 0;
let lensCalls: string[] = [];

const LENS = {
  visual_matches: [
    { title: 'Stolen print', link: 'https://shop.example.org/p/1', source: 'Example Shop', thumbnail: 'https://t.example.org/1.jpg' },
    { title: 'Mine', link: 'https://emera.social/p/abc', source: 'Emera' },
    { title: 'Own site', link: 'https://www.myart.test/work', source: 'myart' },
  ],
  exact_matches: [{ title: 'Exact copy', link: 'https://blog.example.net/x', source: 'Blog' }],
};

function fakeLens(body: unknown = LENS, status = 200) {
  lensCalls = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    lensCalls.push(String(input instanceof Request ? input.url : input));
    return Response.json(body as object, { status });
  });
}

async function creator(plan: string | null, until: number | null = Date.now() + 86_400_000) {
  const c = new Client(env);
  const tag = `${Date.now().toString(36)}${seq++}`;
  await c.signIn(`s${tag}@example.test`);
  const me = await c.withHandle(`s${tag}`.slice(0, 20), 'S');
  const id = me.body.user.id as string;
  await db.prepare('UPDATE users SET links = ? WHERE id = ?').bind(JSON.stringify(['https://myart.test']), id).run();
  if (plan) await db.prepare('UPDATE users SET plan = ?, plan_until = ? WHERE id = ?').bind(plan, until, id).run();
  const up = await c.upload(pngBytes(8, 8));
  const post = await c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], caption: 'x' });
  return { c, id, postId: post.body.post.id as string };
}

afterEach(() => vi.restoreAllMocks());

describe('lens parsing', () => {
  it('drops own domains and creator links', () => {
    const kept = keepForeign(parseLens(LENS), ['emera.social', 'myart.test']);
    expect(kept.map((k) => k.url)).toEqual(['https://blog.example.net/x', 'https://shop.example.org/p/1']);
  });
});

describe('scanner', () => {
  it('scans live-plan posts, stores explained matches, and reschedules', async () => {
    fakeLens();
    const { c, id, postId } = await creator('creator');
    const stats = await runScan(env);
    expect(stats.scanned).toBeGreaterThanOrEqual(1);
    expect(lensCalls[0]).toContain('engine=google_lens');
    expect(lensCalls[0]).toContain(encodeURIComponent('https://emera.social/media/'));
    const list = await c.json('GET', '/v1/protect/matches');
    expect(list.status).toBe(200);
    expect(list.body.matches).toHaveLength(2);
    expect(list.body.matches.map((m: any) => m.reason).sort()).toEqual(['Lens exact match on Blog', 'Lens visual match on Example Shop']);
    expect(list.body.matches[0].postId).toBe(postId);
    const scan = await db.prepare('SELECT last_scanned_at, next_scan_at FROM scans WHERE user_id = ?').bind(id).first<any>();
    expect(scan.next_scan_at - scan.last_scanned_at).toBe(7 * 86_400_000);
    lensCalls = [];
    await runScan(env);
    expect(lensCalls).toHaveLength(0);
    expect((await c.json('GET', '/v1/protect/matches')).body.matches).toHaveLength(2);
  });

  it('pro scans new posts daily', async () => {
    fakeLens();
    const { id } = await creator('pro');
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

describe('matches API', () => {
  async function withMatch() {
    fakeLens();
    const u = await creator('creator');
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
    expect((await c.json('GET', '/v1/protect/matches')).body.matches).toHaveLength(1);
    await db.prepare('UPDATE scans SET next_scan_at = 0 WHERE user_id = ?').bind(id).run();
    await runScan(env);
    expect((await c.json('GET', '/v1/protect/matches')).body.matches).toHaveLength(1);
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

  it('queues the posts and allows once an hour', async () => {
    fakeLens();
    const { c, id } = await creator('creator');
    await runScan(env);
    const first = await c.json('POST', '/v1/protect/scan-now');
    expect(first.status).toBe(202);
    expect((await db.prepare('SELECT next_scan_at FROM scans WHERE user_id = ?').bind(id).first<any>()).next_scan_at).toBe(0);
    const second = await c.json('POST', '/v1/protect/scan-now');
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('too_soon');
  });
});
