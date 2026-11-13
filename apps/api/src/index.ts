import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv } from './env';
import { ApiError } from './http';
import { auth } from './auth';
import { mediaRoutes } from './media';
import { postRoutes } from './posts';
import { reportRoutes } from './reports';
import { pages, notFoundPage } from './pages';

const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  const placeholder = (v: string) => !v || v === 'REPLACE_WITH_SECRET';
  if (c.env.ENVIRONMENT !== 'dev' && c.env.ENVIRONMENT !== 'test' && placeholder(c.env.PROOF_SECRET)) {
    return c.json({ error: { code: 'misconfigured', message: 'Server secrets are not set.' } }, 500);
  }
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
});
app.use('/v1/*', cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type'], allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], maxAge: 600 }));
app.use('/media/*', cors({ origin: '*', allowMethods: ['GET', 'HEAD', 'OPTIONS'] }));

app.get('/health', (c) => c.json({ ok: true }));
app.route('/', auth);
app.route('/', mediaRoutes);
app.route('/', postRoutes);
app.route('/', reportRoutes);
app.route('/', pages);

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: { code: err.code, message: err.message } }, err.status as 400);
  console.error('[error]', err);
  return c.json({ error: { code: 'internal', message: 'Something went wrong on our side.' } }, 500);
});

app.notFound((c) => {
  const p = new URL(c.req.url).pathname;
  if (p.startsWith('/v1/') || p.startsWith('/media/')) return c.json({ error: { code: 'not_found', message: 'No such endpoint.' } }, 404);
  return notFoundPage();
});

export default app;
