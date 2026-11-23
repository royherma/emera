import { Hono } from 'hono';
import type { AppEnv, Env } from './env';
import { requireAuth } from './auth';
import { fail, originOf, siteOrigin } from './http';
import { hmacHex } from './crypto';
import { net } from './connectors/types';
import { IG_GRAPH, IG_LOCKED_WHY, igEnabled } from './connectors/instagram';
import { BRAND } from './brand';

const STATE_TTL_MS = 15 * 60_000;
const SCOPES = 'instagram_business_basic';

export const stubMode = (env: Env) => !env.INSTAGRAM_APP_ID && (env.ENVIRONMENT === 'dev' || env.ENVIRONMENT === 'test');

async function signState(env: Env, userId: string) {
  const exp = Date.now() + STATE_TTL_MS;
  return `${userId}.${exp}.${await hmacHex(env.PROOF_SECRET, `ig:${userId}.${exp}`)}`;
}

async function readState(env: Env, state: string): Promise<string> {
  const [userId, exp, sig] = state.split('.');
  if (!userId || !exp || Number(exp) < Date.now() || sig !== (await hmacHex(env.PROOF_SECRET, `ig:${userId}.${exp}`))) throw fail(400, 'bad_state', 'That sign-in link expired. Start again from Emera.');
  return userId;
}

export async function instagramStatus(env: Env, origin: string, userId: string) {
  const row = await env.DB.prepare('SELECT username, expires_at FROM instagram_links WHERE user_id = ?').bind(userId).first<{ username: string; expires_at: number }>();
  const connected = !!row && row.expires_at > Date.now();
  return { connected, username: connected ? row!.username : null, connectUrl: `${origin}/instagram/start?state=${encodeURIComponent(await signState(env, userId))}` };
}

async function exchange(env: Env, code: string, redirect: string) {
  if (stubMode(env)) {
    if (!env.INSTAGRAM_STUB_TOKEN) throw fail(503, 'instagram_not_configured', 'Instagram sign-in is not set up here.');
    return env.INSTAGRAM_STUB_TOKEN;
  }
  if (!env.INSTAGRAM_APP_ID || !env.INSTAGRAM_APP_SECRET) throw fail(503, 'instagram_not_configured', 'Instagram sign-in is not set up yet.');
  const form = new URLSearchParams({ client_id: env.INSTAGRAM_APP_ID, client_secret: env.INSTAGRAM_APP_SECRET, grant_type: 'authorization_code', redirect_uri: redirect, code });
  const short: any = await (await net('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form })).json();
  if (!short?.access_token) throw fail(502, 'instagram_failed', short?.error_message ?? 'Instagram did not sign you in. Try again.');
  const long: any = await (await net(`${IG_GRAPH.replace(/\/v[\d.]+$/, '')}/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(env.INSTAGRAM_APP_SECRET)}&access_token=${encodeURIComponent(short.access_token)}`)).json();
  return long?.access_token ?? short.access_token;
}

const page = (title: string, body: string, back: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{background:${BRAND.colors.bg};color:${BRAND.colors.ink};font:16px/1.4 -apple-system,system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;margin:0;padding:16px}main{max-width:380px;background:#fff;border-radius:20px;padding:28px}h1{font-size:22px;margin:0 0 8px}p{color:#5c4d40;margin:0 0 18px}a{display:block;text-align:center;background:${BRAND.colors.ink};color:#fff;text-decoration:none;font-weight:600;padding:13px;border-radius:12px}</style></head>
<body><main><h1>${title}</h1><p>${body}</p><a href="${back}">Back to ${BRAND.name}</a></main></body></html>`;

export const instagramRoutes = new Hono<AppEnv>();

instagramRoutes.get('/v1/instagram', requireAuth, async (c) => igEnabled(c.env) ? c.json(await instagramStatus(c.env, originOf(c), c.get('user').id)) : c.json({ connected: false, username: null, connectUrl: null, locked: IG_LOCKED_WHY }));

instagramRoutes.delete('/v1/instagram', requireAuth, async (c) => {
  await c.env.DB.prepare('DELETE FROM instagram_links WHERE user_id = ?').bind(c.get('user').id).run();
  return c.json({ ok: true });
});

instagramRoutes.get('/instagram/start', async (c) => {
  const state = c.req.query('state') ?? '';
  await readState(c.env, state);
  const redirect = `${originOf(c)}/instagram/callback`;
  if (stubMode(c.env)) return c.redirect(`${redirect}?code=stub&state=${encodeURIComponent(state)}`);
  if (!c.env.INSTAGRAM_APP_ID) throw fail(503, 'instagram_not_configured', 'Instagram sign-in is not set up yet.');
  const q = new URLSearchParams({ client_id: c.env.INSTAGRAM_APP_ID, redirect_uri: redirect, response_type: 'code', scope: SCOPES, state });
  return c.redirect(`https://www.instagram.com/oauth/authorize?${q}`);
});

instagramRoutes.get('/instagram/callback', async (c) => {
  const back = `${siteOrigin(c)}/connect`;
  const userId = await readState(c.env, c.req.query('state') ?? '');
  const code = c.req.query('code');
  if (!code) return c.html(page('Instagram was not connected', 'You can try again any time from Bring your posts.', back), 400);
  const token = await exchange(c.env, code, `${originOf(c)}/instagram/callback`);
  const me: any = await (await net(`${IG_GRAPH}/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`)).json();
  if (!me?.username) throw fail(502, 'instagram_failed', me?.error?.message ?? 'Instagram did not say who you are. Try again.');
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO instagram_links (user_id, ig_user_id, username, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET ig_user_id = excluded.ig_user_id, username = excluded.username, token = excluded.token, expires_at = excluded.expires_at`,
  ).bind(userId, String(me.user_id ?? me.id ?? ''), me.username, token, now + 59 * 86_400_000, now).run();
  return c.html(page(`Instagram connected as @${me.username}`, `Go back to ${BRAND.name} to pick which reels come over. ${BRAND.name} only reads from Instagram and never posts there.`, back));
});
