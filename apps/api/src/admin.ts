import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv, UserRow } from './env';
import { requireAuth } from './auth';
import { fail, readJson } from './http';
import { userJson } from './serialize';
import { isAdmin } from './roles';

const SETTABLE = { member: null, mod: 'mod', creator: 'creator' } as const;
type Settable = keyof typeof SETTABLE;

const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!isAdmin(c.env, c.get('user'))) throw fail(403, 'not_admin', 'Only admins can change roles.');
  await next();
};

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.get('/v1/admin/users', requireAuth, requireAdmin, async (c) => {
  const q = (c.req.query('q') ?? '').trim().toLowerCase().replace(/^@/, '');
  const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  const rows = (await c.env.DB.prepare(
    `SELECT * FROM users WHERE handle IS NOT NULL AND (?1 = '' OR handle LIKE ?2 ESCAPE '\\' OR LOWER(display_name) LIKE ?2 ESCAPE '\\')
     ORDER BY CASE WHEN role IS NULL THEN 1 ELSE 0 END, handle LIMIT 50`,
  ).bind(q, like).all<UserRow>()).results;
  return c.json({ users: rows.map((u) => ({ ...userJson(u), admin: isAdmin(c.env, u) })) });
});

adminRoutes.put('/v1/admin/users/:handle/role', requireAuth, requireAdmin, async (c) => {
  const want = (await readJson(c)).role;
  if (typeof want !== 'string' || !(want in SETTABLE)) throw fail(400, 'bad_role', 'Role must be member, mod or creator.');
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE handle = ?').bind(c.req.param('handle').toLowerCase()).first<UserRow>();
  if (!user) throw fail(404, 'not_found', 'No such user.');
  if (user.role === 'admin') throw fail(409, 'admin_locked', 'Admins keep their role.');
  const role = SETTABLE[want as Settable];
  await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, user.id).run();
  return c.json({ user: { ...userJson({ ...user, role }), admin: isAdmin(c.env, user) } });
});
