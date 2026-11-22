import { Hono } from 'hono';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import type { AppEnv, UserRow } from './env';
import { BRAND } from './brand';
import { CARD_FONT } from './cardFont';
import { notFoundPage } from './pages';
import type { MediaRow, PostRow } from './serialize';
import { CARD, cardLayout, type CardLayout } from '../../../packages/media/mediaBox';

const W = CARD.width;
const H = CARD.height;
const { colors } = BRAND;

let ready: Promise<void> | undefined;
const wasmReady = () => (ready ??= initWasm(resvgWasm));

const xml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]!);
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const day = (ms: number) => new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

function base64(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function backdrop(env: AppEnv['Bindings'], media: MediaRow[]): Promise<{ photo: string; layout: CardLayout } | null> {
  const first = media.find((m) => m.kind === 'image') ?? media.find((m) => m.poster_key);
  const key = first && (first.kind === 'image' ? first.r2_key : first.poster_key);
  if (!key) return null;
  const layout = cardLayout(first);
  const size = layout.mode === 'cover' ? { width: W, height: H, fit: 'cover' as const } : { width: layout.frame.width * 2, height: layout.frame.height * 2, fit: 'scale-down' as const };
  const obj = await env.MEDIA.get(key);
  if (!obj) return null;
  let type = obj.httpMetadata?.contentType ?? 'image/webp';
  let bytes = new Uint8Array(await obj.arrayBuffer());
  if (env.IMAGES) {
    try {
      const out = await env.IMAGES.input(new Response(bytes).body!).transform(size).output({ format: 'image/jpeg', quality: 82 });
      bytes = new Uint8Array(await out.response().arrayBuffer());
      type = 'image/jpeg';
    } catch (e) {
      console.error('card resize failed', e);
    }
  }
  return { photo: `data:${type};base64,${base64(bytes)}`, layout };
}

export function cardSvg(o: { photo: string | null; layout?: CardLayout; name: string; handle: string; line: string }) {
  const f = o.layout?.mode === 'framed' ? o.layout.frame : null;
  const full = (extra = '') => `<image href="${o.photo}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"${extra}/>`;
  const photo = !o.photo
    ? `<rect width="${W}" height="${H}" fill="${colors.accent}"/>`
    : f
      ? `${full(' filter="url(#b)"')}<rect width="${W}" height="${H}" fill="#140f0b" fill-opacity="0.55"/>
<clipPath id="r"><rect x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}" rx="22"/></clipPath>
<image href="${o.photo}" x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}" preserveAspectRatio="xMidYMid meet" clip-path="url(#r)"/>`
      : full();
  const pill = BRAND.name.length * 25 + 66;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><filter id="b" x="0" y="0" width="1" height="1"><feGaussianBlur stdDeviation="28"/></filter><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140f0b" stop-opacity="0"/><stop offset="1" stop-color="#140f0b" stop-opacity="0.88"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="${colors.bg}"/>
${photo}
<rect y="${H - 300}" width="${W}" height="300" fill="url(#g)"/>
<rect x="48" y="44" width="${pill}" height="56" rx="28" fill="${colors.bg}"/>
<text x="74" y="82" font-family="Inter" font-weight="700" font-size="32" fill="${colors.ink}">${xml(BRAND.name)}</text>
<circle cx="${74 + BRAND.name.length * 22 + 14}" cy="76" r="7" fill="${colors.accent}"/>
<text x="56" y="${H - 118}" font-family="Inter" font-weight="700" font-size="58" fill="#ffffff">${xml(o.name)}</text>
<text x="56" y="${H - 70}" font-family="Inter" font-weight="700" font-size="32" fill="#ffffff" fill-opacity="0.8">@${xml(o.handle)}</text>
<text x="56" y="${H - 28}" font-family="Inter" font-weight="700" font-size="28" fill="${colors.accent2}">${xml(o.line)}</text>
</svg>`;
}

export async function renderCard(svg: string): Promise<Uint8Array> {
  await wasmReady();
  const out = new Resvg(svg, { font: { fontBuffers: [CARD_FONT], loadSystemFonts: false, defaultFontFamily: 'Inter' }, fitTo: { mode: 'width', value: W } });
  return out.render().asPng();
}

export const cardRoutes = new Hono<AppEnv>();

cardRoutes.get('/p/:id/card.png', async (c) => {
  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(c.req.param('id')).first<PostRow>();
  if (!post) return notFoundPage('We could not find that post.');
  const [author, media] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(post.user_id).first<UserRow>(),
    c.env.DB.prepare('SELECT * FROM media WHERE post_id = ? ORDER BY position').bind(post.id).all<MediaRow>(),
  ]);
  if (!author) return notFoundPage('We could not find that post.');
  const first = media.results[0];
  const line = first?.signed_at && first.sha256
    ? `Proof of origin: signed on ${day(first.signed_at)}`
    : `Shared on ${BRAND.name} on ${day(post.created_at)}`;
  const back = await backdrop(c.env, media.results);
  const narrow = back?.layout.mode === 'framed';
  const png = await renderCard(cardSvg({
    photo: back?.photo ?? null,
    layout: back?.layout,
    name: clip(author.display_name || author.handle || '', narrow ? 20 : 26),
    handle: clip(author.handle ?? '', 30),
    line,
  }));
  return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600, s-maxage=86400', 'Content-Disposition': 'inline' } });
});
