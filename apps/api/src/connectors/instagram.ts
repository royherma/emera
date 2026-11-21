import { fail } from '../http';
import { net, type Connector, type Item, type Media, type ReadCtx } from './types';

export const IG_GRAPH = 'https://graph.instagram.com/v21.0';
const FIELDS = 'id,caption,media_type,media_url,permalink,timestamp,children{media_type,media_url}';

type IgMedia = { id: string; caption?: string; media_type: string; media_url?: string; permalink?: string; timestamp?: string; children?: { data: { media_type: string; media_url?: string }[] } };

const kind = (t: string): Media['type'] => (t === 'VIDEO' ? 'video' : t === 'IMAGE' ? 'image' : null);

export function igItems(data: IgMedia[]): Item[] {
  return data.map((m) => {
    const parts = m.media_type === 'CAROUSEL_ALBUM' ? (m.children?.data ?? []) : [m];
    const media = parts.filter((p) => p.media_url && kind(p.media_type)).map((p) => ({ url: p.media_url!, type: kind(p.media_type), alt: '' }));
    return { id: `ig:${m.id}`, url: m.permalink ?? '', caption: (m.caption ?? '').slice(0, 2200), createdAt: m.timestamp ? new Date(m.timestamp).toISOString() : null, media: media.slice(0, 10) };
  }).filter((i) => i.media.length);
}

export async function igToken(ctx: ReadCtx): Promise<string> {
  const row = await ctx.env.DB.prepare('SELECT token, expires_at FROM instagram_links WHERE user_id = ?').bind(ctx.userId).first<{ token: string; expires_at: number }>();
  if (!row || row.expires_at < Date.now()) throw fail(409, 'instagram_not_connected', 'Sign in with Instagram first: Settings, Bring your posts, Instagram.');
  return row.token;
}

async function read(_spec: string, limit: number, ctx?: ReadCtx): Promise<Item[]> {
  if (!ctx) throw fail(409, 'instagram_not_connected', 'Sign in with Instagram first.');
  const token = await igToken(ctx);
  const res = await net(`${IG_GRAPH}/me/media?fields=${encodeURIComponent(FIELDS)}&limit=${Math.min(50, Math.max(limit, 1))}&access_token=${encodeURIComponent(token)}`);
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw fail(502, 'source_failed', json?.error?.message ?? `Instagram answered ${res.status}.`);
  return igItems(json.data ?? []).slice(0, limit);
}

export const instagram: Connector = {
  id: 'instagram',
  name: 'Instagram',
  example: 'instagram',
  match: (input) => (/^(?:@?instagram|(?:https?:\/\/)?(?:www\.)?instagram\.com(?:\/.*)?)$/i.test(input.trim()) ? 'me' : null),
  label: () => 'your Instagram',
  from: () => 'instagram',
  read,
};
