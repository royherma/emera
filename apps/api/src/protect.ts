import { Hono } from 'hono';
import type { AppEnv, Env } from './env';
import { fail, readJson } from './http';
import { requireAuth } from './auth';
import { stripeCall } from './stripe';

export const PLANS = { creator: 'protect_creator_monthly', pro: 'protect_pro_monthly' } as const;
type Plan = keyof typeof PLANS;
const LIVE_STATUS = new Set(['active', 'trialing', 'past_due']);
const checkedAccounts = new Map<string, string>();

async function assertEmeraAccount(env: Env) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_ACCOUNT_ID || !env.PROTECT_RETURN_URL) {
    throw fail(503, 'payments_off', 'Protect plans open soon.');
  }
  let id = checkedAccounts.get(env.STRIPE_SECRET_KEY);
  if (!id) {
    id = (await stripeCall<{ id: string }>(env, 'GET', '/account')).id;
    checkedAccounts.set(env.STRIPE_SECRET_KEY, id);
  }
  if (id !== env.STRIPE_ACCOUNT_ID) {
    console.error('stripe key belongs to', id, 'not', env.STRIPE_ACCOUNT_ID);
    throw fail(503, 'payments_off', 'Protect plans open soon.');
  }
}

async function priceId(env: Env, plan: Plan) {
  const res = await stripeCall<{ data: { id: string }[] }>(env, 'GET', `/prices?lookup_keys[]=${PLANS[plan]}&active=true`);
  if (!res.data[0]) {
    console.error('no stripe price for lookup key', PLANS[plan]);
    throw fail(503, 'payments_off', 'Protect plans open soon.');
  }
  return res.data[0].id;
}

async function customerFor(env: Env, user: { id: string; email: string; stripe_customer_id?: string | null }) {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const made = await stripeCall<{ id: string }>(env, 'POST', '/customers', {
    email: user.email, 'metadata[project]': 'emera', 'metadata[user_id]': user.id,
  });
  await env.DB.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ? AND stripe_customer_id IS NULL').bind(made.id, user.id).run();
  const row = await env.DB.prepare('SELECT stripe_customer_id AS id FROM users WHERE id = ?').bind(user.id).first<{ id: string }>();
  return row?.id ?? made.id;
}

export const protectRoutes = new Hono<AppEnv>();

protectRoutes.post('/v1/protect/checkout', requireAuth, async (c) => {
  const body = await readJson(c);
  if (body.plan !== 'creator' && body.plan !== 'pro') throw fail(400, 'bad_plan', 'Pick the creator or pro plan.');
  const plan: Plan = body.plan;
  const env = c.env;
  await assertEmeraAccount(env);
  const me = c.get('user');
  const customer = await customerFor(env, me);
  const price = await priceId(env, plan);
  const page = env.PROTECT_RETURN_URL!;
  const session = await stripeCall<{ id: string; url: string }>(env, 'POST', '/checkout/sessions', {
    mode: 'subscription',
    customer,
    'managed_payments[enabled]': 'false',
    allow_promotion_codes: 'true',
    payment_method_collection: 'if_required',
    'line_items[0][price]': price,
    'line_items[0][quantity]': 1,
    'metadata[project]': 'emera',
    'metadata[user_id]': me.id,
    'metadata[plan]': plan,
    'subscription_data[metadata][project]': 'emera',
    'subscription_data[metadata][user_id]': me.id,
    'subscription_data[metadata][plan]': plan,
    success_url: `${page}?subscribed={CHECKOUT_SESSION_ID}`,
    cancel_url: page,
  });
  return c.json({ url: session.url }, 201);
});

protectRoutes.post('/v1/protect/start', async (c) => {
  const body = await readJson(c);
  if (body.plan !== 'creator' && body.plan !== 'pro') throw fail(400, 'bad_plan', 'Pick the creator or pro plan.');
  const plan: Plan = body.plan;
  const env = c.env;
  await assertEmeraAccount(env);
  const page = env.PROTECT_RETURN_URL!;
  const code = typeof body.code === 'string' ? body.code.trim().slice(0, 64) : '';
  const promo = code
    ? (await stripeCall<{ data: { id: string }[] }>(env, 'GET', `/promotion_codes?code=${encodeURIComponent(code)}&active=true&limit=1`)).data[0]?.id
    : undefined;
  const session = await stripeCall<{ id: string; url: string }>(env, 'POST', '/checkout/sessions', {
    mode: 'subscription',
    'managed_payments[enabled]': 'false',
    ...(promo ? { 'discounts[0][promotion_code]': promo } : { allow_promotion_codes: 'true' }),
    payment_method_collection: 'if_required',
    'line_items[0][price]': await priceId(env, plan),
    'line_items[0][quantity]': 1,
    'metadata[project]': 'emera',
    'metadata[plan]': plan,
    'subscription_data[metadata][project]': 'emera',
    'subscription_data[metadata][plan]': plan,
    success_url: `${page}?subscribed={CHECKOUT_SESSION_ID}`,
    cancel_url: page,
  });
  return c.json({ url: session.url }, 201);
});

protectRoutes.get('/v1/protect/me', requireAuth, async (c) => {
  const row = await c.env.DB.prepare('SELECT plan, plan_until FROM users WHERE id = ?').bind(c.get('user').id).first<{ plan: string; plan_until: number | null }>();
  const until = row?.plan_until ?? null;
  const live = row && row.plan !== 'free' && (until === null || until > Date.now());
  return c.json({ plan: live ? row.plan : 'free', planUntil: live && until ? new Date(until).toISOString() : null });
});

protectRoutes.post('/v1/protect/portal', requireAuth, async (c) => {
  const env = c.env;
  await assertEmeraAccount(env);
  const row = await env.DB.prepare('SELECT stripe_customer_id AS id FROM users WHERE id = ?').bind(c.get('user').id).first<{ id: string | null }>();
  if (!row?.id) throw fail(404, 'no_subscription', 'You have no Protect subscription yet.');
  const session = await stripeCall<{ url: string }>(env, 'POST', '/billing_portal/sessions', {
    customer: row.id, return_url: env.PROTECT_RETURN_URL,
  });
  return c.json({ url: session.url });
});

type Sub = {
  id: string; status: string; customer?: string; current_period_end?: number;
  metadata?: Record<string, string>;
  items?: { data?: { current_period_end?: number; price?: { lookup_key?: string | null } }[] };
};

const planOf = (s: Sub): Plan | null => {
  const m = s.metadata?.plan;
  if (m === 'creator' || m === 'pro') return m;
  const key = s.items?.data?.[0]?.price?.lookup_key;
  return (Object.keys(PLANS) as Plan[]).find((p) => PLANS[p] === key) ?? null;
};

async function userIdFor(env: Env, metaUser: string | undefined, subId: string | undefined, customer: string | undefined) {
  if (metaUser) return metaUser;
  const row = await env.DB.prepare('SELECT id FROM users WHERE stripe_subscription_id = ? OR stripe_customer_id = ? LIMIT 1')
    .bind(subId ?? '', customer ?? '').first<{ id: string }>();
  return row?.id ?? null;
}

async function setPlan(env: Env, userId: string, plan: string, until: number | null, customer: string | undefined, subId: string | null) {
  const res = await env.DB.prepare(
    `UPDATE users SET plan = ?, plan_until = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), stripe_subscription_id = ? WHERE id = ?`,
  ).bind(plan, until, customer ?? null, subId, userId).run();
  return res.meta.changes ? 'plan_set' : 'ignored';
}

async function onSubscription(env: Env, sub: Sub, deleted: boolean) {
  if (sub.metadata?.project !== 'emera') return 'ignored';
  const userId = await userIdFor(env, sub.metadata.user_id, sub.id, sub.customer);
  if (!userId) return 'ignored';
  const current = await env.DB.prepare('SELECT stripe_subscription_id AS sid FROM users WHERE id = ?').bind(userId).first<{ sid: string | null }>();
  if (current?.sid && current.sid !== sub.id) return 'ignored';
  const end = (sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end ?? 0) * 1000 || null;
  const plan = planOf(sub);
  if (deleted || !LIVE_STATUS.has(sub.status) || !plan) return setPlan(env, userId, 'free', null, sub.customer, null);
  return setPlan(env, userId, plan, end, sub.customer, sub.id);
}

type CheckoutSession = {
  id: string; payment_status?: string; customer?: string; subscription?: string; metadata?: Record<string, string>;
  customer_details?: { email?: string | null } | null; customer_email?: string | null;
};

async function onCheckout(env: Env, s: CheckoutSession) {
  if (s.metadata?.project !== 'emera') return 'ignored';
  const plan = s.metadata.plan;
  if ((plan !== 'creator' && plan !== 'pro') || !s.subscription || s.payment_status === 'unpaid') return 'ignored';
  let userId: string | undefined = s.metadata.user_id;
  const email = (s.customer_details?.email ?? s.customer_email ?? '').trim().toLowerCase();
  if (!userId && email) userId = (await env.DB.prepare('SELECT id FROM users WHERE lower(email) = ?').bind(email).first<{ id: string }>())?.id;
  const sub = await stripeCall<Sub>(env, 'GET', `/subscriptions/${s.subscription}`);
  if (!userId) {
    if (!email) return 'ignored';
    const end = (sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end ?? 0) * 1000 || null;
    await env.DB.prepare('INSERT OR REPLACE INTO protect_pending (email, plan, plan_until, stripe_customer_id, stripe_subscription_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(email, plan, end, sub.customer ?? s.customer ?? null, sub.id, Date.now()).run();
    return 'pending';
  }
  return onSubscription(env, { ...sub, metadata: { ...sub.metadata, project: 'emera', user_id: userId, plan } }, false);
}

type Invoice = {
  subscription?: string | null; customer?: string; lines?: { data?: { period?: { end?: number } }[] };
  parent?: { subscription_details?: { subscription?: string; metadata?: Record<string, string> } } | null;
  subscription_details?: { metadata?: Record<string, string> } | null;
};

async function onInvoicePaid(env: Env, inv: Invoice) {
  const meta = inv.parent?.subscription_details?.metadata ?? inv.subscription_details?.metadata;
  if (meta?.project !== 'emera') return 'ignored';
  const subId = inv.parent?.subscription_details?.subscription ?? inv.subscription ?? undefined;
  const userId = await userIdFor(env, meta.user_id, subId, inv.customer);
  const plan = meta.plan;
  const end = inv.lines?.data?.map((l) => l.period?.end ?? 0).sort((a, b) => b - a)[0];
  if (!userId || !subId || !end || (plan !== 'creator' && plan !== 'pro')) return 'ignored';
  return setPlan(env, userId, plan, end * 1000, inv.customer, subId);
}

export async function handleProtectEvent(env: Env, event: { type: string; data: { object: any } }): Promise<string> {
  const o = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed':
      return o.mode === 'subscription' ? onCheckout(env, o) : 'not_protect';
    case 'customer.subscription.updated':
      return onSubscription(env, o, false);
    case 'customer.subscription.deleted':
      return onSubscription(env, o, true);
    case 'invoice.paid':
      return onInvoicePaid(env, o);
    default:
      return 'not_protect';
  }
}
