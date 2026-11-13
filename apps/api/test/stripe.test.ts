import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, makeEnv } from './helpers';
import { monthOf } from '../src/fund';
import { monthsFrom, stripeSignature } from '../src/stripe';

const SECRET = 'whsec_test_secret';
const stripeEnv = (over = {}) => makeEnv({
  STRIPE_SECRET_KEY: 'sk_test_good', STRIPE_ACCOUNT_ID: 'acct_emera', STRIPE_SPONSOR_PRODUCT: 'prod_sponsor',
  FUND_PAGE_URL: 'https://site.test/fund/', STRIPE_WEBHOOK_SECRET: SECRET, FUND_ADMIN_KEY: 'admin-key', ...over,
});
const env = stripeEnv();
const db = env.DB;
let sent: { url: string; body: URLSearchParams }[] = [];

function fakeStripe(accountId = 'acct_emera') {
  sent = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith('/v1/account')) return Response.json({ id: accountId });
    if (url.endsWith('/v1/checkout/sessions')) {
      sent.push({ url, body: new URLSearchParams(String(init?.body)) });
      return Response.json({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    }
    return new Response('{}', { status: 404 });
  });
}

async function signed(event: unknown, secret = SECRET, at = Math.floor(Date.now() / 1000)) {
  const payload = JSON.stringify(event);
  const sig = await stripeSignature(secret, payload, at);
  return new Client(env).call('POST', '/v1/stripe/webhook', undefined, payload, { 'Stripe-Signature': `t=${at},v1=${sig}`, 'Content-Type': 'application/json' });
}

const paidSession = (id: string, months: string[], over: Record<string, unknown> = {}) => ({
  type: 'checkout.session.completed',
  data: { object: {
    id, payment_status: 'paid', amount_total: 2500 * months.length, payment_intent: `pi_${id}`,
    customer_details: { email: 'Hello@Quillfern.test' },
    metadata: { project: 'emera', sponsor_name: `Quillfern ${id}`, sponsor_url: 'https://quillfern.test/', line: 'Paper for people who draw', months: months.join(',') },
    ...over,
  } },
});

const admin = () => {
  const c = new Client(env);
  c.token = 'admin-key';
  return c;
};

beforeEach(async () => {
  await db.batch(['fund_shares', 'fund_months', 'fund_watch', 'sponsorships', 'sponsors'].map((t) => db.prepare(`DELETE FROM ${t}`)));
});
afterEach(() => vi.restoreAllMocks());

describe('sponsor checkout', () => {
  it('opens a Stripe checkout for the Emera account with the months in metadata', async () => {
    fakeStripe();
    const res = await new Client(env).json('POST', '/v1/fund/checkout', {
      sponsorName: 'Quillfern', contactEmail: 'hi@quillfern.test', sponsorUrl: 'quillfern.test', line: 'Paper for people who draw', monthlyCents: 2500, months: 3,
    });
    expect(res.status).toBe(201);
    expect(res.body.url).toContain('checkout.stripe.com');
    const b = sent[0].body;
    expect(b.get('line_items[0][price_data][unit_amount]')).toBe('2500');
    expect(b.get('line_items[0][quantity]')).toBe('3');
    expect(b.get('line_items[0][price_data][product]')).toBe('prod_sponsor');
    expect(b.get('metadata[project]')).toBe('emera');
    expect(b.get('metadata[months]')).toBe(monthsFrom(monthOf(Date.now()), 3).join(','));
    expect(b.get('metadata[sponsor_url]')).toBe('https://quillfern.test/');
    expect(b.get('success_url')).toBe('https://site.test/fund/?paid={CHECKOUT_SESSION_ID}#sponsor');
  });

  it('refuses when the key belongs to another Stripe account', async () => {
    fakeStripe('acct_robotjobs');
    const res = await new Client(stripeEnv({ STRIPE_SECRET_KEY: 'sk_test_other' })).json('POST', '/v1/fund/checkout', {
      sponsorName: 'Quillfern', contactEmail: 'hi@quillfern.test', monthlyCents: 2500,
    });
    expect(res.status).toBe(503);
    expect(sent).toHaveLength(0);
  });

  it('refuses amounts under the minimum and bad emails', async () => {
    fakeStripe();
    const c = new Client(env);
    expect((await c.json('POST', '/v1/fund/checkout', { sponsorName: 'Q', contactEmail: 'hi@q.test', monthlyCents: 500 })).body.error.code).toBe('bad_amount');
    expect((await c.json('POST', '/v1/fund/checkout', { sponsorName: 'Q', contactEmail: 'nope', monthlyCents: 2500 })).body.error.code).toBe('bad_email');
    expect((await c.json('POST', '/v1/fund/checkout', { sponsorName: 'Q', contactEmail: 'hi@q.test', monthlyCents: 2500, months: 13 })).body.error.code).toBe('bad_months');
  });

  it('is off without Stripe config', async () => {
    const res = await new Client(makeEnv({ STRIPE_SECRET_KEY: undefined, STRIPE_ACCOUNT_ID: undefined })).json('POST', '/v1/fund/checkout', { sponsorName: 'Q', contactEmail: 'hi@q.test', monthlyCents: 2500 });
    expect(res.status).toBe(503);
  });
});

describe('stripe webhook', () => {
  it('rejects a bad signature and a stale one', async () => {
    expect((await signed(paidSession('cs_a', ['2026-11']), 'whsec_wrong')).status).toBe(400);
    expect((await signed(paidSession('cs_a', ['2026-11']), SECRET, Math.floor(Date.now() / 1000) - 3600)).status).toBe(400);
    expect((await db.prepare('SELECT COUNT(*) AS n FROM sponsorships').first<{ n: number }>())!.n).toBe(0);
  });

  it('books a paid session once, split over its months, banner pending', async () => {
    const months = monthsFrom(monthOf(Date.now()), 2);
    const first = await signed(paidSession('cs_b', months));
    expect(await first.json()).toMatchObject({ result: 'booked' });
    expect(await (await signed(paidSession('cs_b', months))).json()).toMatchObject({ result: 'duplicate' });
    const rows = (await db.prepare('SELECT month, amount_cents, status FROM sponsorships WHERE stripe_session = ? ORDER BY month').bind('cs_b').all()).results;
    expect(rows).toEqual([{ month: months[0], amount_cents: 2500, status: 'paid' }, { month: months[1], amount_cents: 2500, status: 'paid' }]);
    const sponsor = await db.prepare('SELECT contact_email, line, banner FROM sponsors').first();
    expect(sponsor).toEqual({ contact_email: 'hello@quillfern.test', line: 'Paper for people who draw', banner: 'pending' });
    const status = await new Client(env).json('GET', '/v1/fund/checkout/cs_b');
    expect(status.body).toMatchObject({ paid: true, amountCents: 5000, months: 2, banner: 'pending' });
  });

  it('ignores sessions from other projects and unpaid sessions', async () => {
    const m = [monthOf(Date.now())];
    expect(await (await signed(paidSession('cs_c', m, { metadata: { project: 'robotjobs', months: m[0], sponsor_name: 'X' } }))).json()).toMatchObject({ result: 'ignored' });
    expect(await (await signed(paidSession('cs_d', m, { payment_status: 'unpaid' }))).json()).toMatchObject({ result: 'ignored' });
  });

  it('a full refund marks every month refunded', async () => {
    const months = monthsFrom(monthOf(Date.now()), 2);
    await signed(paidSession('cs_e', months));
    const res = await signed({ type: 'charge.refunded', data: { object: { payment_intent: 'pi_cs_e', amount: 5000, amount_refunded: 5000 } } });
    expect(await res.json()).toMatchObject({ result: 'refunded' });
    const left = await db.prepare(`SELECT COUNT(*) AS n FROM sponsorships WHERE stripe_session = 'cs_e' AND status != 'refunded'`).first<{ n: number }>();
    expect(left!.n).toBe(0);
  });
});

describe('sponsor banners', () => {
  it('show only after approval, and feed cards wait for enough posts', async () => {
    await signed(paidSession('cs_f', [monthOf(Date.now())]));
    let fund = await new Client(env).json('GET', '/v1/fund');
    expect(fund.body.banners).toEqual([]);
    expect(fund.body.feedCards).toMatchObject({ on: false, needed: 1000 });

    const list = await admin().json('GET', '/v1/admin/fund/sponsors');
    const id = list.body.sponsors[0].id;
    expect((await admin().json('POST', `/v1/admin/fund/sponsors/${id}/banner`, { banner: 'approved' })).status).toBe(200);
    fund = await new Client(env).json('GET', '/v1/fund');
    expect(fund.body.banners).toEqual([{ name: 'Quillfern cs_f', url: 'https://quillfern.test/', line: 'Paper for people who draw' }]);
  });

  it('approving needs the admin key', async () => {
    expect((await new Client(env).json('GET', '/v1/admin/fund/sponsors')).status).toBe(404);
  });
});
