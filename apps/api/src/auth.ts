import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv, UserRow } from './env';
import { fail, siteOrigin, readJson } from './http';
import { hmacHex, newInviteCode, newSixDigitCode, newToken, newId, sha256Hex } from './crypto';
import { deliveryFor, sendCode } from './mail';
import { userJson } from './serialize';

const CODE_TTL_MS = 10 * 60_000;
const SESSION_TTL_MS = 30 * 86_400_000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;
const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
const RESERVED = new Set(['admin', 'api', 'v1', 'media', 'support', 'help', 'root', 'about', 'invite', 'login', 'signup', 'me']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw fail(401, 'unauthorized', 'Sign in first.');
  const row = await c.env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`,
  ).bind(await sha256Hex(token), Date.now()).first<UserRow>();
  if (!row) throw fail(401, 'unauthorized', 'That sign-in has expired. Sign in again.');
  c.set('user', row);
  await next();
};

export const requireHandle: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user').handle) throw fail(403, 'handle_required', 'Pick a handle first.');
  await next();
};

export async function inviteStatus(env: AppEnv['Bindings'], code: string): Promise<{ valid: boolean; invitedBy: string | null }> {
  if (env.SEED_INVITE_CODE && code === env.SEED_INVITE_CODE.toLowerCase()) return { valid: true, invitedBy: null };
  const row = await env.DB.prepare(
    `SELECT i.uses, i.max_uses, u.handle FROM invites i LEFT JOIN users u ON u.id = i.created_by WHERE i.code = ?`,
  ).bind(code).first<{ uses: number; max_uses: number; handle: string | null }>();
  if (!row) return { valid: false, invitedBy: null };
  return { valid: row.uses < row.max_uses, invitedBy: row.handle };
}

export const auth = new Hono<AppEnv>();

auth.post('/v1/auth/start', async (c) => {
  const body = await readJson(c);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) throw fail(400, 'bad_email', 'Enter a valid email address.');
  if (deliveryFor(c.env) === 'log' && c.env.ENVIRONMENT === 'production') throw fail(503, 'email_not_configured', 'Sign-in email is not set up yet.');

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  let invite: string | null = null;
  if (!existing && c.env.INVITES_REQUIRED === 'true') {
    invite = typeof body.invite === 'string' ? body.invite.trim().toLowerCase() : '';
    if (!invite) throw fail(403, 'invite_required', 'You need an invite to join.');
    const status = await inviteStatus(c.env, invite);
    if (!status.valid) throw fail(403, 'invite_invalid', 'That invite is not valid or was already used.');
  }

  const now = Date.now();
  const recent = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM login_codes WHERE email = ? AND created_at > ?')
    .bind(email, now - 3_600_000).first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_CODES_PER_HOUR) throw fail(429, 'too_many_codes', 'Too many codes requested. Try again in an hour.');

  const code = newSixDigitCode();
  await c.env.DB.prepare('INSERT INTO login_codes (email, code_hash, invite_code, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(email, await hmacHex(c.env.PROOF_SECRET, `code:${email}:${code}`), invite, now + CODE_TTL_MS, now).run();
  await sendCode(c.env, email, code);
  return c.json({ ok: true });
});

auth.post('/v1/auth/verify', async (c) => {
  const body = await readJson(c);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) throw fail(400, 'bad_code', 'Enter the 6-digit code from your email.');

  const now = Date.now();
  const row = await c.env.DB.prepare(
    'SELECT * FROM login_codes WHERE email = ? AND expires_at > ? AND attempts < ? ORDER BY created_at DESC, id DESC LIMIT 1',
  ).bind(email, now, MAX_ATTEMPTS).first<{ id: number; code_hash: string; invite_code: string | null }>();
  if (!row) throw fail(400, 'code_expired', 'That code expired. Ask for a new one.');
  await c.env.DB.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
  if (row.code_hash !== (await hmacHex(c.env.PROOF_SECRET, `code:${email}:${code}`))) {
    throw fail(400, 'wrong_code', 'That code is not right.');
  }
  await c.env.DB.prepare('DELETE FROM login_codes WHERE email = ?').bind(email).run();

  let user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  const isNew = !user;
  if (!user) {
    let invitedBy: string | null = null;
    let usedCode: string | null = null;
    if (c.env.INVITES_REQUIRED === 'true') {
      const inv = row.invite_code ?? '';
      if (inv === c.env.SEED_INVITE_CODE.toLowerCase() && c.env.SEED_INVITE_CODE) {
        invitedBy = null;
      } else {
        const claimed = await c.env.DB.prepare('UPDATE invites SET uses = uses + 1 WHERE code = ? AND uses < max_uses').bind(inv).run();
        if (!claimed.meta.changes) throw fail(403, 'invite_invalid', 'That invite is not valid or was already used.');
        usedCode = inv;
        invitedBy = (await c.env.DB.prepare('SELECT created_by FROM invites WHERE code = ?').bind(inv).first<{ created_by: string | null }>())?.created_by ?? null;
      }
    }
    const id = newId(12);
    await c.env.DB.prepare('INSERT INTO users (id, email, invited_by, invite_code, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, email, invitedBy, usedCode, now).run();
    user = (await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>())!;
  }

  const token = newToken();
  await c.env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), user.id, now, now + SESSION_TTL_MS).run();
  return c.json({ token, user: userJson(user), isNew });
});

auth.post('/v1/auth/handle', requireAuth, async (c) => {
  const me = c.get('user');
  if (me.handle) throw fail(409, 'handle_already_set', 'Your handle is already set.');
  const body = await readJson(c);
  const handle = typeof body.handle === 'string' ? body.handle.trim().toLowerCase().replace(/^@/, '') : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  if (!HANDLE_RE.test(handle)) throw fail(400, 'bad_handle', 'Handles are 3 to 20 letters, numbers or underscores.');
  if (RESERVED.has(handle)) throw fail(409, 'handle_taken', 'That handle is taken.');
  if (displayName.length < 1 || displayName.length > 60) throw fail(400, 'bad_display_name', 'Display name must be 1 to 60 characters.');
  try {
    await c.env.DB.prepare('UPDATE users SET handle = ?, display_name = ? WHERE id = ? AND handle IS NULL').bind(handle, displayName, me.id).run();
  } catch {
    throw fail(409, 'handle_taken', 'That handle is taken.');
  }
  const user = (await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(me.id).first<UserRow>())!;
  return c.json({ user: userJson(user) });
});

auth.get('/v1/me', requireAuth, (c) => c.json({ user: userJson(c.get('user')) }));

auth.post('/v1/auth/logout', requireAuth, async (c) => {
  const token = c.req.header('Authorization')!.slice(7).trim();
  await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return c.json({ ok: true });
});

const MAX_INVITES = 20;
const MAX_USES_LIMIT = 10;

auth.post('/v1/invites', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const body = await readJson(c).catch(() => ({} as Record<string, unknown>));
  const maxUses = body.maxUses === undefined ? 1 : Number(body.maxUses);
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > MAX_USES_LIMIT) throw fail(400, 'bad_max_uses', `An invite can be used 1 to ${MAX_USES_LIMIT} times.`);
  const total = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM invites WHERE created_by = ?').bind(me.id).first<{ n: number }>();
  if ((total?.n ?? 0) >= MAX_INVITES) throw fail(409, 'invite_limit', `You have made ${MAX_INVITES} invites, the most one person can have.`);
  const today = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM invites WHERE created_by = ? AND created_at > ?')
    .bind(me.id, Date.now() - 86_400_000).first<{ n: number }>();
  if ((today?.n ?? 0) >= 10) throw fail(429, 'too_many_invites', 'You can make 10 invites a day.');
  const code = newInviteCode();
  const now = Date.now();
  await c.env.DB.prepare('INSERT INTO invites (code, created_by, max_uses, created_at) VALUES (?, ?, ?, ?)').bind(code, me.id, maxUses, now).run();
  return c.json({ code, url: `${siteOrigin(c)}/invite/${code}` });
});

auth.get('/v1/invites', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const rows = (await c.env.DB.prepare('SELECT code, uses, max_uses, created_at FROM invites WHERE created_by = ? ORDER BY created_at DESC, code DESC')
    .bind(me.id).all<{ code: string; uses: number; max_uses: number; created_at: number }>()).results;
  const joined = (await c.env.DB.prepare(
    `SELECT u.invite_code, u.handle, u.display_name FROM users u JOIN invites i ON i.code = u.invite_code
     WHERE i.created_by = ? AND u.handle IS NOT NULL ORDER BY u.created_at ASC`,
  ).bind(me.id).all<{ invite_code: string; handle: string; display_name: string }>()).results;
  const origin = siteOrigin(c);
  return c.json({
    invites: rows.map((r) => ({
      code: r.code,
      url: `${origin}/invite/${r.code}`,
      uses: r.uses,
      maxUses: r.max_uses,
      createdAt: new Date(r.created_at).toISOString(),
      joined: joined.filter((j) => j.invite_code === r.code).map((j) => ({ handle: j.handle, displayName: j.display_name })),
    })),
    limit: MAX_INVITES,
  });
});

auth.get('/v1/invites/:code', async (c) => {
  const code = c.req.param('code').toLowerCase();
  const status = await inviteStatus(c.env, code);
  return c.json(status);
});
