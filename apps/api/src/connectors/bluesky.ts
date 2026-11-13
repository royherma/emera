import { fail } from '../http';
import { getJson, type Connector, type Item, type Media } from './types';

const BSKY = 'https://public.api.bsky.app/xrpc';

async function pdsOf(did: string): Promise<string | null> {
  if (!did.startsWith('did:plc:')) return null;
  const doc = await getJson(`https://plc.directory/${did}`).catch(() => null);
  return doc?.service?.find((s: any) => s.type === 'AtprotoPersonalDataServer')?.serviceEndpoint ?? null;
}

export function bskyItems(feed: any[], did: string, pds: string | null): Item[] {
  const out: Item[] = [];
  for (const f of feed) {
    const p = f.post;
    if (f.reason || !p || p.author?.did !== did) continue;
    const e = p.embed?.$type === 'app.bsky.embed.recordWithMedia#view' ? p.embed.media : p.embed;
    const media: Media[] = [];
    if (e?.$type === 'app.bsky.embed.images#view') for (const im of e.images ?? []) media.push({ url: im.fullsize, type: 'image', alt: im.alt ?? '' });
    if (e?.$type === 'app.bsky.embed.video#view' && pds && e.cid) media.push({ url: `${pds.replace(/\/$/, '')}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${e.cid}`, type: 'video', alt: e.alt ?? '' });
    if (!media.length) continue;
    const rkey = String(p.uri).split('/').pop();
    out.push({ id: `bsky:${p.uri}`, url: `https://bsky.app/profile/${p.author.handle}/post/${rkey}`, caption: String(p.record?.text ?? '').slice(0, 2200), createdAt: p.record?.createdAt ?? p.indexedAt ?? null, media });
  }
  return out;
}

async function readBluesky(spec: string, limit: number): Promise<Item[]> {
  const profile = await getJson(`${BSKY}/app.bsky.actor.getProfile?actor=${encodeURIComponent(spec)}`).catch(() => null);
  if (!profile?.did) throw fail(404, 'source_not_found', `No Bluesky account called ${spec}.`);
  const pds = await pdsOf(profile.did);
  const items: Item[] = [];
  let cursor = '';
  for (let page = 0; page < 5 && items.length < limit; page++) {
    const r = await getJson(`${BSKY}/app.bsky.feed.getAuthorFeed?actor=${profile.did}&filter=posts_with_media&limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    items.push(...bskyItems(r.feed ?? [], profile.did, pds));
    if (!r.cursor) break;
    cursor = r.cursor;
  }
  return items.slice(0, limit);
}

export const bluesky: Connector = {
  id: 'bluesky',
  name: 'Bluesky',
  example: '@you.bsky.social',
  match(input) {
    const m = /^(?:https?:\/\/(?:www\.)?bsky\.app\/profile\/)?@?((?:did:plc:[a-z0-9]+)|(?:[a-z0-9-]+\.)+[a-z]{2,})\/?$/i.exec(input);
    if (!m || !(/bsky\.app/i.test(input) || /^@|^did:/i.test(input) || /\.bsky\.social\/?$/i.test(input))) return null;
    return m[1].toLowerCase();
  },
  label: (spec) => `@${spec} on Bluesky`,
  from: (spec) => `@${spec}`,
  read: readBluesky,
};
