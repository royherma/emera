import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client, makeEnv } from './helpers';
import { stripeSignature } from '../src/stripe';

const SECRET = 'whsec_protect';
const env = makeEnv({
  STRIPE_SECRET_KEY: 'sk_test_protect_ok', STRIPE_ACCOUNT_ID: 'acct_emera', PROTECT_RETURN_URL: 'https://site.test/protect/', STRIPE_WEBHOOK_SECRET: SECRET,
});
const db = env.DB;
let seq = 0;
let calls: { url: string; method: string; body: URLSearchParams }[] = [];

function fakeStripe(accountId = 'acct_emera') {
  calls = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, method: init?.method ?? 'GET', body: new URLSearchParams(String(init?.body ?? '')) });
    if (url.endsWith('/v1/account')) return Response.json({ id: accountId });
    if (url.includes('/v1/prices')) return Response.json({ data: [{ id: url.includes('pro') ? 'price_pro' : 'price_creator' }] });
    if (url.endsWith('/v1/customers')) return Response.json({ id: 'cus_1' });
    if (url.endsWith('/v1/checkout/sessions')) return Response.json({ id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' });
    if (url.endsWith('/v1/billing_portal/sessions')) return Response.json({ url: 'https://billing.stripe.com/p/session/x' });
    if (url.includes('/v1/subscriptions/')) return Response.json({ id: 'sub_1', status: 'active', customer: 'cus_1', items: { data: [{ current_period_end: 1_900_000_000 }] } });
    return new Response('{}', { status: 404 });
  });
}

async function member() {
  const c = new Client(env);
  const tag = `${Date.now().toString(36)}${seq++}`;
  await c.signIn(`p${tag}@example.test`);
  const me = await c.withHandle(`p${tag}`.slice(0, 20), 'P');
  return { c, id: me.body.user.id as string };
}

async function hook(event: unknown) {
  const payload = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const res = await new Client(env).call('POST', '/v1/stripe/webhook', undefined, payload, {
    'Stripe-Signature': `t=${t},v1=${await stripeSignature(SECRET, payload, t)}`, 'Content-Type': 'application/json',
  });
  return (await res.json()) as any;
}

const row = (id: string) => db.prepare('SELECT plan, plan_until, stripe_customer_id, stripe_subscription_id FROM users WHERE id = ?').bind(id).first<any>();

afterEach(() => vi.restoreAllMocks());

describe('protect checkout', () => {
  it('needs sign-in and a valid plan', async () => {
    fakeStripe();
    expect((await new Client(env).json('POST', '/v1/protect/checkout', { plan: 'pro' })).status).toBe(401);
    const { c } = await member();
    expect((await c.json('POST', '/v1/protect/checkout', { plan: 'gold' })).status).toBe(400);
  });

  it('opens a subscription checkout with project metadata and lookup-key price', async () => {
    fakeStripe();
    const { c, id } = await member();
    const res = await c.json('POST', '/v1/protect/checkout', { plan: 'pro' });
    expect(res.status).toBe(201);
    expect(res.body.url).toContain('checkout.stripe.com');
    expect(calls.some((x) => x.url.includes('lookup_keys[]=protect_pro_monthly'))).toBe(true);
    const b = calls.find((x) => x.url.endsWith('/v1/checkout/sessions'))!.body;
    expect(b.get('mode')).toBe('subscription');
    expect(b.get('customer')).toBe('cus_1');
    expect(b.get('allow_promotion_codes')).toBe('true');
    expect(b.get('line_items[0][price]')).toBe('price_pro');
    expect(b.get('metadata[project]')).toBe('emera');
    expect(b.get('metadata[user_id]')).toBe(id);
    expect(b.get('subscription_data[metadata][project]')).toBe('emera');
    expect(b.get('subscription_data[metadata][plan]')).toBe('pro');
    expect((await row(id)).stripe_customer_id).toBe('cus_1');
  });

  it('refuses a key from another Stripe account', async () => {
    fakeStripe('acct_other');
    const { c } = await member();
    c.env = makeEnv({ ...env, STRIPE_SECRET_KEY: 'sk_test_other_account' });
    expect((await c.json('POST', '/v1/protect/checkout', { plan: 'creator' })).status).toBe(503);
    expect(calls.some((x) => x.url.endsWith('/v1/checkout/sessions'))).toBe(false);
  });

  it('is off without Stripe config', async () => {
    const { c } = await member();
    c.env = makeEnv({ STRIPE_SECRET_KEY: undefined, STRIPE_ACCOUNT_ID: undefined });
    expect((await c.json('POST', '/v1/protect/checkout', { plan: 'pro' })).status).toBe(503);
  });
});

describe('protect me and portal', () => {
  it('defaults to free', async () => {
    const { c } = await member();
    expect((await c.json('GET', '/v1/protect/me')).body).toEqual({ plan: 'free', planUntil: null });
  });

  it('opens the billing portal only for customers', async () => {
    fakeStripe();
    const { c, id } = await member();
    expect((await c.json('POST', '/v1/protect/portal')).status).toBe(404);
    await db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').bind('cus_9', id).run();
    const res = await c.json('POST', '/v1/protect/portal');
    expect(res.body.url).toContain('billing.stripe.com');
    expect(calls.find((x) => x.url.endsWith('/billing_portal/sessions'))!.body.get('customer')).toBe('cus_9');
  });
});

describe('protect webhook', () => {
  const meta = (id: string, plan = 'creator') => ({ project: 'emera', user_id: id, plan });

  it('sets the plan on a completed subscription checkout', async () => {
    fakeStripe();
    const { c, id } = await member();
    const out = await hook({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', mode: 'subscription', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1', metadata: meta(id, 'pro') } } });
    expect(out.result).toBe('plan_set');
    expect(await row(id)).toMatchObject({ plan: 'pro', plan_until: 1_900_000_000_000, stripe_subscription_id: 'sub_1' });
    expect((await c.json('GET', '/v1/protect/me')).body).toEqual({ plan: 'pro', planUntil: new Date(1_900_000_000_000).toISOString() });
  });

  it('guest checkout: pays first, plan lands on the account made later with the same email', async () => {
    fakeStripe();
    const res = await new Client(env).json('POST', '/v1/protect/start', { plan: 'creator' });
    expect(res.status).toBe(201);
    const sent = calls.find((x) => x.url.endsWith('/v1/checkout/sessions'))!.body;
    expect(sent.get('allow_promotion_codes')).toBe('true');
    expect(sent.get('customer')).toBeNull();
    const email = `guest${Date.now().toString(36)}@example.test`;
    const out = await hook({ type: 'checkout.session.completed', data: { object: { id: 'cs_g', mode: 'subscription', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1', customer_details: { email }, metadata: { project: 'emera', plan: 'creator' } } } });
    expect(out.result).toBe('pending');
    const c = new Client(env);
    await c.signIn(email);
    expect((await c.json('GET', '/v1/protect/me')).body.plan).toBe('creator');
  });

  it('guest checkout with an existing account email sets the plan right away', async () => {
    fakeStripe();
    const { id } = await member();
    const email = (await db.prepare('SELECT email FROM users WHERE id = ?').bind(id).first<{ email: string }>())!.email;
    const out = await hook({ type: 'checkout.session.completed', data: { object: { id: 'cs_e', mode: 'subscription', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1', customer_details: { email: email.toUpperCase() }, metadata: { project: 'emera', plan: 'pro' } } } });
    expect(out.result).toBe('plan_set');
    expect((await row(id)).plan).toBe('pro');
  });

  it('ignores events without project=emera', async () => {
    fakeStripe();
    const { id } = await member();
    const out = await hook({ type: 'checkout.session.completed', data: { object: { id: 'cs_x', mode: 'subscription', payment_status: 'paid', subscription: 'sub_1', metadata: { user_id: id, plan: 'pro' } } } });
    expect(out.result).toBe('ignored');
    const sub = await hook({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'active', metadata: { user_id: id, plan: 'pro' } } } });
    expect(sub.result).toBe('ignored');
    expect((await row(id)).plan).toBe('free');
  });

  it('follows subscription updates and deletion', async () => {
    const { id } = await member();
    const sub = (plan: string, status = 'active') => ({ id: 'sub_2', status, customer: 'cus_2', metadata: meta(id, plan), items: { data: [{ current_period_end: 1_900_000_000 }] } });
    await hook({ type: 'customer.subscription.updated', data: { object: sub('creator') } });
    expect(await row(id)).toMatchObject({ plan: 'creator', stripe_subscription_id: 'sub_2' });
    await hook({ type: 'customer.subscription.updated', data: { object: sub('pro') } });
    expect((await row(id)).plan).toBe('pro');
    await hook({ type: 'customer.subscription.deleted', data: { object: sub('pro', 'canceled') } });
    expect(await row(id)).toMatchObject({ plan: 'free', plan_until: null, stripe_subscription_id: null });
  });

  it('extends plan_until on invoice.paid', async () => {
    const { id } = await member();
    await db.prepare(`UPDATE users SET plan = 'creator', plan_until = 1, stripe_subscription_id = 'sub_3' WHERE id = ?`).bind(id).run();
    const out = await hook({ type: 'invoice.paid', data: { object: { customer: 'cus_3', lines: { data: [{ period: { end: 1_950_000_000 } }] }, parent: { subscription_details: { subscription: 'sub_3', metadata: meta(id) } } } } });
    expect(out.result).toBe('plan_set');
    expect((await row(id)).plan_until).toBe(1_950_000_000_000);
  });

  it('ignores a stale subscription id', async () => {
    const { id } = await member();
    await db.prepare(`UPDATE users SET plan = 'pro', stripe_subscription_id = 'sub_new' WHERE id = ?`).bind(id).run();
    const out = await hook({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_old', status: 'canceled', metadata: meta(id) } } });
    expect(out.result).toBe('ignored');
    expect((await row(id)).plan).toBe('pro');
  });

  it('still hands non-subscription checkouts to the sponsor flow', async () => {
    const out = await hook({ type: 'checkout.session.completed', data: { object: { id: 'cs_pay', mode: 'payment', payment_status: 'paid', amount_total: 0, payment_intent: null, metadata: { project: 'emera' } } } });
    expect(out.result).toBe('ignored');
    expect(out.received).toBe(true);
  });
});
