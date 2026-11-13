import { DurableObject } from 'cloudflare:workers';
import type { Context } from 'hono';
import type { AppEnv, Env } from './env';
import { hmacHex } from './crypto';

const TICKET_MS = 60_000;

export type LiveEvent = { t: 'new' | 'deleted'; room: string };

export class ChatLive extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(req: Request): Promise<Response> {
    if (new URL(req.url).pathname === '/poke') {
      const msg = await req.text();
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.send(msg); } catch {}
      }
      return new Response(null, { status: 204 });
    }
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch {}
  }
}

const secret = (env: Env) => env.CHAT_KEY || (env.ENVIRONMENT === 'dev' || env.ENVIRONMENT === 'test' ? 'dev-only-chat-key' : '');

export async function liveTicket(env: Env, room: string) {
  const exp = Date.now() + TICKET_MS;
  return `${encodeURIComponent(room)}.${exp}.${await hmacHex(secret(env), `live:${room}:${exp}`)}`;
}

async function roomOf(env: Env, ticket: string | null): Promise<string | null> {
  const [room, exp, sig] = (ticket ?? '').split('.');
  if (!room || !exp || !sig || !secret(env) || Number(exp) < Date.now()) return null;
  const name = decodeURIComponent(room);
  return sig === (await hmacHex(secret(env), `live:${name}:${exp}`)) ? name : null;
}

export async function liveSocket(req: Request, env: Env): Promise<Response> {
  if (req.headers.get('Upgrade') !== 'websocket') return Response.json({ error: { code: 'upgrade_required', message: 'Open this as a WebSocket.' } }, { status: 426 });
  const room = await roomOf(env, new URL(req.url).searchParams.get('ticket'));
  if (!room) return Response.json({ error: { code: 'bad_ticket', message: 'Ask for a new ticket.' } }, { status: 401 });
  return env.CHAT_LIVE.get(env.CHAT_LIVE.idFromName(room)).fetch(req);
}

export function poke(c: Context<AppEnv>, room: string, t: LiveEvent['t'] = 'new') {
  const send = c.env.CHAT_LIVE.get(c.env.CHAT_LIVE.idFromName(room))
    .fetch('https://live/poke', { method: 'POST', body: JSON.stringify({ t, room } satisfies LiveEvent) })
    .then(() => {}, (e) => console.error('[live] poke failed', room, e));
  try {
    c.executionCtx.waitUntil(send);
    return Promise.resolve();
  } catch {
    return send;
  }
}
