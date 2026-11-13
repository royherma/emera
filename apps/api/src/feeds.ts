import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv, UserRow } from './env';
import { BRAND } from './brand';
import { siteOrigin } from './http';
import { pagePosts } from './posts';

type Post = Awaited<ReturnType<typeof pagePosts>>['posts'][number];

const LIMIT = 50;

const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
const x = (s: unknown) => clean(String(s ?? '')).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]!);

function entry(p: Post) {
  const name = p.author.displayName || p.author.handle!;
  const snippet = p.caption ? p.caption.replace(/\s+/g, ' ').slice(0, 90) : '';
  const still = p.media.find((m) => m.kind === 'image')?.url ?? p.media.find((m) => m.posterUrl)?.posterUrl;
  const body = `${still ? `<p><img src="${x(still)}" alt=""></p>` : ''}${p.caption ? `<p>${x(p.caption)}</p>` : ''}`;
  return `<entry>
<id>${x(p.url)}</id>
<title>${x(snippet || `A post by ${name}`)}</title>
<link rel="alternate" type="text/html" href="${x(p.url)}"/>
${p.media.map((m) => `<link rel="enclosure" type="${x(m.contentType)}" href="${x(m.url)}"/>`).join('\n')}
<published>${x(p.createdAt)}</published>
<updated>${x(p.createdAt)}</updated>
<author><name>${x(name)}</name><uri>${x(`${new URL(p.url).origin}/@${p.author.handle}`)}</uri></author>
<content type="html">${x(body)}</content>
</entry>`;
}

function atom(o: { id: string; title: string; subtitle: string; self: string; alternate: string; posts: Post[] }) {
  const updated = o.posts[0]?.createdAt ?? new Date(0).toISOString();
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<id>${x(o.id)}</id>
<title>${x(o.title)}</title>
<subtitle>${x(o.subtitle)}</subtitle>
<updated>${x(updated)}</updated>
<link rel="self" type="application/atom+xml" href="${x(o.self)}"/>
<link rel="alternate" type="text/html" href="${x(o.alternate)}"/>
<generator>${x(BRAND.name)}</generator>
${o.posts.map(entry).join('\n')}
</feed>
`;
}

const respond = (xml: string) =>
  new Response(xml, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });

export const feedRoutes = new Hono<AppEnv>();

feedRoutes.get('/feed.xml', async (c: Context<AppEnv>) => {
  const origin = siteOrigin(c);
  const { posts } = await pagePosts(c, { limit: LIMIT });
  return respond(atom({ id: `${origin}/feed.xml`, title: `${BRAND.name}: newest posts`, subtitle: BRAND.tagline, self: `${origin}/feed.xml`, alternate: `${origin}/`, posts }));
});

feedRoutes.get('/:seg{@[A-Za-z0-9_]+}/feed.xml', async (c) => {
  const handle = c.req.param('seg').slice(1).toLowerCase();
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE handle = ?').bind(handle).first<UserRow>();
  if (!user) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  const origin = siteOrigin(c);
  const { posts } = await pagePosts(c, { userId: user.id, limit: LIMIT });
  return respond(atom({
    id: `${origin}/@${handle}/feed.xml`,
    title: `${user.display_name || handle} (@${handle}) on ${BRAND.name}`,
    subtitle: user.bio || BRAND.tagline,
    self: `${origin}/@${handle}/feed.xml`,
    alternate: `${origin}/@${handle}`,
    posts,
  }));
});
