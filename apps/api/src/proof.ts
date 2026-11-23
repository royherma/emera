import { Hono } from 'hono';
import type { AppEnv } from './env';
import { fail } from './http';
import { hmacHex } from './crypto';
import { iso, type MediaRow } from './serialize';

export const proofRoutes = new Hono<AppEnv>();

proofRoutes.get('/v1/posts/:id/proof', async (c) => {
  const id = c.req.param('id');
  const post = await c.env.DB.prepare('SELECT id, user_id, created_at FROM posts WHERE id = ?').bind(id).first<{ id: string; user_id: string; created_at: number }>();
  if (!post) throw fail(404, 'not_found', 'No such post.');
  const [author, media, imp] = await Promise.all([
    c.env.DB.prepare('SELECT handle, display_name, role FROM users WHERE id = ?').bind(post.user_id).first<{ handle: string | null; display_name: string; role: string | null }>(),
    c.env.DB.prepare('SELECT * FROM media WHERE post_id = ? ORDER BY position').bind(id).all<MediaRow>(),
    c.env.DB.prepare('SELECT source, item_url FROM imported_items WHERE post_id = ?').bind(id).first<{ source: string; item_url: string | null }>(),
  ]);
  const files = media.results;
  let intact = 0;
  for (const m of files) {
    if (!m.sha256 || !m.signed_at || !m.signer || !m.signature) continue;
    if (m.signature === (await hmacHex(c.env.PROOF_SECRET, `${m.sha256}.${iso(m.signed_at)}.${m.signer}`))) intact++;
  }
  const firstUpload = files.reduce<number | null>((t, m) => (m.signed_at && (t === null || m.signed_at < t) ? m.signed_at : t), null);
  let importedFrom: string | null = null;
  if (imp) {
    try { importedFrom = new URL(imp.item_url ?? '').hostname.replace(/^www\./, ''); } catch { importedFrom = imp.source.split(':')[0]; }
  }
  return c.json({
    proof: {
      postId: id,
      author: { handle: author?.handle ?? null, displayName: author?.display_name ?? '', role: author?.role ?? null, verifiedBy: 'email' as const },
      firstPostedAt: iso(firstUpload ?? post.created_at),
      files: { total: files.length, intact },
      imported: imp ? { from: importedFrom, link: imp.item_url, originalDate: iso(post.created_at) } : null,
    },
  });
});
