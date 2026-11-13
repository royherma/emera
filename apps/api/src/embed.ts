import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from './env';
import { BRAND } from './brand';
import { siteOrigin } from './http';
import { esc } from './pages';
import { loadPosts, type PostRow } from './serialize';

const { colors } = BRAND;
const MAX_WIDTH = 550;
const MIN_WIDTH = 240;
const FOOTER = 96;

const postFrom = async (c: Context<AppEnv>, id: string) => {
  const row = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<PostRow>();
  return row ? (await loadPosts(c, [row]))[0] : null;
};

const extraHosts = (domain: string) => [domain, `www.${domain}`, `api.${domain}`, `app.${domain}`];

function postIdFrom(c: Context<AppEnv>, raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const ours = new Set([...extraHosts(BRAND.domain), new URL(c.req.url).host, new URL(siteOrigin(c)).host]);
  if (!ours.has(u.host)) return null;
  return /^\/(?:p|embed)\/([A-Za-z0-9_-]{1,64})\/?$/.exec(u.pathname)?.[1] ?? null;
}

const clamp = (raw: string | undefined, lo: number, hi: number) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(hi, Math.max(lo, Math.round(n))) : hi;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': status === 200 ? 'public, max-age=3600' : 'no-store' },
  });

const err = (status: number, message: string) => json({ error: { code: status === 404 ? 'not_found' : 'bad_request', message } }, status);

export const embedRoutes = new Hono<AppEnv>();

embedRoutes.get('/oembed', async (c) => {
  const raw = c.req.query('url');
  if (!raw) return err(400, 'Send the post link as ?url=.');
  if (c.req.query('format') && c.req.query('format') !== 'json') return json({ error: { code: 'unsupported_format', message: 'Only JSON is available.' } }, 501);
  try { new URL(raw); } catch { return err(400, 'That is not a link.'); }
  const id = postIdFrom(c, raw);
  const post = id ? await postFrom(c, id) : null;
  if (!post) return err(404, 'We could not find that post.');

  const origin = siteOrigin(c);
  const name = post.author.displayName || post.author.handle!;
  const first = post.media[0];
  const ratio = first?.width && first?.height ? Math.min(1.25, Math.max(0.5, first.height / first.width)) : 1;
  const width = clamp(c.req.query('maxwidth'), MIN_WIDTH, MAX_WIDTH);
  const height = clamp(c.req.query('maxheight'), 300, Math.round(width * ratio) + FOOTER);
  const title = `A post by ${name} on ${BRAND.name}`;
  const html = `<iframe src="${esc(`${origin}/embed/${post.id}`)}" width="${width}" height="${height}" style="border:0;max-width:100%" loading="lazy" title="${esc(title)}" allowfullscreen></iframe>`;
  return json({
    version: '1.0',
    type: 'rich',
    provider_name: BRAND.name,
    provider_url: origin,
    title: post.caption ? post.caption.replace(/\s+/g, ' ').slice(0, 100) : title,
    author_name: name,
    author_url: `${origin}/@${post.author.handle}`,
    html,
    width,
    height,
    thumbnail_url: `${post.url}/card.png`,
    thumbnail_width: 1200,
    thumbnail_height: 630,
    cache_age: 3600,
  });
});

const EMBED_CSS = `
*{box-sizing:border-box}
body{margin:0;background:${colors.bg};color:${colors.ink};font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:inherit;text-decoration:none}
.card{display:block}
.media{-webkit-user-drag:none;-webkit-touch-callout:none;user-select:none;display:block;width:100%;height:auto;max-height:70vh;object-fit:contain;background:#140f0b}
.meta{padding:12px 14px}
.who{font-weight:700}
.who span{font-weight:400;opacity:.65;margin-left:6px}
.cap{margin:4px 0 8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.more{font-size:13px;font-weight:600;color:${colors.ink};border-bottom:2px solid ${colors.accent}}
`;

embedRoutes.get('/embed/:id', async (c) => {
  const post = await postFrom(c, c.req.param('id'));
  if (!post) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  const a = post.author;
  const m = post.media[0];
  const media = !m ? '' : m.kind === 'image'
    ? `<img class="media" src="${esc(m.url)}" width="${m.width}" height="${m.height}" draggable="false" alt="${esc(m.alt || `Photo by @${a.handle}`)}">`
    : `<video class="media" src="${esc(m.url)}"${m.posterUrl ? ` poster="${esc(m.posterUrl)}"` : ''} width="${m.width}" height="${m.height}" controls controlslist="nodownload noplaybackrate noremoteplayback" disablepictureinpicture disableremoteplayback playsinline preload="metadata"></video>`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(`A post by ${a.displayName || a.handle} on ${BRAND.name}`)}</title>
<style>${EMBED_CSS}</style><script src="/guard.js" defer></script></head><body>
<div class="card">${media}<div class="meta">
<div class="who">${esc(a.displayName || a.handle)}<span>@${esc(a.handle)}</span></div>
${post.caption ? `<p class="cap">${esc(post.caption)}</p>` : ''}
<a class="more" href="${esc(post.url)}" target="_blank" rel="noopener">View on ${esc(BRAND.name)}</a>
</div></div></body></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Content-Security-Policy': "default-src 'none'; img-src 'self' https: data:; media-src 'self' https:; style-src 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors *",
    },
  });
});
