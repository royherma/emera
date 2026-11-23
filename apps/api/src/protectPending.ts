import type { Env } from './env';

export async function claimPendingPlan(env: Env, userId: string, email: string) {
  const p = await env.DB.prepare('DELETE FROM protect_pending WHERE email = ? RETURNING *').bind(email.toLowerCase())
    .first<{ plan: string; plan_until: number | null; stripe_customer_id: string | null; stripe_subscription_id: string }>();
  if (!p) return;
  await env.DB.prepare('UPDATE users SET plan = ?, plan_until = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), stripe_subscription_id = ? WHERE id = ?')
    .bind(p.plan, p.plan_until, p.stripe_customer_id, p.stripe_subscription_id, userId).run();
}
