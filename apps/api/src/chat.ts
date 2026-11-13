import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv, Env, UserRow } from './env';
import { requireAuth, requireHandle } from './auth';
import { fail, readJson } from './http';
import { newId } from './crypto';
import { iso } from './serialize';
import { FLAG_REASONS } from './flags';

const BODY_MAX = 2000;
const PER_MINUTE = 20;
const REQUEST_CAP = 3;
const PAGE = 50;
const PREVIEW = 80;

type Who = { user_id: string; handle: string | null; display_name: string; avatar_url: string | null };
type MsgRow = Who & { id: string; body?: string; sealed?: string; created_at: number; deleted_at: number | null };
type Cur = { at: number; id: string };

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0));
const encodeCur = (at: number, id: string) => b64u(new TextEncoder().encode(`${at}_${id}`));

function decodeCur(raw: string | undefined): Cur | null {
  if (!raw) return null;
  try {
    const [at, id] = new TextDecoder().decode(unb64u(raw)).split('_');
    const n = Number(at);
    return Number.isFinite(n) && id ? { at: n, id } : null;
  } catch {
    return null;
  }
}

const keys = new Map<string, Promise<CryptoKey>>();

function chatKey(env: Env): Promise<CryptoKey> {
  const secret = env.CHAT_KEY || (env.ENVIRONMENT === 'dev' || env.ENVIRONMENT === 'test' ? 'dev-only-chat-key' : '');
  if (!secret) throw fail(503, 'chat_not_configured', 'Messages are not available right now.');
  let k = keys.get(secret);
  if (!k) {
    k = crypto.subtle.digest('SHA-256', new TextEncoder().encode(`emera-dm-v1:${secret}`))
      .then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));
    keys.set(secret, k);
  }
  return k;
}

async function seal(env: Env, threadId: string, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(threadId) }, await chatKey(env), new TextEncoder().encode(text));
  return `v1.${b64u(iv)}.${b64u(new Uint8Array(ct))}`;
}

async function unseal(env: Env, threadId: string, sealed: string): Promise<string> {
  const [v, iv, ct] = sealed.split('.');
  if (v !== 'v1' || !iv || !ct) return '';
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv), additionalData: new TextEncoder().encode(threadId) }, await chatKey(env), unb64u(ct));
  return new TextDecoder().decode(pt);
}

function bodyOf(raw: unknown): string {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) throw fail(400, 'bad_message', 'Write something first.');
  if (text.length > BODY_MAX) throw fail(400, 'message_too_long', `Messages can be up to ${BODY_MAX} characters.`);
  return text;
}

async function rateLimit(env: Env, userId: string) {
  const since = Date.now() - 60_000;
  const r = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM channel_messages WHERE user_id = ?1 AND created_at > ?2) + (SELECT COUNT(*) FROM dm_messages WHERE user_id = ?1 AND created_at > ?2) AS n`,
  ).bind(userId, since).first<{ n: number }>();
  if ((r?.n ?? 0) >= PER_MINUTE) throw fail(429, 'too_fast', 'You are sending messages very fast. Wait a minute and try again.');
}

const blockedEitherWay = (env: Env, a: string, b: string) =>
  env.DB.prepare('SELECT 1 AS x FROM blocks WHERE (blocker_id = ?1 AND blocked_id = ?2) OR (blocker_id = ?2 AND blocked_id = ?1)').bind(a, b).first();

const who = (r: Who) => ({ id: r.user_id, handle: r.handle, displayName: r.display_name, avatarUrl: r.avatar_url });

function messageJson(r: MsgRow, body: string, me: string) {
  const deleted = r.deleted_at !== null;
  return { id: r.id, user: who(r), body: deleted ? '' : body, createdAt: iso(r.created_at), mine: r.user_id === me, deleted };
}

async function pageOf(c: Context<AppEnv>, table: 'channel_messages' | 'dm_messages', where: string, args: (string | number)[]) {
  const after = decodeCur(c.req.query('after'));
  const before = decodeCur(c.req.query('before'));
  const base = `SELECT m.*, u.handle, u.display_name, u.avatar_url FROM ${table} m JOIN users u ON u.id = m.user_id WHERE ${where}`;
  let rows: MsgRow[];
  let older = false;
  if (after) {
    rows = (await c.env.DB.prepare(`${base} AND (m.created_at > ? OR (m.created_at = ? AND m.id > ?)) ORDER BY m.created_at, m.id LIMIT ?`)
      .bind(...args, after.at, after.at, after.id, PAGE * 2).all<MsgRow>()).results;
  } else {
    const cond = before ? ' AND (m.created_at < ? OR (m.created_at = ? AND m.id < ?))' : '';
    const extra = before ? [before.at, before.at, before.id] : [];
    const desc = (await c.env.DB.prepare(`${base}${cond} ORDER BY m.created_at DESC, m.id DESC LIMIT ?`)
      .bind(...args, ...extra, PAGE + 1).all<MsgRow>()).results;
    older = desc.length > PAGE;
    rows = desc.slice(0, PAGE).reverse();
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  return {
    rows,
    before: older && first ? encodeCur(first.created_at, first.id) : null,
    latest: last ? encodeCur(last.created_at, last.id) : (c.req.query('after') ?? null),
  };
}

export const chatRoutes = new Hono<AppEnv>();

type ChannelRow = { id: string; name: string; topic: string; slow_seconds: number; last_at: number; read_at: number | null };

const channelJson = (r: ChannelRow) => ({ id: r.id, name: r.name, topic: r.topic, slowSeconds: r.slow_seconds, unread: r.last_at > (r.read_at ?? 0) });

async function channelFor(c: Context<AppEnv>): Promise<ChannelRow> {
  const row = await c.env.DB.prepare(
    'SELECT ch.*, r.read_at FROM channels ch LEFT JOIN channel_reads r ON r.channel_id = ch.id AND r.user_id = ? WHERE ch.id = ?',
  ).bind(c.get('user').id, c.req.param('id')).first<ChannelRow>();
  if (!row) throw fail(404, 'not_found', 'No such channel.');
  return row;
}

const isMod = async (env: Env, channelId: string, userId: string) =>
  !!(await env.DB.prepare(`SELECT 1 AS x FROM channel_mods WHERE user_id = ? AND channel_id IN (?, '*')`).bind(userId, channelId).first());

const markChannelRead = (env: Env, channelId: string, userId: string, at: number) =>
  env.DB.prepare('INSERT INTO channel_reads (channel_id, user_id, read_at) VALUES (?, ?, ?) ON CONFLICT (channel_id, user_id) DO UPDATE SET read_at = MAX(read_at, excluded.read_at)')
    .bind(channelId, userId, at).run();

const CHANNEL_HIDE = `m.channel_id = ? AND m.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
  AND m.user_id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?) AND m.user_id NOT IN (SELECT muted_id FROM mutes WHERE muter_id = ?)`;

chatRoutes.get('/v1/channels', requireAuth, async (c) => {
  const rows = (await c.env.DB.prepare(
    'SELECT ch.*, r.read_at FROM channels ch LEFT JOIN channel_reads r ON r.channel_id = ch.id AND r.user_id = ? WHERE ch.community_id IS NULL ORDER BY ch.position, ch.id',
  ).bind(c.get('user').id).all<ChannelRow>()).results;
  return c.json({ channels: rows.map(channelJson) });
});

chatRoutes.get('/v1/channels/:id/messages', requireAuth, async (c) => {
  const me = c.get('user').id;
  const ch = await channelFor(c);
  const p = await pageOf(c, 'channel_messages', CHANNEL_HIDE, [ch.id, me, me, me]);
  return c.json({ channel: channelJson(ch), messages: p.rows.map((r) => messageJson(r, r.body ?? '', me)), before: p.before, latest: p.latest, moderator: await isMod(c.env, ch.id, me) });
});

chatRoutes.post('/v1/channels/:id/messages', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const ch = await channelFor(c);
  const text = bodyOf((await readJson(c)).body);
  await rateLimit(c.env, me.id);
  if (ch.slow_seconds > 0 && !(await isMod(c.env, ch.id, me.id))) {
    const recent = await c.env.DB.prepare('SELECT 1 AS x FROM channel_messages WHERE channel_id = ? AND user_id = ? AND created_at > ?')
      .bind(ch.id, me.id, Date.now() - ch.slow_seconds * 1000).first();
    if (recent) throw fail(429, 'slow_mode', `This channel allows one message every ${ch.slow_seconds} seconds.`);
  }
  const id = newId(12);
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO channel_messages (id, channel_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, ch.id, me.id, text, now),
    c.env.DB.prepare('UPDATE channels SET last_at = ? WHERE id = ?').bind(now, ch.id),
  ]);
  await markChannelRead(c.env, ch.id, me.id, now);
  const row: MsgRow = { id, user_id: me.id, handle: me.handle, display_name: me.display_name, avatar_url: me.avatar_url, body: text, created_at: now, deleted_at: null };
  return c.json({ message: messageJson(row, text, me.id) }, 201);
});

chatRoutes.post('/v1/channels/:id/read', requireAuth, async (c) => {
  const ch = await channelFor(c);
  await markChannelRead(c.env, ch.id, c.get('user').id, Date.now());
  return c.json({ ok: true });
});

chatRoutes.delete('/v1/channels/:id/messages/:mid', requireAuth, async (c) => {
  const me = c.get('user').id;
  const ch = await channelFor(c);
  const row = await c.env.DB.prepare('SELECT user_id FROM channel_messages WHERE id = ? AND channel_id = ?').bind(c.req.param('mid'), ch.id).first<{ user_id: string }>();
  if (!row) throw fail(404, 'not_found', 'No such message.');
  if (row.user_id !== me && !(await isMod(c.env, ch.id, me))) throw fail(403, 'forbidden', 'You can only delete your own messages.');
  await c.env.DB.prepare(`UPDATE channel_messages SET body = '', deleted_at = ? WHERE id = ?`).bind(Date.now(), c.req.param('mid')).run();
  return c.json({ ok: true });
});

type ThreadRow = {
  id: string; last_at: number; accepted: number; read_at: number; other_id: string; other_accepted: number;
  handle: string | null; display_name: string; avatar_url: string | null;
};

const THREAD_SELECT = `SELECT t.id, t.last_at, me.accepted, me.read_at, o.user_id AS other_id, o.accepted AS other_accepted, u.handle, u.display_name, u.avatar_url
  FROM dm_members me JOIN dm_threads t ON t.id = me.thread_id
  JOIN dm_members o ON o.thread_id = t.id AND o.user_id != me.user_id
  JOIN users u ON u.id = o.user_id
  WHERE me.user_id = ?1 AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?1 AND b.blocked_id = o.user_id) OR (b.blocker_id = o.user_id AND b.blocked_id = ?1))`;

async function threadJson(env: Env, t: ThreadRow) {
  const last = await env.DB.prepare('SELECT id, user_id, sealed, created_at, deleted_at FROM dm_messages WHERE thread_id = ? ORDER BY created_at DESC, id DESC LIMIT 1')
    .bind(t.id).first<{ user_id: string; sealed: string; created_at: number; deleted_at: number | null }>();
  const text = last && last.deleted_at === null ? await unseal(env, t.id, last.sealed) : '';
  return {
    id: t.id,
    with: { id: t.other_id, handle: t.handle, displayName: t.display_name, avatarUrl: t.avatar_url },
    accepted: !!t.accepted,
    theyAccepted: !!t.other_accepted,
    lastAt: iso(t.last_at),
    last: last ? { body: text.length > PREVIEW ? `${text.slice(0, PREVIEW - 1)}…` : text, mine: last.user_id !== t.other_id, deleted: last.deleted_at !== null } : null,
    unread: !!last && last.user_id === t.other_id && last.created_at > t.read_at,
  };
}

async function threadFor(c: Context<AppEnv>, id = c.req.param('id')): Promise<ThreadRow> {
  const t = await c.env.DB.prepare(`${THREAD_SELECT} AND t.id = ?2`).bind(c.get('user').id, id).first<ThreadRow>();
  if (!t) throw fail(404, 'not_found', 'No such conversation.');
  return t;
}

async function sendDm(c: Context<AppEnv>, t: ThreadRow, text: string) {
  const me = c.get('user');
  await rateLimit(c.env, me.id);
  if (!t.other_accepted) {
    const sent = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM dm_messages WHERE thread_id = ? AND user_id = ?').bind(t.id, me.id).first<{ n: number }>();
    if ((sent?.n ?? 0) >= REQUEST_CAP) throw fail(403, 'request_pending', 'You can send more once they accept your message.');
  }
  const id = newId(12);
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO dm_messages (id, thread_id, user_id, sealed, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, t.id, me.id, await seal(c.env, t.id, text), now),
    c.env.DB.prepare('UPDATE dm_threads SET last_at = ? WHERE id = ?').bind(now, t.id),
    c.env.DB.prepare('UPDATE dm_members SET accepted = 1, hidden = 0, read_at = ? WHERE thread_id = ? AND user_id = ?').bind(now, t.id, me.id),
    c.env.DB.prepare('UPDATE dm_members SET hidden = 0 WHERE thread_id = ? AND user_id = ? AND accepted = 1').bind(t.id, t.other_id),
  ]);
  const row: MsgRow = { id, user_id: me.id, handle: me.handle, display_name: me.display_name, avatar_url: me.avatar_url, body: text, created_at: now, deleted_at: null };
  return messageJson(row, text, me.id);
}

chatRoutes.get('/v1/dms', requireAuth, async (c) => {
  const box = c.req.query('box') === 'requests' ? 0 : 1;
  const rows = (await c.env.DB.prepare(`${THREAD_SELECT} AND me.hidden = 0 AND me.accepted = ?2 AND EXISTS (SELECT 1 FROM dm_messages WHERE thread_id = t.id) ORDER BY t.last_at DESC LIMIT 50`)
    .bind(c.get('user').id, box).all<ThreadRow>()).results;
  return c.json({ threads: await Promise.all(rows.map((t) => threadJson(c.env, t))) });
});

chatRoutes.get('/v1/dms/unread', requireAuth, async (c) => {
  const rows = (await c.env.DB.prepare(
    `${THREAD_SELECT} AND me.hidden = 0 AND EXISTS (SELECT 1 FROM dm_messages m WHERE m.thread_id = t.id AND m.user_id = o.user_id AND m.created_at > me.read_at)`,
  ).bind(c.get('user').id).all<ThreadRow>()).results;
  return c.json({ inbox: rows.filter((r) => r.accepted).length, requests: rows.filter((r) => !r.accepted).length });
});

chatRoutes.post('/v1/dms', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const body = await readJson(c);
  const handle = typeof body.handle === 'string' ? body.handle.trim().toLowerCase().replace(/^@/, '') : '';
  const text = bodyOf(body.body);
  const other = await c.env.DB.prepare('SELECT * FROM users WHERE handle = ?').bind(handle).first<UserRow>();
  if (!other) throw fail(404, 'not_found', 'No such account.');
  if (other.id === me.id) throw fail(400, 'self', 'You cannot message yourself.');
  if (await blockedEitherWay(c.env, me.id, other.id)) throw fail(403, 'cant_message', "You can't message this account.");
  const pair = [me.id, other.id].sort().join(':');
  let id = (await c.env.DB.prepare('SELECT id FROM dm_threads WHERE pair = ?').bind(pair).first<{ id: string }>())?.id;
  if (!id) {
    id = newId(12);
    const now = Date.now();
    const follows = await c.env.DB.prepare('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followee_id = ?').bind(other.id, me.id).first();
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT OR IGNORE INTO dm_threads (id, pair, created_by, last_at, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, pair, me.id, now, now),
      c.env.DB.prepare('INSERT OR IGNORE INTO dm_members (thread_id, user_id, accepted) SELECT id, ?, 1 FROM dm_threads WHERE pair = ?').bind(me.id, pair),
      c.env.DB.prepare('INSERT OR IGNORE INTO dm_members (thread_id, user_id, accepted) SELECT id, ?, ? FROM dm_threads WHERE pair = ?').bind(other.id, follows ? 1 : 0, pair),
    ]);
    id = (await c.env.DB.prepare('SELECT id FROM dm_threads WHERE pair = ?').bind(pair).first<{ id: string }>())!.id;
  }
  const t = await threadFor(c, id);
  const message = await sendDm(c, t, text);
  return c.json({ thread: await threadJson(c.env, await threadFor(c, id)), message }, 201);
});

chatRoutes.get('/v1/dms/:id/messages', requireAuth, async (c) => {
  const me = c.get('user').id;
  const t = await threadFor(c);
  const p = await pageOf(c, 'dm_messages', 'm.thread_id = ?', [t.id]);
  const messages = await Promise.all(p.rows.map(async (r) => messageJson(r, r.deleted_at === null ? await unseal(c.env, t.id, r.sealed ?? '') : '', me)));
  return c.json({ thread: await threadJson(c.env, t), messages, before: p.before, latest: p.latest });
});

chatRoutes.post('/v1/dms/:id/messages', requireAuth, requireHandle, async (c) => {
  const t = await threadFor(c);
  const text = bodyOf((await readJson(c)).body);
  return c.json({ message: await sendDm(c, t, text) }, 201);
});

chatRoutes.post('/v1/dms/:id/read', requireAuth, async (c) => {
  const t = await threadFor(c);
  await c.env.DB.prepare('UPDATE dm_members SET read_at = ? WHERE thread_id = ? AND user_id = ?').bind(Date.now(), t.id, c.get('user').id).run();
  return c.json({ ok: true });
});

chatRoutes.post('/v1/dms/:id/accept', requireAuth, async (c) => {
  const t = await threadFor(c);
  await c.env.DB.prepare('UPDATE dm_members SET accepted = 1, hidden = 0 WHERE thread_id = ? AND user_id = ?').bind(t.id, c.get('user').id).run();
  return c.json({ thread: await threadJson(c.env, await threadFor(c, t.id)) });
});

chatRoutes.delete('/v1/dms/:id', requireAuth, async (c) => {
  const t = await threadFor(c);
  await c.env.DB.prepare('UPDATE dm_members SET hidden = 1, read_at = ? WHERE thread_id = ? AND user_id = ?').bind(Date.now(), t.id, c.get('user').id).run();
  return c.json({ ok: true });
});

chatRoutes.delete('/v1/dms/:id/messages/:mid', requireAuth, async (c) => {
  const t = await threadFor(c);
  const row = await c.env.DB.prepare('SELECT user_id FROM dm_messages WHERE id = ? AND thread_id = ?').bind(c.req.param('mid'), t.id).first<{ user_id: string }>();
  if (!row) throw fail(404, 'not_found', 'No such message.');
  if (row.user_id !== c.get('user').id) throw fail(403, 'forbidden', 'You can only delete your own messages.');
  await c.env.DB.prepare(`UPDATE dm_messages SET sealed = '', deleted_at = ? WHERE id = ?`).bind(Date.now(), c.req.param('mid')).run();
  return c.json({ ok: true });
});

chatRoutes.post('/v1/chat/flags', requireAuth, requireHandle, async (c) => {
  const me = c.get('user');
  const body = await readJson(c);
  const kind = body.kind === 'dm' ? 'dm_message' : body.kind === 'channel' ? 'channel_message' : null;
  if (!kind) throw fail(400, 'bad_target', 'Report a channel message or a private message.');
  const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : '';
  if (typeof body.reason !== 'string' || !(FLAG_REASONS as readonly string[]).includes(body.reason)) throw fail(400, 'bad_reason', `Pick a reason: ${FLAG_REASONS.join(', ')}.`);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';

  let owner: string | undefined;
  let evidence: string | null = null;
  if (kind === 'channel_message') {
    owner = (await c.env.DB.prepare('SELECT user_id FROM channel_messages WHERE id = ?').bind(messageId).first<{ user_id: string }>())?.user_id;
  } else {
    const row = await c.env.DB.prepare(
      'SELECT m.user_id, m.sealed, m.thread_id, m.deleted_at FROM dm_messages m JOIN dm_members me ON me.thread_id = m.thread_id AND me.user_id = ? WHERE m.id = ?',
    ).bind(me.id, messageId).first<{ user_id: string; sealed: string; thread_id: string; deleted_at: number | null }>();
    owner = row?.user_id;
    if (row && row.deleted_at === null) evidence = await unseal(c.env, row.thread_id, row.sealed);
  }
  if (!owner) throw fail(404, 'not_found', 'No such message.');
  if (owner === me.id) throw fail(400, 'own_content', 'You cannot report your own message.');

  const id = newId(10);
  const res = await c.env.DB.prepare('INSERT OR IGNORE INTO flags (id, reporter_user_id, target_type, target_id, reason, note, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, me.id, kind, messageId, body.reason, note, evidence, Date.now()).run();
  return c.json({ ok: true, duplicate: res.meta.changes === 0 }, res.meta.changes ? 201 : 200);
});
