import { Hono, type MiddlewareHandler } from 'hono';
import type { AppEnv } from './env';
import { requireAuth } from './auth';
import { fail, originOf, readJson } from './http';
import { isAdmin } from './roles';

const ACTIONS = { resolve: 'resolved', dismiss: 'dismissed' } as const;
const OPEN_REPORT = `r.status IN ('new', 'sent', 'filing')`;

const requireMod: MiddlewareHandler<AppEnv> = async (c, next) => {
  const u = c.get('user');
  if (u.role !== 'mod' && !isAdmin(c.env, u)) throw fail(403, 'not_moderator', 'Only moderators can see the queue.');
  await next();
};

type ReportItem = { id: string; post_id: string; copy_url: string; note: string; status: string; created_at: number; reporter: string | null; thumb_key: string | null };
type FlagItem = { id: string; target_type: string; target_id: string; reason: string; note: string; status: string; created_at: number; reporter: string | null };

export const modQueueRoutes = new Hono<AppEnv>();

modQueueRoutes.get('/v1/mod/queue', requireAuth, requireMod, async (c) => {
  const origin = originOf(c);
  const reports = (await c.env.DB.prepare(
    `SELECT r.id, r.post_id, r.copy_url, r.note, r.status, r.created_at, u.handle AS reporter,
       (SELECT COALESCE(m.poster_key, m.r2_key) FROM media m WHERE m.post_id = r.post_id ORDER BY m.position LIMIT 1) AS thumb_key
     FROM reports r LEFT JOIN users u ON u.id = r.reporter_user_id WHERE ${OPEN_REPORT} ORDER BY r.created_at LIMIT 200`,
  ).all<ReportItem>()).results;
  const flags = (await c.env.DB.prepare(
    `SELECT f.id, f.target_type, f.target_id, f.reason, f.note, f.status, f.created_at, u.handle AS reporter
     FROM flags f LEFT JOIN users u ON u.id = f.reporter_user_id WHERE f.status = 'new' ORDER BY f.created_at LIMIT 200`,
  ).all<FlagItem>()).results;
  const items = [
    ...reports.map((r) => ({
      kind: 'report' as const, id: r.id, reason: 'copy', note: r.note, reporter: r.reporter, createdAt: r.created_at,
      target: { type: 'post', id: r.post_id, url: `${origin}/p/${r.post_id}` }, copyUrl: r.copy_url,
      thumbUrl: r.thumb_key ? `${origin}/media/${r.thumb_key}` : null,
    })),
    ...flags.map((f) => ({
      kind: 'flag' as const, id: f.id, reason: f.reason, note: f.note, reporter: f.reporter, createdAt: f.created_at,
      target: { type: f.target_type, id: f.target_id, url: f.target_type === 'post' ? `${origin}/p/${f.target_id}` : null }, copyUrl: null, thumbUrl: null,
    })),
  ].sort((a, b) => a.createdAt - b.createdAt);
  return c.json({ items, counts: { reports: reports.length, flags: flags.length } });
});

modQueueRoutes.post('/v1/mod/queue/:kind/:id', requireAuth, requireMod, async (c) => {
  const kind = c.req.param('kind');
  if (kind !== 'report' && kind !== 'flag') throw fail(404, 'not_found', 'No such queue item.');
  const action = (await readJson(c)).action;
  if (typeof action !== 'string' || !(action in ACTIONS)) throw fail(400, 'bad_action', 'Action must be resolve or dismiss.');
  const status = ACTIONS[action as keyof typeof ACTIONS];
  const now = Date.now();
  const me = c.get('user').id;
  const sql = kind === 'report'
    ? `UPDATE reports SET status = ?, resolved_by = ?, resolved_at = ?, updated_at = ? WHERE id = ? AND ${OPEN_REPORT.replace('r.status', 'status')}`
    : `UPDATE flags SET status = ?, resolved_by = ?, resolved_at = ? WHERE id = ? AND status = 'new'`;
  const args = kind === 'report' ? [status, me, now, now, c.req.param('id')] : [status, me, now, c.req.param('id')];
  const done = await c.env.DB.prepare(sql).bind(...args).run();
  if (!done.meta.changes) throw fail(404, 'not_found', 'Not in the queue (already handled or no such item).');
  return c.json({ item: { kind, id: c.req.param('id'), status, resolvedBy: me, resolvedAt: now } });
});

modQueueRoutes.get('/mod', (c) => c.html(PAGE));

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Moderation queue</title><meta name="robots" content="noindex">
<style>
:root{--bg:#f6f4ef;--card:#fff;--ink:#1d1b18;--mute:#6f6a62;--line:#e4dfd6;--rep:#b4441f;--flag:#7a4fb8;--ok:#2f7a4a}
@media (prefers-color-scheme:dark){:root{--bg:#141311;--card:#1e1c19;--ink:#f1ede6;--mute:#a19a8f;--line:#2f2c27}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.4 system-ui,-apple-system,sans-serif}
header{display:flex;align-items:center;gap:16px;padding:16px 24px;border-bottom:1px solid var(--line)}
h1{font-size:20px;margin:0}.counts{color:var(--mute)}#who{margin-left:auto;color:var(--mute);font-size:13px}
main{padding:20px 24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;gap:12px}
.thumb{width:84px;height:84px;border-radius:8px;object-fit:cover;background:var(--line);flex:none}
.body{flex:1;min-width:0}.tag{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.report .tag{color:var(--rep)}.flag .tag{color:var(--flag)}
.note{margin:6px 0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.meta{color:var(--mute);font-size:13px}.meta a{color:inherit}
.acts{display:flex;gap:8px;margin-top:10px}button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:6px 12px;font:inherit;cursor:pointer}
button.res{background:var(--ok);border-color:var(--ok);color:#fff}
.empty,.err{padding:40px 24px;color:var(--mute)}form{padding:40px 24px;display:flex;gap:8px}input{flex:1;max-width:480px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)}
</style></head><body>
<header><h1>Moderation queue</h1><span class="counts" id="counts"></span><span id="who"></span></header>
<div id="root"></div>
<script>
const K='emera.mod.token';const root=document.getElementById('root');
const tok=()=>{try{return localStorage.getItem(K)}catch{return null}};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ago=t=>{const m=Math.round((Date.now()-t)/60000);return m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago'};
async function api(p,o={}){const r=await fetch(p,{...o,headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok()}});return{status:r.status,body:await r.json().catch(()=>({}))}}
function signin(msg){root.innerHTML='<form id="f"><input id="t" placeholder="Session token" autocomplete="off"><button>Open queue</button></form>'+(msg?'<p class="err">'+esc(msg)+'</p>':'');
document.getElementById('f').onsubmit=e=>{e.preventDefault();try{localStorage.setItem(K,document.getElementById('t').value.trim())}catch{}load()}}
async function act(kind,id,action,el){el.closest('.card').style.opacity=.4;const r=await api('/v1/mod/queue/'+kind+'/'+id,{method:'POST',body:JSON.stringify({action})});if(r.status===200)load();else alert(r.body.error?.message||r.status)}
async function load(){if(!tok())return signin();const r=await api('/v1/mod/queue');
if(r.status===401)return signin('That sign-in has expired.');if(r.status===403)return signin('This account is not a moderator.');
const me=await api('/v1/me');document.getElementById('who').textContent=me.body.user?'@'+me.body.user.handle+' · '+(me.body.user.role||'member'):'';
document.getElementById('counts').textContent=r.body.counts.reports+' reports · '+r.body.counts.flags+' flags open';
if(!r.body.items.length){root.innerHTML='<p class="empty">Nothing open.</p>';return}
root.innerHTML='<main>'+r.body.items.map(i=>'<div class="card '+i.kind+'">'+(i.thumbUrl?'<img class="thumb" src="'+esc(i.thumbUrl)+'" alt="">':'<div class="thumb"></div>')+
'<div class="body"><div class="tag">'+(i.kind==='report'?'Copy report':'Flag · '+esc(i.reason))+'</div><div class="note">'+(esc(i.note)||'<span class="meta">No note</span>')+'</div>'+
'<div class="meta">@'+esc(i.reporter||'?')+' · '+ago(i.createdAt)+' · '+(i.target.url?'<a href="'+esc(i.target.url)+'" target="_blank">'+esc(i.target.type)+'</a>':esc(i.target.type)+' '+esc(i.target.id))+(i.copyUrl?' · <a href="'+esc(i.copyUrl)+'" target="_blank" rel="noopener">the copy</a>':'')+'</div>'+
'<div class="acts"><button class="res" onclick="act(\\''+i.kind+'\\',\\''+esc(i.id)+'\\',\\'resolve\\',this)">Resolve</button><button onclick="act(\\''+i.kind+'\\',\\''+esc(i.id)+'\\',\\'dismiss\\',this)">Dismiss</button></div></div></div>').join('')+'</main>'}
load();
</script></body></html>`;
