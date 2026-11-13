import type { Context } from 'hono';
import type { AppEnv, UserRow } from './env';
import { originOf } from './http';

export type MediaRow = {
  id: string; user_id: string; kind: string; content_type: string; width: number; height: number;
  sha256: string | null; r2_key: string; signed_at: number | null; signer: string | null; signature: string | null;
  post_id: string | null; position: number;
};
export type PostRow = { id: string; user_id: string; caption: string; created_at: number };

export const iso = (ms: number) => new Date(ms).toISOString();

export function userJson(u: UserRow) {
  return { id: u.id, handle: u.handle, displayName: u.display_name, bio: u.bio, avatarUrl: u.avatar_url, createdAt: iso(u.created_at) };
}

export function mediaJson(origin: string, m: MediaRow) {
  return {
    id: m.id,
    kind: m.kind,
    contentType: m.content_type,
    width: m.width,
    height: m.height,
    url: `${origin}/media/${m.r2_key}`,
    sha256: m.sha256,
    proof: {
      sha256: m.sha256,
      signedAt: m.signed_at ? iso(m.signed_at) : null,
      signer: m.signer,
      signature: m.signature,
      alg: 'hmac-sha256',
    },
  };
}

export async function loadPosts(c: Context<AppEnv>, rows: PostRow[]) {
  if (!rows.length) return [];
  const origin = originOf(c);
  const ph = rows.map(() => '?').join(',');
  const ids = rows.map((r) => r.id);
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const uph = userIds.map(() => '?').join(',');
  const [media, users] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM media WHERE post_id IN (${ph}) ORDER BY position`).bind(...ids).all<MediaRow>(),
    c.env.DB.prepare(`SELECT * FROM users WHERE id IN (${uph})`).bind(...userIds).all<UserRow>(),
  ]);
  const byPost = new Map<string, ReturnType<typeof mediaJson>[]>();
  for (const m of media.results) {
    const list = byPost.get(m.post_id!) ?? [];
    list.push(mediaJson(origin, m));
    byPost.set(m.post_id!, list);
  }
  const byUser = new Map(users.results.map((u) => [u.id, userJson(u)]));
  return rows.map((p) => ({
    id: p.id,
    author: byUser.get(p.user_id)!,
    caption: p.caption,
    media: byPost.get(p.id) ?? [],
    createdAt: iso(p.created_at),
    url: `${origin}/p/${p.id}`,
  }));
}

export const encodeCursor = (p: PostRow) => btoa(`${p.created_at}_${p.id}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function decodeCursor(raw: string | undefined): { at: number; id: string } | null {
  if (!raw) return null;
  try {
    const [at, id] = atob(raw.replace(/-/g, '+').replace(/_/g, '/')).split('_');
    const n = Number(at);
    return Number.isFinite(n) && id ? { at: n, id } : null;
  } catch {
    return null;
  }
}
