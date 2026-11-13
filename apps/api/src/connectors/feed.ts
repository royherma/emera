import { fail } from '../http';
import { net, typeOf, UA, type Connector, type Item, type Media } from './types';

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : entities[e.toLowerCase()] ?? m);
const textOf = (html: string) => decode(decode(html)
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n\n').replace(/<[^>]+>/g, ''))
  .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
const tag = (block: string, name: string) => { const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block); return m ? m[1] : ''; };
const attr = (t: string, name: string) => { const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(t); return m ? decode(m[2] ?? m[3]) : ''; };

export function parseFeed(xml: string, base: string): Item[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return blocks.map((b) => {
    const abs = (u: string) => { try { return new URL(u, base).toString(); } catch { return ''; } };
    const linkTag = /<link\b[^>]*rel=["']alternate["'][^>]*>/i.exec(b)?.[0] ?? /<link\b[^>]*href=[^>]*>/i.exec(b)?.[0] ?? '';
    const link = abs(decode(tag(b, 'link').trim()) || attr(linkTag, 'href'));
    const body = tag(b, 'content:encoded') || tag(b, 'description') || tag(b, 'content') || tag(b, 'summary');
    const title = textOf(tag(b, 'title'));
    const text = textOf(body);
    const media: Media[] = [];
    const seen = new Set<string>();
    const add = (u: string, t: string, alt = '') => { const url = abs(u); if (!url || seen.has(url)) return; seen.add(url); media.push({ url, type: typeOf(url, t), alt }); };
    for (const m of b.match(/<media:content\b[^>]*>/gi) ?? []) add(attr(m, 'url'), attr(m, 'type') || attr(m, 'medium'), textOf(tag(b, 'media:description')));
    for (const m of b.match(/<enclosure\b[^>]*>/gi) ?? []) add(attr(m, 'url'), attr(m, 'type'));
    for (const m of decode(body).match(/<img\b[^>]*>/gi) ?? []) add(attr(m, 'src'), 'image', attr(m, 'alt'));
    const date = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date');
    const t = Date.parse(decode(date).trim());
    return {
      id: `feed:${decode(tag(b, 'guid') || tag(b, 'id')).trim() || link}`,
      url: link,
      caption: (text && title && !text.startsWith(title) ? `${title}\n\n${text}` : text || title).slice(0, 2200),
      createdAt: Number.isFinite(t) ? new Date(t).toISOString() : null,
      media: media.filter((m) => m.type).slice(0, 10),
    };
  });
}

async function readFeed(spec: string, limit: number): Promise<Item[]> {
  let res = await net(spec, { headers: { ...UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html' } });
  if (!res.ok) throw fail(502, 'source_failed', `That link answered ${res.status}.`);
  let body = await res.text();
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(body)) {
    const alt = (body.match(/<link\b[^>]*>/gi) ?? []).find((l) => /rel=["']?alternate/i.test(l) && /(rss|atom)\+xml/i.test(l));
    if (!alt) throw fail(422, 'no_feed', 'That page has no feed to read. Paste your RSS or Atom feed link instead.');
    const next = new URL(attr(alt, 'href'), spec).toString();
    res = await net(next, { headers: UA });
    if (!res.ok) throw fail(502, 'source_failed', `The feed answered ${res.status}.`);
    body = await res.text();
    spec = next;
  }
  return parseFeed(body, spec).filter((i) => i.media.length).slice(0, limit);
}

export const feed: Connector = {
  id: 'feed',
  name: 'RSS or Atom feed',
  example: 'https://yourblog.com/feed',
  match(input) {
    let url: URL;
    try { url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`); } catch { return null; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  },
  label: (spec) => { const u = new URL(spec); return u.hostname + u.pathname.replace(/\/$/, ''); },
  from: (spec) => spec,
  read: readFeed,
};
