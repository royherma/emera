import { fail } from '../http';

export type Media = { url: string; type: 'image' | 'video' | null; alt: string };
export type Item = { id: string; url: string; caption: string; createdAt: string | null; media: Media[] };

export type Connector = {
  id: string;
  name: string;
  example: string;
  match(input: string): string | null;
  label(spec: string): string;
  from(spec: string): string;
  read(spec: string, limit: number): Promise<Item[]>;
};

let netFn: typeof fetch = (input, init) => fetch(input, init);
export const setNet = (f: typeof fetch) => { netFn = f; };
export const net: typeof fetch = (input, init) => netFn(input, init);

export const UA = { 'User-Agent': 'EmeraImporter/1.0 (+https://emera.social)' };

export async function getJson(url: string): Promise<any> {
  const res = await net(url, { headers: UA });
  if (!res.ok) throw fail(502, 'source_failed', `The source answered ${res.status}.`);
  return res.json();
}

export function typeOf(url: string, declared = ''): Media['type'] {
  const d = declared.toLowerCase();
  if (d.startsWith('image')) return 'image';
  if (d.startsWith('video')) return 'video';
  const ext = new URL(url).pathname.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'm4v'].includes(ext)) return 'video';
  return null;
}
