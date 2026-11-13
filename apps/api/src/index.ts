import { Hono } from 'hono';
import * as Sentry from '@sentry/cloudflare';
import { cors } from 'hono/cors';
import type { AppEnv, Env } from './env';
import { ApiError } from './http';
import { auth } from './auth';
import { mediaRoutes, runVideoJob, type VideoJob } from './media';
import { postRoutes } from './posts';
import { reportRoutes } from './reports';
import { social } from './social';
import { engageRoutes } from './engage';
import { notificationRoutes } from './notifications';
import { searchRoutes } from './search';
import { profileRoutes } from './profile';
import { flagRoutes } from './flags';
import { pages, notFoundPage } from './pages';
import { cardRoutes } from './card';
import { embedRoutes } from './embed';
import { feedRoutes } from './feeds';

const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  const placeholder = (v: string) => !v || v === 'REPLACE_WITH_SECRET';
  if (c.env.ENVIRONMENT !== 'dev' && c.env.ENVIRONMENT !== 'test' && placeholder(c.env.PROOF_SECRET)) {
    return c.json({ error: { code: 'misconfigured', message: 'Server secrets are not set.' } }, 500);
  }
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
});
app.use('/v1/*', cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type', 'X-TG-Tester'], allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], maxAge: 600 }));
app.use('/media/*', cors({ origin: '*', allowMethods: ['GET', 'HEAD', 'OPTIONS'] }));

app.get('/health', (c) => c.json({ ok: true }));
app.route('/', auth);
app.route('/', mediaRoutes);
app.route('/', postRoutes);
app.route('/', reportRoutes);
app.route('/', social);
app.route('/', engageRoutes);
app.route('/', notificationRoutes);
app.route('/', searchRoutes);
app.route('/', profileRoutes);
app.route('/', flagRoutes);
app.route('/', cardRoutes);
app.route('/', embedRoutes);
app.route('/', feedRoutes);
app.route('/', pages);

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: { code: err.code, message: err.message } }, err.status as 400);
  console.error('[error]', err);
  Sentry.captureException(err);
  return c.json({ error: { code: 'internal', message: 'Something went wrong on our side.' } }, 500);
});

app.notFound((c) => {
  const p = new URL(c.req.url).pathname;
  if (p.startsWith('/v1/') || p.startsWith('/media/')) return c.json({ error: { code: 'not_found', message: 'No such endpoint.' } }, 404);
  return notFoundPage();
});

export default Sentry.withSentry(
  (env: Env) => ({ dsn: env.SENTRY_DSN, environment: env.ENVIRONMENT, tracesSampleRate: 0.1 }),
  {
    fetch: app.fetch,
    async queue(batch: MessageBatch<VideoJob>, env: Env) {
      for (const msg of batch.messages) {
        try {
          console.log('video job', msg.body.mediaId, await runVideoJob(env, msg.body));
          msg.ack();
        } catch (e) {
          console.error('video job failed', msg.body.mediaId, e);
          msg.retry();
        }
      }
    },
  } satisfies ExportedHandler<Env, VideoJob>,
);
