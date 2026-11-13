import { Hono } from 'hono';
import type { AppEnv, UserRow } from './env';
import { requireAuth, requireHandle } from './auth';
import { fail, originOf, readJson } from './http';
import { userJson } from './serialize';

const NAME_MAX = 50;
const BIO_MAX = 280;
const LINKS_MAX = 5;
const LINK_LEN = 200;

function cleanLinks(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length > LINKS_MAX) throw fail(400, 'bad_links', `Add up to ${LINKS_MAX} links.`);
  const out: string[] = [];
  for (const item of raw) {
    const s = typeof item === 'string' ? item.trim() : '';
    let ok = false;
    try {
      const u = new URL(s);
      ok = (u.protocol === 'http:' || u.protocol === 'https:') && s.length <= LINK_LEN;
    } catch {}
    if (!ok) throw fail(400, 'bad_links', `Each link must start with http:// or https:// and be under ${LINK_LEN} characters.`);
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

export const profileRoutes = new Hono<AppEnv>();

profileRoutes.patch('/v1/me', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const body = await readJson(c);
  const sets: string[] = [];
  const args: (string | null)[] = [];

  if (body.displayName !== undefined) {
    const name = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (!name || name.length > NAME_MAX) throw fail(400, 'bad_name', `Names can be 1 to ${NAME_MAX} characters.`);
    sets.push('display_name = ?'); args.push(name);
  }
  if (body.bio !== undefined) {
    const bio = typeof body.bio === 'string' ? body.bio.trim() : null;
    if (bio === null || bio.length > BIO_MAX) throw fail(400, 'bad_bio', `Bios can be up to ${BIO_MAX} characters.`);
    sets.push('bio = ?'); args.push(bio);
  }
  if (body.links !== undefined) {
    sets.push('links = ?'); args.push(JSON.stringify(cleanLinks(body.links)));
  }
  if (body.avatarMediaId !== undefined) {
    if (body.avatarMediaId === null) {
      sets.push('avatar_url = ?'); args.push(null);
    } else {
      if (typeof body.avatarMediaId !== 'string') throw fail(400, 'bad_avatar', 'Pick an image you uploaded.');
      const m = await c.env.DB.prepare(`SELECT r2_key FROM media WHERE id = ? AND user_id = ? AND kind = 'image' AND status = 'done' AND post_id IS NULL`)
        .bind(body.avatarMediaId, me.id).first<{ r2_key: string }>();
      if (!m) throw fail(400, 'bad_avatar', 'Pick an image you uploaded.');
      sets.push('avatar_url = ?'); args.push(`${originOf(c)}/media/${m.r2_key}`);
    }
  }
  if (!sets.length) throw fail(400, 'nothing_to_change', 'Send at least one field to change.');

  await c.env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...args, me.id).run();
  const row = (await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(me.id).first<UserRow>())!;
  return c.json({ user: userJson(row) });
});
