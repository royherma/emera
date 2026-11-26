import { Hono } from 'hono';
import type { AppEnv } from './env';
import { BRAND } from './brand';

const { colors } = BRAND;

export const badgeRoutes = new Hono<AppEnv>();

badgeRoutes.get('/badge/:seg{@[A-Za-z0-9_]+\\.svg}', async (c) => {
  const handle = c.req.param('seg').slice(1, -4).toLowerCase();
  const user = await c.env.DB.prepare('SELECT handle FROM users WHERE handle = ?').bind(handle).first<{ handle: string }>();
  if (!user) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="168" height="32" viewBox="0 0 168 32" role="img" aria-label="Protected by ${BRAND.name}"><title>Protected by ${BRAND.name}</title><rect width="168" height="32" rx="16" fill="${colors.ink}"/><circle cx="16" cy="16" r="6" fill="${colors.accent}"/><text x="30" y="21" fill="${colors.bg}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif" font-size="13" font-weight="600">Protected by ${BRAND.name}</text></svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
});
