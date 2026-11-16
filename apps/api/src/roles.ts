import type { Env, UserRow } from './env';

export const adminIds = (env: Env) => (env.ADMIN_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
export const isAdmin = (env: Env, u: Pick<UserRow, 'id' | 'role'>) => u.role === 'admin' || adminIds(env).includes(u.id);
