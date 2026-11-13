import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv, Env, UserRow } from './env';
import { requireAuth } from './auth';
import { fail, originOf, readJson } from './http';
import { newId, newToken, sha256Hex } from './crypto';
import { BRAND } from './brand';

const CODE_TTL_MS = 5 * 60_000;
const ACCESS_TTL_S = 30 * 86_400;
const REFRESH_TTL_MS = 365 * 86_400_000;

type Client = { id: string; name: string; redirect_uris: string };

const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const s256 = async (v: string) => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
const okRedirect = (u: string) => { try { const p = new URL(u).protocol; return !['javascript:', 'data:', 'file:', 'vbscript:'].includes(p); } catch { return false; } };
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

export const resourceMetadataUrl = (origin: string) => `${origin}/.well-known/oauth-protected-resource`;

export async function userForToken(env: Env, token: string): Promise<UserRow | null> {
  if (!token) return null;
  return env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .bind(await sha256Hex(token), Date.now()).first<UserRow>();
}

async function issue(env: Env, clientId: string, userId: string) {
  const access = newToken();
  const refresh = newToken();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, client_id) VALUES (?, ?, ?, ?, ?)').bind(await sha256Hex(access), userId, now, now + ACCESS_TTL_S * 1000, clientId),
    env.DB.prepare('INSERT INTO oauth_refresh (token_hash, client_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').bind(await sha256Hex(refresh), clientId, userId, now, now + REFRESH_TTL_MS),
  ]);
  return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: 'emera' };
}

const tokenError = (error: string, description: string) => Response.json({ error, error_description: description }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

export const oauthRoutes = new Hono<AppEnv>();
oauthRoutes.use('/.well-known/*', cors({ origin: '*' }));
oauthRoutes.use('/oauth/register', cors({ origin: '*' }));
oauthRoutes.use('/oauth/token', cors({ origin: '*' }));

const protectedResource = (c: { req: { url: string } }) => {
  const origin = new URL(c.req.url).origin;
  return { resource: `${origin}/mcp`, authorization_servers: [origin], scopes_supported: ['emera'], bearer_methods_supported: ['header'], resource_name: BRAND.name };
};
oauthRoutes.get('/.well-known/oauth-protected-resource', (c) => c.json(protectedResource(c)));
oauthRoutes.get('/.well-known/oauth-protected-resource/mcp', (c) => c.json(protectedResource(c)));
oauthRoutes.get('/.well-known/oauth-authorization-server', (c) => {
  const o = originOf(c);
  return c.json({
    issuer: o,
    authorization_endpoint: `${o}/oauth/authorize`,
    token_endpoint: `${o}/oauth/token`,
    registration_endpoint: `${o}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['emera'],
  });
});

oauthRoutes.post('/oauth/register', async (c) => {
  const body = await readJson(c);
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === 'string') : [];
  if (!uris.length || uris.length > 10 || !uris.every(okRedirect)) return c.json({ error: 'invalid_redirect_uri', error_description: 'Send 1 to 10 redirect_uris.' }, 400);
  const name = typeof body.client_name === 'string' && body.client_name.trim() ? body.client_name.trim().slice(0, 60) : 'An app';
  const id = `c_${newId(20)}`;
  const now = Date.now();
  await c.env.DB.prepare('INSERT INTO oauth_clients (id, name, redirect_uris, created_at) VALUES (?, ?, ?, ?)').bind(id, name, JSON.stringify(uris), now).run();
  return c.json({ client_id: id, client_id_issued_at: Math.floor(now / 1000), client_name: name, redirect_uris: uris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }, 201);
});

async function checkClient(env: Env, clientId: string, redirect: string): Promise<Client> {
  const client = await env.DB.prepare('SELECT * FROM oauth_clients WHERE id = ?').bind(clientId).first<Client>();
  if (!client) throw fail(400, 'invalid_client', 'This app is not registered with Emera. Reconnect it from the app.');
  if (!(JSON.parse(client.redirect_uris) as string[]).includes(redirect)) throw fail(400, 'invalid_redirect', 'This app sent a return link it did not register.');
  return client;
}

oauthRoutes.get('/oauth/authorize', async (c) => {
  const q = c.req.query();
  const client = await checkClient(c.env, q.client_id ?? '', q.redirect_uri ?? '');
  if (q.response_type !== 'code' || !q.code_challenge || (q.code_challenge_method ?? 'plain') !== 'S256') {
    const u = new URL(q.redirect_uri); u.searchParams.set('error', 'invalid_request'); u.searchParams.set('error_description', 'Use response_type=code with an S256 code_challenge.'); if (q.state) u.searchParams.set('state', q.state);
    return c.redirect(u.toString());
  }
  const params = JSON.stringify({ client_id: client.id, redirect_uri: q.redirect_uri, code_challenge: q.code_challenge, state: q.state ?? null });
  return c.html(authorizePage(client.name, params));
});

oauthRoutes.post('/oauth/approve', requireAuth, async (c) => {
  const body = await readJson(c);
  const me = c.get('user');
  if (!me.handle) throw fail(403, 'handle_required', 'Pick a handle first.');
  const client = await checkClient(c.env, String(body.client_id ?? ''), String(body.redirect_uri ?? ''));
  const code = newToken();
  await c.env.DB.prepare('INSERT INTO oauth_codes (code_hash, client_id, user_id, redirect_uri, challenge, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(await sha256Hex(code), client.id, me.id, body.redirect_uri, String(body.code_challenge ?? ''), Date.now() + CODE_TTL_MS).run();
  await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(c.req.header('Authorization')!.slice(7).trim())).run();
  const u = new URL(String(body.redirect_uri));
  u.searchParams.set('code', code);
  if (typeof body.state === 'string') u.searchParams.set('state', body.state);
  return c.json({ redirect: u.toString() });
});

oauthRoutes.post('/oauth/token', async (c) => {
  const ct = c.req.header('content-type') ?? '';
  const f: Record<string, string> = ct.includes('json') ? await c.req.json().catch(() => ({})) : (await c.req.parseBody()) as Record<string, string>;
  const now = Date.now();
  if (f.grant_type === 'authorization_code') {
    const row = await c.env.DB.prepare('SELECT * FROM oauth_codes WHERE code_hash = ?').bind(await sha256Hex(f.code ?? '')).first<{ code_hash: string; client_id: string; user_id: string; redirect_uri: string; challenge: string; expires_at: number }>();
    if (row) await c.env.DB.prepare('DELETE FROM oauth_codes WHERE code_hash = ?').bind(row.code_hash).run();
    if (!row || row.expires_at < now) return tokenError('invalid_grant', 'That code expired. Connect again.');
    if ((f.client_id && f.client_id !== row.client_id) || (f.redirect_uri && f.redirect_uri !== row.redirect_uri)) return tokenError('invalid_grant', 'Code was issued to another app.');
    if (!f.code_verifier || (await s256(f.code_verifier)) !== row.challenge) return tokenError('invalid_grant', 'code_verifier does not match.');
    return c.json(await issue(c.env, row.client_id, row.user_id), 200, { 'Cache-Control': 'no-store' });
  }
  if (f.grant_type === 'refresh_token') {
    const hash = await sha256Hex(f.refresh_token ?? '');
    const row = await c.env.DB.prepare('SELECT * FROM oauth_refresh WHERE token_hash = ?').bind(hash).first<{ client_id: string; user_id: string; expires_at: number }>();
    if (!row || row.expires_at < now || (f.client_id && f.client_id !== row.client_id)) return tokenError('invalid_grant', 'Sign in again.');
    await c.env.DB.prepare('DELETE FROM oauth_refresh WHERE token_hash = ?').bind(hash).run();
    return c.json(await issue(c.env, row.client_id, row.user_id), 200, { 'Cache-Control': 'no-store' });
  }
  return c.json({ error: 'unsupported_grant_type' }, 400);
});

function authorizePage(clientName: string, params: string): string {
  const { bg, ink, accent } = BRAND.colors;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect ${esc(clientName)} to ${BRAND.name}</title>
<style>*{box-sizing:border-box;margin:0}body{background:${bg};color:${ink};font:16px/1.4 -apple-system,system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:16px}
main{width:100%;max-width:380px;background:#fff;border-radius:20px;padding:28px;box-shadow:0 10px 40px #2a1d1414}h1{font-size:22px;line-height:1.2;margin-bottom:6px}p{color:#7a6a5c;font-size:14.5px;margin-bottom:18px}
input{width:100%;font:inherit;padding:12px 14px;border:1px solid #e6dccd;border-radius:12px;margin-bottom:10px}button{width:100%;font-family:inherit;font-size:16px;font-weight:600;padding:13px;border:0;border-radius:12px;background:${ink};color:#fff;cursor:pointer}
button.alt{background:none;color:#7a6a5c;font-weight:500;margin-top:6px}.err{color:#b4441f;font-size:14px;min-height:20px;margin-top:6px}.rows{margin:-6px 0 16px}.row{display:grid;grid-template-columns:92px 1fr;gap:10px;padding:10px 0;border-top:1px solid #efe6d8;font-size:14.5px;line-height:1.4}.row b{font-weight:600}.row span{color:#5c4d40}.mark{font-weight:800;color:${accent};letter-spacing:-.02em;margin-bottom:18px}</style></head>
<body><main><div class="mark">${BRAND.name}</div>
<form id="f"><h1 id="h">Connect ${esc(clientName)}</h1><p id="p">Sign in to let it import and post for you. We email you a 6-digit code.</p><div id="fields"><input id="email" type="email" autocomplete="email" placeholder="Your email" required></div><button id="go">Send code</button><div class="err" id="err"></div></form></main>
<script>
const P=${JSON.stringify(params)},Q=JSON.parse(P),$=(i)=>document.getElementById(i);let step='email',email='',token='',user=null;
async function api(path,body,auth){const r=await fetch(path,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},auth?{Authorization:'Bearer '+auth}:{}),body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error?.message||'Something went wrong. Try again.');return j}
function show(h,p,fields,btn){$('h').textContent=h;$('p').textContent=p;$('fields').innerHTML=fields;$('go').textContent=btn;const i=$('fields').querySelector('input');if(i)i.focus()}
function allow(){step='allow';show(${JSON.stringify(`Let ${clientName} bring your posts to ${BRAND.name}`)},'You can disconnect it any time.','<div class="rows"><div class="row"><b>Reads from</b><span>Bluesky, Mastodon, Pixelfed or your blog. Read only: it never posts, edits or deletes anything there.</span></div><div class="row"><b>Posts to</b><span>@'+user.handle+' on ${BRAND.name}, and nowhere else.</span></div></div>','Allow')}
$('f').onsubmit=async(e)=>{e.preventDefault();$('err').textContent='';$('go').disabled=true;try{
if(step==='email'){email=$('email').value.trim();await api('/v1/auth/start',{email});step='code';show('Check your email','Enter the 6-digit code we sent to '+email+'.','<input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code" required>','Continue')}
else if(step==='code'){const r=await api('/v1/auth/verify',{email,code:$('code').value.trim()});token=r.token;user=r.user;if(user.handle)allow();else{step='handle';show('Pick your name','This is how people find you on ${BRAND.name}.','<input id="name" placeholder="Your name" required><input id="handle" placeholder="handle" required>','Continue');$('name').oninput=()=>{$('handle').value=$('name').value.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,20)}}}
else if(step==='handle'){const r=await api('/v1/auth/handle',{handle:$('handle').value.trim(),displayName:$('name').value.trim()},token);user=r.user;allow()}
else{const r=await api('/oauth/approve',Q,token);location.href=r.redirect}}catch(x){$('err').textContent=x.message}finally{$('go').disabled=false}};
</script></body></html>`;
}
