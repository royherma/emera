export const ADMIN_HTML = String.raw`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Emera admin</title><link rel="icon" href="data:,">
<style>
:root{--bg:#fbf5ea;--card:#fffaf1;--ink:#2a1d14;--ink2:#6b5846;--ink3:#9a8672;--line:rgba(60,35,10,.12);--sun:#ff8a2b;--sun2:#ffc24a;--sunink:#9a4a00;--ok:#2f7d4f;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#0c0a09;--card:#1a1613;--ink:#fbf3e8;--ink2:#bcae9d;--ink3:#8a7c6d;--line:rgba(255,235,210,.12);--sunink:#ffc98a;--ok:#7fd3a0;--bad:#ff8a80}}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--ink);font:13px/1.35 ui-sans-serif,system-ui,-apple-system,"DM Sans",sans-serif;height:100vh;min-height:720px;display:flex;flex-direction:column}
header{display:flex;align-items:center;gap:14px;padding:10px 18px;border-bottom:1px solid var(--line)}
header b{font:700 17px/1 ui-sans-serif,system-ui;letter-spacing:-.03em}
header .sp{flex:1}header a{color:var(--sunink);text-decoration:none;font-weight:600}
.muted{color:var(--ink3)}
main{flex:1;display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:10px;padding:10px 18px 14px;min-height:0}
.tiles{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 12px}
.tile .n{font:700 24px/1.1 ui-sans-serif,system-ui;letter-spacing:-.03em}
.tile .l{color:var(--ink2);font-size:12px}.tile .t{color:var(--ink3);font-size:11px}
.mid{display:grid;grid-template-columns:1.1fr 2fr 1fr;gap:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-height:0;display:flex;flex-direction:column}
.card h2{margin:0 0 8px;font:700 13px/1 ui-sans-serif,system-ui;display:flex;gap:8px;align-items:baseline}
.card h2 span{font-weight:400;color:var(--ink3)}
.fun{display:grid;grid-template-columns:110px 1fr 70px;gap:6px 8px;align-items:center}
.bar{height:16px;border-radius:4px;background:linear-gradient(90deg,var(--sun2),var(--sun))}
.drop{color:var(--bad);font-weight:700}
.chart{display:grid;grid-template-columns:64px 1fr 40px;gap:4px 8px;align-items:end}
.spark{display:flex;gap:2px;align-items:flex-end;height:30px}
.spark i{flex:1;background:var(--sun);border-radius:2px 2px 0 0;min-height:1px;opacity:.85}
.spark i.z{background:var(--line)}
.days{display:flex;justify-content:space-between;color:var(--ink3);font-size:10px;grid-column:2}
.lists{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;min-height:0}
.scroll{overflow:auto;flex:1;min-height:0}
table{width:100%;border-collapse:collapse}
td{padding:5px 4px;border-top:1px solid var(--line);vertical-align:top}
tr.test td{opacity:.45}
.tag{display:inline-block;font-size:10px;padding:1px 5px;border-radius:4px;background:var(--line);color:var(--ink2);margin-left:4px}
.h{font-weight:700}.sm{font-size:11.5px;color:var(--ink2)}
a.r{color:inherit}
#gate{display:none;margin:80px auto;max-width:360px;text-align:center}
#gate input{width:100%;padding:10px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit}
label.tg{display:flex;gap:6px;align-items:center;color:var(--ink2);cursor:pointer}
</style></head><body>
<header><b>Emera admin</b><span class="muted" id="upd">loading</span><span class="sp"></span>
<label class="tg"><input type="checkbox" id="showTest" checked> show you + test accounts</label>
<a href="/ledger">Public ledger</a></header>
<div id="gate"><p>Paste the admin key</p><input id="key" type="password" autocomplete="off"><p class="muted" id="gmsg"></p></div>
<main id="app" hidden>
<section class="tiles" id="tiles"></section>
<section class="mid">
<div class="card"><h2>Funnel <span>last 30 days, real people only</span></h2><div class="fun" id="funnel"></div></div>
<div class="card"><h2>Per day <span>Bangkok days, last 30</span></h2><div class="chart" id="chart"></div></div>
<div class="card"><h2>Where visitors came from <span>30 days</span></h2><div id="sources"></div></div>
</section>
<section class="lists">
<div class="card"><h2>Accounts <span id="na"></span></h2><div class="scroll"><table id="accounts"></table></div></div>
<div class="card"><h2>Early list <span id="ne"></span></h2><div class="scroll"><table id="early"></table></div></div>
<div class="card"><h2>Visitors <span>latest 60</span></h2><div class="scroll"><table id="visitors"></table></div></div>
<div class="card"><h2>Posts, reports, flags</h2><div class="scroll"><table id="posts"></table></div></div>
</section>
</main>
<script>
var K="emera_admin_key",data=null;
function store(){try{return localStorage}catch(e){return{getItem:function(){return null},setItem:function(){}}}}
var m=location.hash.match(/key=([\w-]+)/);if(m){store().setItem(K,m[1]);history.replaceState(null,"",location.pathname)}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function bkk(ms){return new Date(ms).toLocaleString("en-US",{timeZone:"Asia/Bangkok",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}
function ago(ms){var s=(Date.now()-ms)/1000;if(s<90)return"just now";if(s<5400)return Math.round(s/60)+" min ago";if(s<129600)return Math.round(s/3600)+" h ago";return Math.round(s/86400)+" d ago"}
function tile(n,l,t){return'<div class="tile"><div class="n">'+n+'</div><div class="l">'+l+'</div><div class="t">'+(t||"&nbsp;")+'</div></div>'}
function rows(list,f){var show=document.getElementById("showTest").checked;return list.filter(function(x){return show||!x.test}).map(function(x){return'<tr class="'+(x.test?"test":"")+'">'+f(x)+"</tr>"}).join("")||'<tr><td class="muted">nothing yet</td></tr>'}
function test(x){return x.test?'<span class="tag">test</span>':""}
function render(){
var d=data,t=d.totals;
document.getElementById("upd").textContent="updated "+bkk(d.at)+" Bangkok";
document.getElementById("tiles").innerHTML=[
tile(t.visitors30,"visitors","last 30 days"),tile(t.early,"early list",t.earlyTest?"+"+t.earlyTest+" test":""),
tile(t.accounts,"accounts",t.accountsTest?"+"+t.accountsTest+" test":""),tile(t.posts,"posts",t.postsTest?"+"+t.postsTest+" test":""),
tile(t.likes,"likes"),tile(t.comments,"comments"),tile(t.follows,"follows"),tile(t.reportsOpen+" / "+t.flagsOpen,"open reports / flags")].join("");
var top=Math.max(1,d.funnel[0][1]),worst=-1,wi=-1;
for(var i=1;i<d.funnel.length;i++){var prev=d.funnel[i-1][1];var lost=prev?1-d.funnel[i][1]/prev:0;if(prev&&lost>worst){worst=lost;wi=i}}
document.getElementById("funnel").innerHTML=d.funnel.map(function(f,i){var pct=i?(d.funnel[i-1][1]?Math.round(100*f[1]/d.funnel[i-1][1])+"%":"-"):"";
return'<div>'+f[0]+'</div><div class="bar" style="width:'+Math.max(2,100*f[1]/top)+'%"></div><div><b>'+f[1]+'</b> <span class="'+(i===wi?"drop":"muted")+'">'+pct+'</span></div>'}).join("")+(wi>0?'<div class="sm" style="grid-column:1/4">Biggest drop: '+d.funnel[wi-1][0]+' to '+d.funnel[wi][0]+'</div>':"");
var names={visitors:"visitors",early:"early list",accounts:"accounts",posts:"posts"};
document.getElementById("chart").innerHTML=Object.keys(names).map(function(k){var s=d.daily[k],mx=Math.max(1,Math.max.apply(null,s)),sum=s.reduce(function(a,b){return a+b},0);
return'<div class="sm">'+names[k]+'</div><div class="spark">'+s.map(function(v,i){return'<i class="'+(v?"":"z")+'" style="height:'+(v?Math.max(8,100*v/mx):4)+'%" title="'+d.days[i]+": "+v+'"></i>'}).join("")+'</div><div><b>'+sum+'</b></div>'}).join("")+'<div class="days"><span>'+d.days[0]+'</span><span>today</span></div>';
document.getElementById("sources").innerHTML='<table>'+(d.sources.map(function(s){return"<tr><td>"+esc(s[0])+'</td><td style="text-align:right"><b>'+s[1]+"</b></td></tr>"}).join("")||'<tr><td class="muted">no visits yet</td></tr>')+"</table>";
document.getElementById("na").textContent=d.accounts.filter(function(x){return!x.test}).length+" real";
document.getElementById("ne").textContent=d.early.filter(function(x){return!x.test}).length+" real";
document.getElementById("accounts").innerHTML=rows(d.accounts,function(a){return'<td><div class="h">'+(a.handle?'<a class="r" target="_blank" href="/@'+esc(a.handle)+'">@'+esc(a.handle)+"</a>":'<span class="muted">no handle</span>')+test(a)+'</div><div class="sm">'+esc(a.name)+" "+esc(a.email)+'</div><div class="sm">'+bkk(a.at)+" · "+a.posts+" posts"+(a.early?" · was on early list":"")+"</div></td>"});
document.getElementById("early").innerHTML=rows(d.early,function(e){return'<td><div class="h">'+esc(e.email)+test(e)+'</div><div class="sm">'+bkk(e.at)+(e.place?" · "+esc(e.place):"")+'</div><div class="sm">'+esc(e.device||"")+(e.source?" · form "+esc(e.source):"")+"</div></td>"});
document.getElementById("visitors").innerHTML=rows(d.visitors,function(v){return'<td><div class="h">'+esc(v.place||"somewhere")+' <span class="sm">'+ago(v.last)+'</span></div><div class="sm">'+esc(v.source)+" · "+esc(v.device||"")+'</div><div class="sm">'+v.pages.length+" pages: "+esc(v.pages.slice(0,4).join(" "))+"</div></td>"});
var feed=d.posts.map(function(p){return{test:p.test,at:p.at,html:'<div class="h">🖼️ <a class="r" target="_blank" href="/p/'+esc(p.id)+'">post</a> by @'+esc(p.handle)+test(p)+'</div><div class="sm">'+esc(p.caption)+'</div><div class="sm">'+bkk(p.at)+(p.media?" · "+esc(p.media):"")+"</div>"}})
.concat(d.reports.map(function(r){return{test:r.test,at:r.at,html:'<div class="h">🚨 copy report by @'+esc(r.handle)+' <span class="tag">'+esc(r.status)+"</span>"+test(r)+'</div><div class="sm"><a class="r" target="_blank" href="'+esc(r.copy_url)+'">'+esc(r.copy_url)+'</a></div><div class="sm">'+bkk(r.at)+"</div>"}}))
.concat(d.flags.map(function(f){return{test:f.test,at:f.at,html:'<div class="h">🚩 '+esc(f.reason)+" on "+esc(f.target)+' <span class="tag">'+esc(f.status)+"</span>"+test(f)+'</div><div class="sm">by @'+esc(f.handle)+" · "+bkk(f.at)+"</div>"}})).sort(function(a,b){return b.at-a.at});
document.getElementById("posts").innerHTML=rows(feed,function(x){return"<td>"+x.html+"</td>"});
}
function load(){var key=store().getItem(K);if(!key){gate();return}
fetch("/admin/data",{headers:{"x-admin-key":key}}).then(function(r){if(r.status===401){gate("That key did not work");return null}return r.json()}).then(function(j){if(!j)return;data=j;document.getElementById("gate").style.display="none";document.getElementById("app").hidden=false;render()}).catch(function(e){document.getElementById("upd").textContent="could not load: "+e})}
function gate(msg){document.getElementById("app").hidden=true;document.getElementById("gate").style.display="block";document.getElementById("gmsg").textContent=msg||""}
document.getElementById("key").addEventListener("change",function(e){store().setItem(K,e.target.value.trim());load()});
document.getElementById("showTest").addEventListener("change",function(){if(data)render()});
load();setInterval(load,60000);
</script></body></html>`;
