import { fail } from '../http';
import { bluesky } from './bluesky';
import { feed } from './feed';
import type { Connector, Item } from './types';

export type { Connector, Item, Media } from './types';
export { setNet } from './types';
export { parseFeed, decode } from './feed';
export { bskyItems } from './bluesky';

const mastodon: Connector = {
  ...feed,
  id: 'mastodon',
  name: 'Mastodon',
  example: 'https://mastodon.social/@you',
  match(input) {
    const m = /^(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})\/@([a-z0-9_]+)(?:\.rss)?\/?$/i.exec(input);
    return m ? `https://${m[1].toLowerCase()}/@${m[2]}.rss` : null;
  },
  label: (spec) => spec.replace(/^https:\/\//, '').replace(/\.rss$/, ''),
};

export const CONNECTORS: Connector[] = [bluesky, mastodon, feed];

export const LOCKED = [
  { name: 'Instagram', host: /(^|\.)instagram\.com$/, why: 'Instagram does not share posts with other apps. Download your data from Instagram and bring the zip in with the Emera importer.' },
  { name: 'TikTok', host: /(^|\.)tiktok\.com$/, why: 'TikTok does not share posts with other apps. Download your data from TikTok and bring the videos in one by one.' },
  { name: 'X', host: /(^|\.)(x|twitter)\.com$/, why: 'X does not share posts with other apps for free.' },
  { name: 'Facebook', host: /(^|\.)facebook\.com$/, why: 'Facebook does not share posts with other apps.' },
];

export type Source = { kind: string; spec: string; label: string };

export function parseFrom(raw: string): Source {
  const s = raw.trim();
  if (!s) throw fail(400, 'bad_source', 'Say where to import from: a Bluesky handle or a link to your feed or profile.');
  try {
    const host = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`).hostname;
    const locked = LOCKED.find((l) => l.host.test(host));
    if (locked) throw fail(422, 'source_locked', locked.why);
  } catch (e) {
    if (e instanceof Error && 'code' in e) throw e;
  }
  for (const c of CONNECTORS) {
    const spec = c.match(s);
    if (spec) return { kind: c.id, spec, label: c.label(spec) };
  }
  throw fail(400, 'bad_source', 'That is not a link or a Bluesky handle.');
}

export const connectorFor = (kind: string) => CONNECTORS.find((c) => c.id === kind) ?? feed;
export const readSource = (s: Source, limit: number) => connectorFor(s.kind).read(s.spec, limit);
export const fromOf = (s: Source) => connectorFor(s.kind).from(s.spec);

export type Rules = { media?: 'any' | 'photos' | 'videos'; tag?: string };

export function cleanRules(raw: unknown): Rules {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const media = r.media === 'photos' || r.media === 'videos' ? r.media : 'any';
  const tag = typeof r.tag === 'string' ? r.tag.trim().replace(/^#/, '').slice(0, 50) : '';
  if (tag && !/^[\p{L}\p{N}_]+$/u.test(tag)) throw fail(400, 'bad_rules', 'A hashtag is letters, numbers or underscores.');
  return { media, ...(tag ? { tag } : {}) };
}

export function passes(item: Item, rules: Rules): boolean {
  if (rules.media === 'photos' && !item.media.some((m) => m.type === 'image')) return false;
  if (rules.media === 'videos' && !item.media.some((m) => m.type === 'video')) return false;
  if (rules.tag && !new RegExp(`(^|[^\\p{L}\\p{N}_])#${rules.tag}(?![\\p{L}\\p{N}_])`, 'iu').test(item.caption)) return false;
  return true;
}

export const connectorList = () => ({
  connectors: CONNECTORS.map((c) => ({ id: c.id, name: c.name, example: c.example })),
  locked: LOCKED.map((l) => ({ name: l.name, why: l.why })),
});
