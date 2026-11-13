import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv, UserRow } from './env';
import { BRAND } from './brand';
import { siteOrigin } from './http';
import { inviteStatus } from './auth';
import { pagePosts } from './posts';
import { loadPosts, type PostRow } from './serialize';

type Post = Awaited<ReturnType<typeof loadPosts>>[number];
type Media = Post['media'][number];

const { colors } = BRAND;

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

const trim = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const day = (isoDate: string) => new Date(isoDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
type Still = { url: string; width: number; height: number };
const still = (m: Media | undefined): Still | undefined => {
  if (!m) return undefined;
  const url = m.kind === 'image' ? m.url : m.posterUrl;
  return url ? { url, width: m.width, height: m.height } : undefined;
};
const cover = (media: Media[]) => still(media.find((m) => m.kind === 'image')) ?? media.map(still).find(Boolean);
const fitted = (m: Media) => {
  const r = m.width && m.height ? m.width / m.height : 0.8;
  return `aspect-ratio:${m.width || 4}/${m.height || 5};width:min(100%,calc((100svh - 150px) * ${r.toFixed(4)}))`;
};

const CSS = `
:root{--bg:${colors.bg};--ink:${colors.ink};--accent:${colors.accent};--accent2:${colors.accent2};--line:color-mix(in srgb,var(--ink) 14%,transparent);--soft:color-mix(in srgb,var(--ink) 62%,var(--bg))}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:inherit}
.serif{font-family:ui-serif,"Iowan Old Style","Palatino Linotype",Georgia,serif}
header.top{display:flex;align-items:center;justify-content:space-between;max-width:935px;margin:0 auto;padding:18px 16px}
.brand{font-size:24px;font-weight:700;letter-spacing:-.02em;text-decoration:none}
.brand i{display:inline-block;width:.42em;height:.42em;border-radius:50%;background:var(--accent);margin-left:.12em}
.pill{display:inline-block;padding:8px 16px;border-radius:999px;background:var(--ink);color:var(--bg);text-decoration:none;font-size:14px;font-weight:600}
main{max-width:935px;margin:0 auto;padding:0 16px 48px}
.profile{display:flex;gap:28px;align-items:center;padding:16px 0 28px}
.avatar{flex:none;width:96px;height:96px;border-radius:50%;background:var(--accent);color:var(--bg);display:grid;place-items:center;font-size:42px;font-weight:700;overflow:hidden}
.avatar.sm{width:40px;height:40px;font-size:18px}
.avatar img{width:100%;height:100%;object-fit:cover}
h1{margin:0;font-size:28px;line-height:1.15;letter-spacing:-.02em}
.handle{color:var(--soft);margin:2px 0 8px}
.bio{margin:0 0 8px;white-space:pre-wrap}
.count{color:var(--soft);font-size:14px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;border-top:1px solid var(--line);padding-top:20px}
.tile{position:relative;display:block;aspect-ratio:1;background:color-mix(in srgb,var(--ink) 8%,var(--bg));overflow:hidden}
.tile img{width:100%;height:100%;object-fit:cover;display:block}
.tile .badge{position:absolute;top:8px;right:8px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;padding:2px 8px;border-radius:999px}
.tile .play{position:absolute;inset:0;display:grid;place-items:center;font-size:34px;color:var(--bg);background:var(--ink)}
.empty{color:var(--soft);text-align:center;padding:48px 0}
.post{max-width:720px;margin:0 auto}
.post .media{-webkit-user-drag:none;-webkit-touch-callout:none;user-select:none;display:block;height:auto;max-width:100%;margin:0 auto 12px;border-radius:12px;background:#140f0b;object-fit:contain}
.author{display:flex;gap:12px;align-items:center;text-decoration:none;margin:20px 0 12px}
.author b{display:block;line-height:1.2}
.author span{color:var(--soft);font-size:14px}
.caption{white-space:pre-wrap;font-size:18px;margin:0 0 8px}
.date{color:var(--soft);font-size:14px;margin:0 0 24px}
.proof{border:1px solid var(--line);border-left:4px solid var(--accent2);border-radius:10px;padding:14px 16px;font-size:14px;background:color-mix(in srgb,var(--accent2) 6%,var(--bg))}
.proof strong{color:var(--accent2)}
.proof code{font:12px ui-monospace,Menlo,monospace;word-break:break-all;color:var(--soft)}
.hero{padding:40px 0 32px;max-width:640px}
.hero h1{font-size:clamp(34px,7vw,56px);line-height:1.05}
.hero p{font-size:19px;color:var(--soft);margin:14px 0 0}
footer{max-width:935px;margin:0 auto;padding:24px 16px 40px;color:var(--soft);font-size:14px;border-top:1px solid var(--line)}
@media(min-width:720px){.grid{gap:12px}.avatar{width:140px;height:140px;font-size:60px}.profile{gap:48px}h1{font-size:34px}}
@media(max-width:520px){.profile{gap:16px}.avatar{width:72px;height:72px;font-size:30px}h1{font-size:22px}}
`;

type Meta = { title: string; description: string; url: string; image?: Still; video?: Media; type?: string; extraHead?: string };

function layout(meta: Meta, body: string, status = 200) {
  const img = meta.image;
  const full = `${meta.title}`;
  const head = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<title>${esc(full)}</title>`,
    `<meta name="description" content="${esc(meta.description)}">`,
    `<meta name="theme-color" content="${colors.bg}">`,
    `<link rel="canonical" href="${esc(meta.url)}">`,
    `<meta property="og:site_name" content="${esc(BRAND.name)}">`,
    `<meta property="og:type" content="${meta.type ?? 'website'}">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    `<meta property="og:description" content="${esc(meta.description)}">`,
    `<meta property="og:url" content="${esc(meta.url)}">`,
    img ? `<meta property="og:image" content="${esc(img.url)}">` : '',
    img ? `<meta property="og:image:width" content="${img.width}"><meta property="og:image:height" content="${img.height}">` : '',
    meta.video ? `<meta property="og:video" content="${esc(meta.video.url)}"><meta property="og:video:type" content="${esc(meta.video.contentType)}"><meta property="og:video:width" content="${meta.video.width}"><meta property="og:video:height" content="${meta.video.height}">` : '',
    `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${esc(meta.title)}">`,
    `<meta name="twitter:description" content="${esc(meta.description)}">`,
    img ? `<meta name="twitter:image" content="${esc(img.url)}">` : '',
    `<style>${CSS}</style>`,
    '<script src="/guard.js" defer></script>',
  ].filter(Boolean).join('\n');
  const html = `<!doctype html>
<html lang="en"><head>
${head}
</head><body>
<header class="top"><a class="brand serif" href="/">${esc(BRAND.name)}<i></i></a><a class="pill" href="/">Join ${esc(BRAND.name)}</a></header>
<main>${body}</main>
<footer><span class="serif">${esc(BRAND.name)}</span> - ${esc(BRAND.tagline)}</footer>
</body></html>`;
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': status === 200 ? 'public, max-age=60' : 'no-store',
      'Content-Security-Policy': "default-src 'none'; img-src 'self' https: data:; media-src 'self' https:; style-src 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'none'",
    },
  });
}

const initial = (name: string) => esc((name.trim()[0] ?? '?').toUpperCase());

function tile(p: Post) {
  const m = p.media[0];
  const label = esc(trim(p.caption || `Post by @${p.author.handle}`, 80));
  const pic = still(m);
  const inner = pic
    ? `<img src="${esc(pic.url)}" width="${pic.width}" height="${pic.height}" alt="${m.alt ? esc(trim(m.alt, 120)) : label}" loading="lazy">${m.kind === 'video' ? '<span class="badge">▶</span>' : ''}`
    : `<span class="play">▶</span>`;
  const badge = p.media.length > 1 ? `<span class="badge">${p.media.length}</span>` : '';
  return `<a class="tile" href="/p/${esc(p.id)}">${inner}${badge}</a>`;
}

export function notFoundPage(message = 'We could not find that page.') {
  return layout(
    { title: `Not found - ${BRAND.name}`, description: message, url: '' },
    `<div class="hero"><h1 class="serif">Nothing here</h1><p>${esc(message)}</p></div>`,
    404,
  );
}

export const pages = new Hono<AppEnv>();

const GUARD = `for (const t of ['contextmenu', 'dragstart']) document.addEventListener(t, (e) => { if (e.target.closest && e.target.closest('.media')) e.preventDefault(); });`;

pages.get('/guard.js', () => new Response(GUARD, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } }));

pages.get('/', async (c) => {
  const { posts } = await pagePosts(c, { limit: 12 });
  const body = `<section class="hero"><h1 class="serif">${esc(BRAND.tagline)}</h1><p>A home for photographers, filmmakers, artists and designers. Every upload carries proof of who made it.</p></section>` +
    (posts.length ? `<div class="grid">${posts.map(tile).join('')}</div>` : '');
  return layout({ title: `${BRAND.name} - ${BRAND.tagline}`, description: BRAND.tagline, url: siteOrigin(c) + '/', image: cover(posts.flatMap((p) => p.media)) }, body);
});

pages.get('/invite/:code', async (c) => {
  const code = c.req.param('code').toLowerCase();
  const status = await inviteStatus(c.env, code);
  if (!status.valid) return notFoundPage('That invite is not valid or was already used.');
  const by = status.invitedBy ? `@${status.invitedBy} invited you to ${BRAND.name}` : `You are invited to ${BRAND.name}`;
  return layout(
    { title: `${by}`, description: BRAND.tagline, url: `${siteOrigin(c)}/invite/${code}` },
    `<section class="hero"><h1 class="serif">${esc(by)}</h1><p>Open the ${esc(BRAND.name)} app and enter this invite code:</p><p class="serif" style="font-size:32px;color:var(--ink);letter-spacing:.08em">${esc(code)}</p></section>`,
  );
});

pages.get('/:seg{@[A-Za-z0-9_]+}', async (c) => {
  const handle = c.req.param('seg').slice(1).toLowerCase();
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE handle = ?').bind(handle).first<UserRow>();
  if (!user) return notFoundPage('We could not find that creator.');
  const rows = (await c.env.DB.prepare('SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 60').bind(user.id).all<PostRow>()).results;
  const posts = await loadPosts(c, rows);
  const total = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM posts WHERE user_id = ?').bind(user.id).first<{ n: number }>())?.n ?? 0;
  const origin = siteOrigin(c);
  const avatar = user.avatar_url ? `<img src="${esc(user.avatar_url)}" alt="">` : initial(user.display_name || handle);
  const body = `<section class="profile"><div class="avatar serif">${avatar}</div><div>
<h1 class="serif">${esc(user.display_name || handle)}</h1><p class="handle">@${esc(handle)}</p>
${user.bio ? `<p class="bio">${esc(user.bio)}</p>` : ''}<p class="count">${total} ${total === 1 ? 'post' : 'posts'}</p></div></section>` +
    (posts.length ? `<div class="grid">${posts.map(tile).join('')}</div>` : `<p class="empty">Nothing shared yet.</p>`);
  return layout({
    title: `${user.display_name || handle} (@${handle}) on ${BRAND.name}`,
    description: user.bio ? trim(user.bio, 200) : `${total} ${total === 1 ? 'post' : 'posts'} by @${handle} on ${BRAND.name}. ${BRAND.tagline}`,
    url: `${origin}/@${handle}`,
    image: cover(posts.flatMap((p) => p.media)),
    type: 'profile',
  }, body);
});

pages.get('/p/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(c.req.param('id')).first<PostRow>();
  if (!row) return notFoundPage('We could not find that post.');
  const [post] = await loadPosts(c, [row]);
  const a = post.author;
  const name = a.displayName || a.handle!;
  const first = post.media[0];
  const mediaHtml = post.media.map((m) => m.kind === 'image'
    ? `<img class="media" src="${esc(m.url)}" width="${m.width}" height="${m.height}" style="${fitted(m)}" draggable="false" alt="${esc(m.alt || trim(post.caption || `Photo by @${a.handle}`, 120))}">`
    : `<video class="media" src="${esc(m.url)}"${m.posterUrl ? ` poster="${esc(m.posterUrl)}"` : ''} width="${m.width}" height="${m.height}" style="${fitted(m)}"${m.alt ? ` aria-label="${esc(m.alt)}"` : ''} controls controlslist="nodownload noplaybackrate noremoteplayback" disablepictureinpicture disableremoteplayback playsinline preload="metadata"></video>`).join('');
  const proof = first?.proof;
  const proofHtml = proof?.sha256
    ? `<div class="proof"><strong>Proof of origin.</strong> Uploaded by @${esc(proof.signer)} on ${esc(day(proof.signedAt!))}, signed by ${esc(BRAND.name)}.<br><code>sha256 ${esc(proof.sha256)}</code></div>`
    : '';
  const body = `<article class="post">${mediaHtml}
<a class="author" href="/@${esc(a.handle)}"><span class="avatar sm serif">${a.avatarUrl ? `<img src="${esc(a.avatarUrl)}" alt="">` : initial(name)}</span><div><b>${esc(name)}</b><span>@${esc(a.handle)}</span></div></a>
${post.caption ? `<p class="caption">${esc(post.caption)}</p>` : ''}<p class="date">${esc(day(post.createdAt))}</p>${proofHtml}</article>`;
  const snippet = post.caption ? trim(post.caption.replace(/\s+/g, ' '), 90) : '';
  return layout({
    title: snippet ? `${snippet} - ${name} on ${BRAND.name}` : `A post by ${name} on ${BRAND.name}`,
    description: post.caption ? trim(post.caption.replace(/\s+/g, ' '), 200) : `Shared by @${a.handle} on ${BRAND.name}. ${BRAND.tagline}`,
    url: post.url,
    image: cover(post.media),
    video: post.media.find((m) => m.kind === 'video'),
    type: 'article',
  }, body);
});
