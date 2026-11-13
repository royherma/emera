import { beforeEach, describe, expect, it } from 'vitest';
import { Client, makeEnv, pngBytes } from './helpers';
import { dayOf, monthOf, runFundCron, statementHash } from '../src/fund';
import { CREATOR_CAP_S, PHOTO_CAP_S, VIDEO_CAP_S } from '../src/fundRules';

const env = makeEnv();
const db = env.DB;
const DAY_MS = 86_400_000;
let seq = 0;
const uniq = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

beforeEach(async () => {
  await db.batch(['fund_shares', 'fund_months', 'fund_watch', 'sponsorships', 'sponsors'].map((t) => db.prepare(`DELETE FROM ${t}`)));
});

async function member(opts: { aged?: boolean } = {}) {
  const c = new Client(env);
  const tag = uniq();
  await c.signIn(`m${tag}@example.test`);
  const res = await c.withHandle(`m${tag}`.slice(0, 20), 'Member');
  const id = res.body.user.id as string;
  if (opts.aged !== false) await db.prepare('UPDATE users SET created_at = ? WHERE id = ?').bind(Date.now() - 2 * DAY_MS, id).run();
  return { c, id, handle: res.body.user.handle as string };
}

async function makePost(c: Client, video = false) {
  const up = await c.upload(pngBytes(8, 8));
  const res = await c.json('POST', '/v1/posts', { mediaIds: [up.body.media.id], caption: 'hi' });
  const postId = res.body.post.id as string;
  if (video) await db.prepare(`UPDATE media SET kind = 'video' WHERE post_id = ?`).bind(postId).run();
  return postId;
}

async function rawCreator() {
  const id = `u${uniq()}`;
  await db.prepare('INSERT INTO users (id, email, handle, display_name, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, `${id}@example.test`, id.slice(0, 20), id, Date.now() - 10 * DAY_MS).run();
  const postId = `p${uniq()}`;
  await db.prepare('INSERT INTO posts (id, user_id, caption, created_at) VALUES (?, ?, ?, ?)').bind(postId, id, '', Date.now()).run();
  return { id, postId, handle: id.slice(0, 20) };
}

async function watchRow(day: string, viewer: string, creator: { id: string; postId: string }, seconds: number) {
  await db.prepare('INSERT INTO fund_watch (day, viewer_id, post_id, creator_id, seconds) VALUES (?, ?, ?, ?, ?)')
    .bind(day, viewer, creator.postId, creator.id, seconds).run();
}

const admin = () => {
  const a = new Client(env);
  a.token = 'dev-fund-admin';
  return a;
};

async function sponsor(amountCents: number, months: string[], extra: Record<string, unknown> = {}) {
  const res = await admin().json('POST', '/v1/admin/fund/sponsorships', { sponsorName: `Quillfern ${uniq()}`, amountCents, months, ...extra });
  expect(res.status).toBe(201);
  return res.body.sponsorships as any[];
}

const close = (month: string) => admin().json('POST', '/v1/admin/fund/close', { month });

const watch = (c: Client, postId: string, seconds: number) => c.json('POST', '/v1/watch', { postId, seconds });

describe('watch time caps', () => {
  it('counts a photo post up to 60 seconds a day', async () => {
    const creator = await member();
    const viewer = await member();
    const postId = await makePost(creator.c);
    expect((await watch(viewer.c, postId, 25)).body).toEqual({ counted: 25 });
    expect((await watch(viewer.c, postId, 25)).body).toEqual({ counted: 25 });
    expect((await watch(viewer.c, postId, 25)).body).toEqual({ counted: PHOTO_CAP_S - 50 });
    expect((await watch(viewer.c, postId, 25)).body).toEqual({ counted: 0 });
  });

  it('counts a video post up to 10 minutes a day', async () => {
    const creator = await member();
    const viewer = await member();
    const postId = await makePost(creator.c, true);
    let total = 0;
    for (let i = 0; i < VIDEO_CAP_S / 30; i++) total += (await watch(viewer.c, postId, 30)).body.counted;
    expect(total).toBe(VIDEO_CAP_S);
    expect((await watch(viewer.c, postId, 30)).body.counted).toBe(0);
  });

  it('caps one viewer at 30 minutes across one creator a day', async () => {
    const creator = await member();
    const viewer = await member();
    const today = dayOf(Date.now());
    for (const s of [600, 600, 590]) {
      const pid = await makePost(creator.c, true);
      await watchRow(today, viewer.id, { id: creator.id, postId: pid }, s);
    }
    const postId = await makePost(creator.c, true);
    expect((await watch(viewer.c, postId, 30)).body.counted).toBe(CREATOR_CAP_S - 1790);
    expect((await watch(viewer.c, postId, 30)).body.counted).toBe(0);
    const other = await member();
    expect((await watch(viewer.c, await makePost(other.c), 30)).body.counted).toBe(30);
  });

  it('never counts your own posts', async () => {
    const creator = await member();
    const postId = await makePost(creator.c);
    expect((await watch(creator.c, postId, 30)).body).toEqual({ counted: 0 });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM fund_watch WHERE post_id = ?').bind(postId).first('n')).toBe(0);
  });

  it('never counts an account younger than 24 hours', async () => {
    const creator = await member();
    const fresh = await member({ aged: false });
    const postId = await makePost(creator.c);
    expect((await watch(fresh.c, postId, 30)).body).toEqual({ counted: 0 });
  });

  it('checks the seconds, the post and the sign-in', async () => {
    const creator = await member();
    const viewer = await member();
    const postId = await makePost(creator.c);
    for (const s of [0, 31, 'x', -5]) {
      const res = await viewer.c.json('POST', '/v1/watch', { postId, seconds: s });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('bad_seconds');
    }
    expect((await watch(viewer.c, 'nope', 10)).status).toBe(404);
    expect((await watch(new Client(env), postId, 10)).status).toBe(401);
  });

  it('a removed post loses its seconds', async () => {
    const creator = await member();
    const viewer = await member();
    const postId = await makePost(creator.c);
    await watch(viewer.c, postId, 30);
    expect((await creator.c.json('DELETE', `/v1/posts/${postId}`)).status).toBe(200);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM fund_watch WHERE post_id = ?').bind(postId).first('n')).toBe(0);
  });
});

describe('split and close', () => {
  it('$10,000 sponsored, 2% of watch time = $100', async () => {
    const you = await rawCreator();
    const rest = await rawCreator();
    const viewer = await rawCreator();
    await sponsor(1_000_000, ['2025-03']);
    await watchRow('2025-03-10', viewer.id, you, 40_000);
    await watchRow('2025-03-11', viewer.id, rest, 1_960_000);
    const res = await close('2025-03');
    expect(res.status).toBe(200);
    const st = res.body.statement;
    expect(st).toMatchObject({ month: '2025-03', status: 'closed', sponsoredCents: 1_000_000, creatorPoolCents: 500_000, emeraCents: 500_000, totalSeconds: 2_000_000, creators: 2, sponsors: 1, carryOutCents: 0, rulesVersion: '1.0.0' });
    expect(st.shares.find((s: any) => s.handle === you.handle)).toEqual({ handle: you.handle, seconds: 40_000, sharePpm: 20_000, amountCents: 10_000 });
  });

  it('rounds each creator down to the cent and carries the rest', async () => {
    const a = await rawCreator();
    const b = await rawCreator();
    const c = await rawCreator();
    const viewer = await rawCreator();
    await sponsor(200, ['2025-05']);
    for (const cr of [a, b, c]) await watchRow('2025-05-02', viewer.id, cr, 100);
    const may = (await close('2025-05')).body.statement;
    expect(may.creatorPoolCents).toBe(100);
    expect(may.shares.map((s: any) => s.amountCents)).toEqual([33, 33, 33]);
    expect(may.carryOutCents).toBe(1);
    const june = await new Client(env).json('GET', '/v1/fund/months/2025-06');
    expect(june.status).toBe(200);
    expect(june.body.statement).toMatchObject({ status: 'open', carryInCents: 1, creatorPoolCents: 1, sha256: null });
  });

  it('a month with no watch time carries the whole pool', async () => {
    await sponsor(1000, ['2025-07']);
    const july = (await close('2025-07')).body.statement;
    expect(july).toMatchObject({ creatorPoolCents: 500, totalSeconds: 0, carryOutCents: 500, shares: [] });
    const aug = (await close('2025-08')).body.statement;
    expect(aug).toMatchObject({ carryInCents: 500, creatorPoolCents: 500, carryOutCents: 500 });
  });

  it('closing twice returns the same statement and anyone can re-check the sha256', async () => {
    const a = await rawCreator();
    const viewer = await rawCreator();
    await sponsor(12_345, ['2025-09']);
    await watchRow('2025-09-20', viewer.id, a, 77);
    const first = (await close('2025-09')).body.statement;
    await db.prepare('INSERT INTO fund_watch (day, viewer_id, post_id, creator_id, seconds) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET seconds = seconds + 1000')
      .bind('2025-09-20', viewer.id, a.postId, a.id, 1).run();
    const second = (await close('2025-09')).body.statement;
    expect(second.sha256).toBe(first.sha256);
    expect(second).toEqual(first);
    expect(await statementHash(first)).toBe(first.sha256);
    expect(first.sha256).toMatch(/^[0-9a-f]{64}$/);
    const open = await close(monthOf(Date.now()));
    expect(open.status).toBe(400);
    expect(open.body.error.code).toBe('month_open');
  });

  it('closes earlier months first so the carry chain is frozen', async () => {
    await sponsor(1000, ['2025-01']);
    const march = (await close('2025-03')).body.statement;
    expect(march.carryInCents).toBe(500);
    const fund = (await new Client(env).json('GET', '/v1/fund')).body;
    expect(fund.history.map((m: any) => m.month)).toEqual(['2025-03', '2025-02', '2025-01']);
  });

  it('a refund before close comes out of its own month', async () => {
    const [keep] = await sponsor(4000, ['2025-10']);
    const [drop] = await sponsor(6000, ['2025-10']);
    const refunded = await admin().json('POST', `/v1/admin/fund/sponsorships/${drop.id}/refund`);
    expect(refunded.body.sponsorship.status).toBe('refunded');
    const oct = (await close('2025-10')).body.statement;
    expect(oct.sponsoredCents).toBe(keep.amountCents);
    expect(oct.refunds).toEqual([]);
  });

  it('a refund after close comes out of the open month and the closed one never changes', async () => {
    const [ship] = await sponsor(8000, ['2025-10']);
    const oct = (await close('2025-10')).body.statement;
    await admin().json('POST', `/v1/admin/fund/sponsorships/${ship.id}/refund`);
    expect((await close('2025-10')).body.statement).toEqual(oct);
    const now = monthOf(Date.now());
    const open = (await new Client(env).json('GET', `/v1/fund/months/${now}`)).body.statement;
    expect(open.refunds.map((r: any) => r.id)).toEqual([ship.id]);
    expect(open.sponsoredCents).toBe(-8000);
    const blocked = await admin().json('POST', '/v1/admin/fund/sponsorships', { sponsorName: 'Late Ink', amountCents: 100, months: ['2025-10'] });
    expect(blocked.status).toBe(409);
  });

  it('splits one payment across months, leftover cent on the first', async () => {
    const ships = await sponsor(1001, ['2025-12', '2025-11'], { status: 'pledged' });
    expect(ships.map((s) => [s.month, s.amountCents, s.status])).toEqual([['2025-11', 501, 'pledged'], ['2025-12', 500, 'pledged']]);
    const nov = (await close('2025-11')).body.statement;
    expect(nov.sponsoredCents).toBe(0);
    expect(nov.sponsorships[0].status).toBe('pledged');
  });

  it('the cron closes last month on the 3rd only', async () => {
    await sponsor(1000, ['2025-02']);
    expect(await runFundCron(env, Date.UTC(2025, 2, 2, 1))).toBeNull();
    expect(await runFundCron(makeEnv({ FUNDING: 'off' }), Date.UTC(2025, 2, 3, 1))).toBeNull();
    const st = await runFundCron(env, Date.UTC(2025, 2, 3, 1));
    expect(st).toMatchObject({ month: '2025-02', status: 'closed', creatorPoolCents: 500 });
  });
});

describe('fund pages', () => {
  it('shows the open month, sponsors biggest first, and the rules', async () => {
    const now = monthOf(Date.now());
    await sponsor(30_000, [now], { sponsorName: 'Low Tide Lens Shop', sponsorUrl: 'https://lowtide.example' });
    await sponsor(50_000, [now], { sponsorName: 'Marrowbend Studio' });
    await sponsor(9_000, [now], { sponsorName: 'Pledged Only', status: 'pledged' });
    const res = await new Client(env).json('GET', '/v1/fund');
    expect(res.status).toBe(200);
    expect(res.body.rules).toEqual({ version: '1.0.0', creatorShare: 0.5, photoCapS: 60, videoCapS: 600, creatorCapS: 1800, minViewerAgeH: 24, heartbeatMaxS: 30, payoutMinCents: 1000, closeDay: 3 });
    expect(res.body.sponsors).toEqual([
      { name: 'Marrowbend Studio', url: null, amountCents: 50_000 },
      { name: 'Low Tide Lens Shop', url: 'https://lowtide.example/', amountCents: 30_000 },
    ]);
    expect(res.body.month).toMatchObject({ month: now, status: 'open', sponsoredCents: 80_000, creatorPoolCents: 40_000, emeraCents: 40_000, sponsors: 2, sha256: null, closedAt: null });
    expect((await new Client(env).json('GET', '/v1/fund/months/2019-01')).status).toBe(404);
    expect((await new Client(env).json('GET', '/v1/fund/months/nope')).status).toBe(404);
  });

  it('shows a creator their earnings, balance and top posts', async () => {
    const creator = await member();
    const viewer = await member();
    const now = monthOf(Date.now());
    const postId = await makePost(creator.c);
    await sponsor(20_000, [now, '2025-04']);
    await watch(viewer.c, postId, 30);
    const other = await rawCreator();
    await watchRow(dayOf(Date.now()), viewer.id, other, 30);
    await watchRow('2025-04-04', viewer.id, { id: creator.id, postId }, 60);
    await close('2025-04');
    const res = await creator.c.json('GET', '/v1/me/earnings');
    expect(res.status).toBe(200);
    expect(res.body.thisMonth).toEqual({ month: now, seconds: 30, totalSeconds: 60, sharePpm: 500_000, estimateCents: 2500 });
    expect(res.body.months).toEqual([{ month: '2025-04', seconds: 60, sharePpm: 1_000_000, amountCents: 5000 }]);
    expect(res.body.balanceCents).toBe(5000);
    expect(res.body.topPosts).toHaveLength(1);
    expect(res.body.topPosts[0].seconds).toBe(30);
    expect(res.body.topPosts[0].post).toMatchObject({ id: postId, media: [expect.objectContaining({ url: expect.any(String) })] });
    expect((await new Client(env).json('GET', '/v1/me/earnings')).status).toBe(401);
  });

  it('never returns a sponsor contact email', async () => {
    const now = monthOf(Date.now());
    const made = await admin().json('POST', '/v1/admin/fund/sponsorships', { sponsorName: 'Saltgrass Type', contactEmail: 'secret@saltgrass.example', amountCents: 5000, months: ['2025-06', now] });
    const refund = await admin().json('POST', `/v1/admin/fund/sponsorships/${made.body.sponsorships[1].id}/refund`);
    const bodies = [
      made.body,
      refund.body,
      (await close('2025-06')).body,
      (await new Client(env).json('GET', '/v1/fund')).body,
      (await new Client(env).json('GET', '/v1/fund/months/2025-06')).body,
      (await new Client(env).json('GET', `/v1/fund/months/${now}`)).body,
    ];
    for (const b of bodies) {
      const text = JSON.stringify(b);
      expect(text).not.toContain('secret@saltgrass.example');
      expect(text).not.toContain('contact');
    }
  });
});

describe('switch and admin key', () => {
  it('every fund route is 404 when FUNDING is off', async () => {
    const off = makeEnv({ FUNDING: 'off' });
    const viewer = new Client(off);
    await viewer.signIn(`off${uniq()}@example.test`);
    const a = new Client(off);
    a.token = 'dev-fund-admin';
    const calls = [
      await viewer.json('POST', '/v1/watch', { postId: 'x', seconds: 10 }),
      await viewer.json('GET', '/v1/me/earnings'),
      await new Client(off).json('GET', '/v1/fund'),
      await new Client(off).json('GET', '/v1/fund/months/2025-01'),
      await a.json('POST', '/v1/admin/fund/sponsorships', { sponsorName: 'X', amountCents: 100, months: ['2025-01'] }),
      await a.json('POST', '/v1/admin/fund/sponsorships/x/refund'),
      await a.json('POST', '/v1/admin/fund/close', { month: '2025-01' }),
    ];
    for (const r of calls) {
      expect(r.status).toBe(404);
      expect(r.body.error.code).toBe('not_found');
    }
  });

  it('a wrong or missing admin key is 404', async () => {
    const wrong = new Client(env);
    wrong.token = 'guess';
    for (const c of [wrong, new Client(env), (await member()).c]) {
      for (const [m, p, b] of [
        ['POST', '/v1/admin/fund/sponsorships', { sponsorName: 'X', amountCents: 100, months: ['2025-01'] }],
        ['POST', '/v1/admin/fund/sponsorships/x/refund', undefined],
        ['POST', '/v1/admin/fund/close', { month: '2025-01' }],
      ] as const) {
        const res = await c.json(m, p, b);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('not_found');
      }
    }
    expect((await admin().json('POST', '/v1/admin/fund/close', { month: '2025-01' })).status).toBe(200);
  });
});
