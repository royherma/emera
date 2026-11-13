import { Hono } from 'hono';
import type { AppEnv, Env } from './env';
import { fail, readJson } from './http';
import { EMAIL_RE, bookSponsorship, cleanUrl, fundAdmin, fundOn, monthOf, refundSponsorship, shiftMonth } from './fund';
import { MAX_CHECKOUT_MONTHS, MIN_MONTHLY_CENTS } from './fundRules';

const STRIPE = 'https://api.stripe.com/v1';
const SIG_TOLERANCE_S = 300;
const LINE_MAX = 80;

function form(params: Record<string, string | number | undefined>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, String(v));
  return body;
}

async function stripeCall<T>(env: Env, method: 'GET' | 'POST', path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const res = await fetch(`${STRIPE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params ? form(params) : undefined,
  });
  const data = await res.json() as T & { error?: { message?: string } };
  if (!res.ok) {
    console.error('stripe error', path, res.status, data.error?.message);
    throw fail(502, 'stripe_error', 'Payments are not answering right now. Try again in a moment.');
  }
  return data;
}

const checkedAccounts = new Map<string, string>();

async function assertEmeraAccount(env: Env) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_ACCOUNT_ID || !env.STRIPE_SPONSOR_PRODUCT || !env.FUND_PAGE_URL) {
    throw fail(503, 'payments_off', 'Sponsoring opens soon.');
  }
  let id = checkedAccounts.get(env.STRIPE_SECRET_KEY);
  if (!id) {
    id = (await stripeCall<{ id: string }>(env, 'GET', '/account')).id;
    checkedAccounts.set(env.STRIPE_SECRET_KEY, id);
  }
  if (id !== env.STRIPE_ACCOUNT_ID) {
    console.error('stripe key belongs to', id, 'not', env.STRIPE_ACCOUNT_ID);
    throw fail(503, 'payments_off', 'Sponsoring opens soon.');
  }
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

function sameText(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function stripeSignature(secret: string, payload: string, t: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)));
}

async function verified(secret: string, header: string, payload: string, now = Date.now()) {
  const parts = header.split(',').map((p) => p.split('=') as [string, string]);
  const t = Number(parts.find(([k]) => k === 't')?.[1]);
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isFinite(t) || !sigs.length || Math.abs(now / 1000 - t) > SIG_TOLERANCE_S) return false;
  const want = await stripeSignature(secret, payload, t);
  return sigs.some((s) => sameText(s, want));
}

export const monthsFrom = (start: string, count: number) => Array.from({ length: count }, (_, i) => shiftMonth(start, i));

type Session = {
  id: string; url?: string; payment_status: string; amount_total: number; payment_intent: string | null;
  customer_details?: { email?: string | null } | null; metadata?: Record<string, string>;
};

export const stripeRoutes = new Hono<AppEnv>();

stripeRoutes.post('/v1/fund/checkout', fundOn, async (c) => {
  const body = await readJson(c);
  const name = typeof body.sponsorName === 'string' ? body.sponsorName.trim() : '';
  if (name.length < 1 || name.length > 80) throw fail(400, 'bad_sponsor_name', 'Add your company or your name.');
  const email = typeof body.contactEmail === 'string' ? body.contactEmail.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) throw fail(400, 'bad_email', 'That email does not look right.');
  const url = cleanUrl(body.sponsorUrl);
  const line = typeof body.line === 'string' && body.line.trim() ? body.line.trim().replace(/\s+/g, ' ') : null;
  if (line && line.length > LINE_MAX) throw fail(400, 'bad_line', `Keep your line under ${LINE_MAX} characters.`);
  const monthly = body.monthlyCents;
  if (typeof monthly !== 'number' || !Number.isSafeInteger(monthly) || monthly < MIN_MONTHLY_CENTS || monthly > 10_000_000) {
    throw fail(400, 'bad_amount', `Pick at least $${MIN_MONTHLY_CENTS / 100} a month.`);
  }
  const count = body.months === undefined ? 1 : body.months;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 1 || count > MAX_CHECKOUT_MONTHS) {
    throw fail(400, 'bad_months', `Pick 1 to ${MAX_CHECKOUT_MONTHS} months.`);
  }
  const env = c.env;
  await assertEmeraAccount(env);
  const months = monthsFrom(monthOf(Date.now()), count);
  const page = env.FUND_PAGE_URL!;
  const session = await stripeCall<Session>(env, 'POST', '/checkout/sessions', {
    mode: 'payment',
    customer_email: email,
    'line_items[0][quantity]': count,
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': monthly,
    'line_items[0][price_data][product]': env.STRIPE_SPONSOR_PRODUCT,
    'metadata[project]': 'emera',
    'metadata[sponsor_name]': name,
    'metadata[sponsor_url]': url ?? '',
    'metadata[line]': line ?? '',
    'metadata[months]': months.join(','),
    'payment_intent_data[metadata][project]': 'emera',
    'payment_intent_data[description]': `Emera sponsorship, ${months.length === 1 ? months[0] : `${months[0]} to ${months[months.length - 1]}`}`,
    success_url: `${page}?paid={CHECKOUT_SESSION_ID}#sponsor`,
    cancel_url: `${page}#sponsor`,
  });
  return c.json({ url: session.url }, 201);
});

stripeRoutes.get('/v1/fund/checkout/:id', fundOn, async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    `SELECT p.name, p.banner, SUM(s.amount_cents) AS cents, COUNT(*) AS months FROM sponsorships s JOIN sponsors p ON p.id = s.sponsor_id
     WHERE s.stripe_session = ? GROUP BY p.id`,
  ).bind(id).first<{ name: string; banner: string; cents: number; months: number }>();
  if (!row) return c.json({ paid: false });
  return c.json({ paid: true, sponsorName: row.name, amountCents: row.cents, months: row.months, banner: row.banner });
});

async function onPaid(env: Env, s: Session) {
  if (s.metadata?.project !== 'emera' || s.payment_status !== 'paid') return 'ignored';
  const db = env.DB;
  const seen = await db.prepare('SELECT 1 FROM sponsorships WHERE stripe_session = ? LIMIT 1').bind(s.id).first();
  if (seen) return 'duplicate';
  const months = (s.metadata.months ?? '').split(',').filter(Boolean);
  const name = (s.metadata.sponsor_name ?? '').slice(0, 80);
  if (!months.length || !name) {
    console.error('paid session without months or name', s.id);
    return 'ignored';
  }
  await bookSponsorship(db, {
    name,
    url: s.metadata.sponsor_url || null,
    email: s.customer_details?.email?.toLowerCase() ?? null,
    line: s.metadata.line || null,
    amountCents: s.amount_total,
    months,
    status: 'paid',
    stripeSession: s.id,
    paymentIntent: s.payment_intent,
  });
  return 'booked';
}

async function onRefund(env: Env, charge: { payment_intent: string | null; amount_refunded: number; amount: number }) {
  if (!charge.payment_intent || charge.amount_refunded < charge.amount) return 'ignored';
  const rows = (await env.DB.prepare(`SELECT id FROM sponsorships WHERE stripe_payment_intent = ? AND status != 'refunded'`)
    .bind(charge.payment_intent).all<{ id: string }>()).results;
  for (const r of rows) await refundSponsorship(env.DB, r.id);
  return rows.length ? 'refunded' : 'ignored';
}

stripeRoutes.post('/v1/stripe/webhook', async (c) => {
  const secret = c.env.STRIPE_WEBHOOK_SECRET;
  const payload = await c.req.text();
  if (!secret || !(await verified(secret, c.req.header('Stripe-Signature') ?? '', payload))) {
    throw fail(400, 'bad_signature', 'Signature check failed.');
  }
  const event = JSON.parse(payload) as { type: string; data: { object: any } };
  let result = 'ignored';
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    result = await onPaid(c.env, event.data.object);
  } else if (event.type === 'charge.refunded') {
    result = await onRefund(c.env, event.data.object);
  }
  return c.json({ received: true, result });
});

stripeRoutes.get('/v1/admin/fund/sponsors', fundOn, fundAdmin, async (c) => {
  const rows = (await c.env.DB.prepare(
    `SELECT p.id, p.name, p.url, p.line, p.banner, p.contact_email AS email,
       COALESCE(SUM(CASE WHEN s.status = 'paid' THEN s.amount_cents END), 0) AS paid_cents
     FROM sponsors p LEFT JOIN sponsorships s ON s.sponsor_id = p.id GROUP BY p.id ORDER BY p.created_at DESC LIMIT 200`,
  ).all()).results;
  return c.json({ sponsors: rows });
});

stripeRoutes.post('/v1/admin/fund/sponsors/:id/banner', fundOn, fundAdmin, async (c) => {
  const body = await readJson(c);
  if (body.banner !== 'approved' && body.banner !== 'rejected' && body.banner !== 'pending') {
    throw fail(400, 'bad_banner', 'Banner must be approved, rejected or pending.');
  }
  const res = await c.env.DB.prepare('UPDATE sponsors SET banner = ? WHERE id = ?').bind(body.banner, c.req.param('id')).run();
  if (!res.meta.changes) throw fail(404, 'not_found', 'No such sponsor.');
  return c.json({ id: c.req.param('id'), banner: body.banner });
});
