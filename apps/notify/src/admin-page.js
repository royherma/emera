export const ADMIN_HTML = String.raw`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Emera admin</title><link rel="icon" href="data:,">
<style>
:root{--bg:#fbf5ea;--card:#fffaf1;--head:#f6edde;--hover:rgba(255,138,43,.08);--ink:#2a1d14;--ink2:#6b5846;--ink3:#9a8672;--line:rgba(60,35,10,.12);--sun:#ff8a2b;--sun2:#ffc24a;--sunink:#9a4a00;--ok:#2f7d4f;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#0c0a09;--card:#1a1613;--head:#221d19;--hover:rgba(255,160,70,.09);--ink:#fbf3e8;--ink2:#bcae9d;--ink3:#8a7c6d;--line:rgba(255,235,210,.12);--sunink:#ffc98a;--ok:#7fd3a0;--bad:#ff8a80}}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--ink);font:13px/1.35 ui-sans-serif,system-ui,-apple-system,"DM Sans",sans-serif;height:100vh;min-height:720px;display:flex;flex-direction:column;font-variant-numeric:tabular-nums}
header{display:flex;align-items:center;gap:14px;padding:9px 18px;border-bottom:1px solid var(--line)}
header b{font:700 16px/1 ui-sans-serif,system-ui;letter-spacing:-.03em}
header .sp{flex:1}header a{color:var(--sunink);text-decoration:none;font-weight:600}
.muted{color:var(--ink3)}
nav{display:flex;gap:2px;padding:0 14px;border-bottom:1px solid var(--line);background:var(--card)}
nav button{font:inherit;font-weight:600;color:var(--ink2);background:none;border:0;border-bottom:2px solid transparent;padding:9px 12px 8px;cursor:pointer;display:flex;gap:6px;align-items:center;margin-bottom:-1px}
nav button:hover{color:var(--ink)}
nav button.on{color:var(--ink);border-bottom-color:var(--sun)}
nav .k{font:600 10px/1 ui-monospace,Menlo,monospace;color:var(--ink3);border:1px solid var(--line);border-radius:3px;padding:2px 4px}
.bd{font-size:11px;font-weight:700;min-width:18px;text-align:center;padding:1px 6px;border-radius:9px;background:var(--line);color:var(--ink2)}
.bd.hot{background:var(--sun);color:#2a1300}
.bd:empty{display:none}
main{flex:1;min-height:0;overflow:auto;padding:10px 18px 14px}
.panel{display:none;height:100%;min-height:560px;gap:10px}
.panel.on{display:grid}
.tiles{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}
.tiles.c6{grid-template-columns:repeat(6,1fr)}.tiles.c4{grid-template-columns:repeat(4,1fr)}
.tile{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 12px}
.tile .n{font:700 23px/1.1 ui-sans-serif,system-ui;letter-spacing:-.03em}
.tile .l{color:var(--ink2);font-size:12px;font-weight:600}.tile .t{color:var(--ink3);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile.hot{border-color:var(--sun);background:linear-gradient(0deg,var(--hover),var(--hover)),var(--card);box-shadow:0 0 0 1px var(--sun) inset}
.tile.hot .n{color:var(--sunink)}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 0 0;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.card>h2,.card>.pad{padding-left:12px;padding-right:12px}
.card h2{margin:0 0 8px;font:700 13px/1 ui-sans-serif,system-ui;display:flex;gap:8px;align-items:baseline}
.card h2 span{font-weight:400;color:var(--ink3)}
.card .pad{padding-bottom:10px;overflow:auto;flex:1;min-height:0}
.g{display:grid;gap:10px;min-height:0}
.tbl{display:flex;flex-direction:column;flex:1;min-height:0}
.tb{display:flex;gap:8px;align-items:center;padding:0 12px 8px}
.tb input{flex:1;min-width:0;font:inherit;padding:4px 8px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--ink)}
.tb input:focus{outline:none;border-color:var(--sun)}
.tb .cnt{color:var(--ink3);font-size:11px;white-space:nowrap}
.scroll{overflow:auto;flex:1;min-height:0;border-top:1px solid var(--line)}
table{width:100%;border-collapse:separate;border-spacing:0}
th{position:sticky;top:0;z-index:1;background:var(--head);text-align:left;font:600 10.5px/1 ui-sans-serif,system-ui;letter-spacing:.05em;text-transform:uppercase;color:var(--ink2);padding:7px 8px;border-bottom:1px solid var(--line);white-space:nowrap;cursor:pointer;user-select:none}
th:hover{color:var(--ink)}
th.asc:after{content:" \25B4"}th.desc:after{content:" \25BE"}
th.ns{cursor:default}
td{padding:5px 8px;border-bottom:1px solid var(--line);vertical-align:middle;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
th.num,td.num{text-align:right}
tbody tr:hover td{background:var(--hover)}
tr.test td{opacity:.5}
td.empty{white-space:normal;color:var(--ink3);text-align:center;padding:22px 16px;max-width:none}
.tag{display:inline-block;font-size:10px;font-weight:600;padding:1px 6px;border-radius:4px;background:var(--line);color:var(--ink2);margin-left:4px;vertical-align:1px}
.tag.ok{background:rgba(47,125,79,.16);color:var(--ok)}.tag.bad{background:rgba(179,38,30,.14);color:var(--bad)}.tag.hot{background:rgba(255,138,43,.2);color:var(--sunink)}
.h{font-weight:600}.sm{font-size:11.5px;color:var(--ink2)}
a.r{color:inherit;text-decoration:none;border-bottom:1px solid var(--line)}a.r:hover{border-color:var(--sun)}
.thumb{width:28px;height:28px;object-fit:cover;border-radius:4px;background:var(--line);display:block}
.cell{display:flex;gap:8px;align-items:center}
button.b{font:inherit;font-size:11px;font-weight:600;padding:2px 8px;border-radius:5px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
button.b:hover{border-color:var(--sun)}button.b:disabled{opacity:.5}
button.b.pri{background:var(--sun);border-color:var(--sun);color:#2a1300}
button.b.dng:hover{border-color:var(--bad);color:var(--bad)}
.fun{display:grid;grid-template-columns:110px 1fr 70px;gap:8px;align-items:center}
.bar{height:16px;border-radius:4px;background:linear-gradient(90deg,var(--sun2),var(--sun))}
.drop{color:var(--bad);font-weight:700}
.chart{display:grid;grid-template-columns:100px 1fr 44px;gap:8px;align-items:end}
.spark{display:flex;gap:2px;align-items:flex-end;height:34px}
.spark i{flex:1;background:var(--sun);border-radius:2px 2px 0 0;min-height:1px;opacity:.85}
.spark i.z{background:var(--line)}
.days{display:flex;justify-content:space-between;color:var(--ink3);font-size:10px;grid-column:2}
.need{display:grid;grid-template-columns:34px 1fr auto;gap:2px 10px;align-items:center}
.need .c{font:700 18px/1 ui-sans-serif,system-ui;text-align:right;color:var(--ink3)}.need .c.hot{color:var(--sunink)}
.need div{padding:6px 0;border-bottom:1px solid var(--line)}
.meter{height:10px;border-radius:5px;background:var(--line);overflow:hidden;margin:8px 0 4px}.meter i{display:block;height:100%;background:linear-gradient(90deg,var(--sun2),var(--sun))}
.td{border-top:1px solid var(--line);padding:9px 0}.td:first-child{border-top:0;padding-top:0}
pre.notice{white-space:pre-wrap;font:11.5px/1.4 ui-monospace,Menlo,monospace;margin:6px 0;max-height:240px;overflow:auto;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:6px 8px}
#p-overview{grid-template-rows:auto auto 1fr}
#p-overview .g{grid-template-columns:1fr 1.5fr 1.4fr 1fr;height:265px}
#p-protect{grid-template-rows:auto 1.5fr 1fr}
#p-protect .r1{grid-template-columns:2fr 1fr}#p-protect .r2{grid-template-columns:1fr 1.4fr 1.2fr}
#p-takedowns{grid-template-rows:auto 1fr}#p-takedowns .g{grid-template-columns:1.1fr 1.4fr}
#p-people .g{grid-template-columns:1.2fr 1fr;grid-template-rows:1fr 1fr}#p-people .tall{grid-row:span 2}
#p-content .g{grid-template-columns:1.2fr 1fr;grid-template-rows:1fr 1fr}#p-content .tall{grid-row:span 2}
#p-money{grid-template-rows:auto 1fr}#p-money .g{grid-template-columns:1.2fr 1fr;grid-template-rows:1fr 1fr}#p-money .tall{grid-row:span 2}
#p-people,#p-content{grid-template-rows:1fr}
@media (max-width:1100px){.tiles{grid-template-columns:repeat(4,1fr)}.tiles.c6{grid-template-columns:repeat(3,1fr)}#p-overview .g,#p-protect .r1,#p-protect .r2,#p-takedowns .g,#p-people .g,#p-content .g,#p-money .g{grid-template-columns:1fr;grid-template-rows:none}.tall{grid-row:auto!important}.card{min-height:300px}.panel.on{height:auto}}
#gate{display:none;margin:80px auto;max-width:360px;text-align:center}
#gate input{width:100%;padding:10px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit}
label.tg{display:flex;gap:6px;align-items:center;color:var(--ink2);cursor:pointer}
</style></head><body>
<header><b>Emera admin</b><span class="muted" id="upd">loading</span><span class="sp"></span>
<label class="tg"><input type="checkbox" id="showTest" checked> show you + test accounts</label>
<a href="/ledger">Public ledger</a></header>
<nav id="tabs">
<button data-tab="overview"><span class="k">1</span>Overview<span class="bd" id="bd-overview"></span></button>
<button data-tab="protect"><span class="k">2</span>Protect<span class="bd" id="bd-protect"></span></button>
<button data-tab="takedowns"><span class="k">3</span>Takedowns<span class="bd" id="bd-takedowns"></span></button>
<button data-tab="people"><span class="k">4</span>People<span class="bd" id="bd-people"></span></button>
<button data-tab="content"><span class="k">5</span>Content<span class="bd" id="bd-content"></span></button>
<button data-tab="money"><span class="k">6</span>Money<span class="bd" id="bd-money"></span></button>
</nav>
<div id="gate"><p>Paste the admin key</p><input id="key" type="password" autocomplete="off"><p class="muted" id="gmsg"></p></div>
<main id="app" hidden>
<section class="panel" id="p-overview">
<div class="tiles" id="otiles"></div>
<div class="g">
<div class="card"><h2>Needs you</h2><div class="pad"><div class="need" id="need"></div></div></div>
<div class="card"><h2>Funnel <span>last 30 days, real people only</span></h2><div class="pad"><div class="fun" id="funnel"></div></div></div>
<div class="card"><h2>Per day <span>Bangkok days, last 30</span></h2><div class="pad"><div class="chart" id="chart"></div></div></div>
<div class="card"><h2>Where visitors came from <span>30 days</span></h2><div class="tbl" id="t-sources"></div></div>
</div>
<div class="card"><h2>Latest activity <span>everything new across the site, newest first</span></h2><div class="tbl" id="t-activity"></div></div>
</section>
<section class="panel" id="p-protect">
<div class="tiles c6" id="ptiles"></div>
<div class="g r1">
<div class="card"><h2>Paying creators <span id="npc"></span></h2><div class="tbl" id="t-creators"></div></div>
<div class="card"><h2>Copies found <span>latest 100</span></h2><div class="tbl" id="t-matches"></div></div>
</div>
<div class="g r2">
<div class="card"><h2>Scans budget <span id="scanmonth"></span></h2><div class="pad" id="scans"></div></div>
<div class="card"><h2>Paid, no account yet <span id="npp"></span></h2><div class="tbl" id="t-pending"></div></div>
<div class="card"><h2>Enterprise leads <span id="nel"></span></h2><div class="tbl" id="t-leads"></div></div>
</div>
</section>
<section class="panel" id="p-takedowns">
<div class="tiles c4" id="ktiles"></div>
<div class="g">
<div class="card"><h2>Waiting for you <span id="nkw"></span></h2><div class="pad" id="waiting"></div></div>
<div class="card"><h2>Sent, removed, still up <span id="nkh"></span></h2><div class="tbl" id="t-tdhist"></div></div>
</div>
</section>
<section class="panel" id="p-people"><div class="g">
<div class="card tall"><h2>Accounts <span id="na"></span></h2><div class="tbl" id="t-accounts"></div></div>
<div class="card"><h2>Started sign-up <span id="ne"></span></h2><div class="tbl" id="t-early"></div></div>
<div class="card"><h2>Visitors <span>latest 60</span></h2><div class="tbl" id="t-visitors"></div></div>
</div></section>
<section class="panel" id="p-content"><div class="g">
<div class="card tall"><h2>Posts <span id="nps"></span></h2><div class="tbl" id="t-posts"></div></div>
<div class="card"><h2>Copy reports <span id="nrp"></span></h2><div class="tbl" id="t-reports"></div></div>
<div class="card"><h2>Flags <span id="nfl"></span></h2><div class="tbl" id="t-flags"></div></div>
</div></section>
<section class="panel" id="p-money">
<div class="tiles c4" id="mtiles"></div>
<div class="g">
<div class="card tall"><h2>Sponsors <span>banner shows after Approve</span></h2><div class="tbl" id="t-sponsors"></div></div>
<div class="card"><h2>Sponsor checkouts <span id="nk"></span></h2><div class="tbl" id="t-checkouts"></div></div>
<div class="card"><h2>Protect revenue <span>paying plans</span></h2><div class="tbl" id="t-revenue"></div></div>
</div>
</section>
</main>
<script>
var K="emera_admin_key",data=null,pdata=null,tdata=null,TABS=["overview","protect","takedowns","people","content","money"];
function store(){try{return localStorage}catch(e){return{getItem:function(){return null},setItem:function(){}}}}
function hdr(){return{"x-admin-key":store().getItem(K)}}
var m=location.hash.match(/key=([\w-]+)/);if(m){store().setItem(K,m[1]);history.replaceState(null,"",location.pathname)}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function bkk(ms){return new Date(ms).toLocaleString("en-US",{timeZone:"Asia/Bangkok",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}
function ago(ms){var s=(Date.now()-ms)/1000;if(s<90)return"just now";if(s<5400)return Math.round(s/60)+" min ago";if(s<129600)return Math.round(s/3600)+" h ago";return Math.round(s/86400)+" d ago"}
function usd(n){return"$"+Number(n).toLocaleString("en-US",{maximumFractionDigits:2})}
function tile(n,l,t,hot){return'<div class="tile'+(hot?" hot":"")+'"><div class="n">'+n+'</div><div class="l">'+l+'</div><div class="t">'+(t||"&nbsp;")+'</div></div>'}
function test(x){return x.test?'<span class="tag">test</span>':""}
function stag(s){var c={removed:"ok",paid:"ok",approved:"ok",sent:"",ready:"hot",still_up:"bad",rejected:"bad",expired:"",pending:"hot",new:"hot"}[s];return'<span class="tag '+(c||"")+'">'+esc(s)+"</span>"}
function link(href,text,pre){return'<a class="r" target="_blank" rel="noopener" href="'+esc(href)+'">'+(pre||"")+esc(text)+"</a>"}
function until(ms){return ms?bkk(ms):"no end"}
function stripeLink(id){return id?link("https://dashboard.stripe.com/customers/"+id,id):'<span class="muted">none</span>'}
function handleLink(h){return h?link("/@"+h,h,"@"):'<span class="muted">no handle</span>'}
function show(){return document.getElementById("showTest").checked}

var T={};
function mount(id,cfg){
var el=document.getElementById(id);cfg.id=id;cfg.rows=[];cfg.q="";cfg.sk=cfg.sort?cfg.sort[0]:-1;cfg.sd=cfg.sort?cfg.sort[1]:1;T[id]=cfg;
el.innerHTML='<div class="tb"><input type="search" placeholder="Search" aria-label="Search"><span class="cnt"></span></div><div class="scroll"><table><thead><tr>'+cfg.cols.map(function(c,i){return'<th data-i="'+i+'" class="'+(c.n?"num":"")+(c.ns?" ns":"")+'">'+c.h+"</th>"}).join("")+'</tr></thead><tbody></tbody></table></div>';
el.querySelector("input").addEventListener("input",function(e){cfg.q=e.target.value.toLowerCase();draw(cfg)});
el.querySelector("thead").addEventListener("click",function(e){var th=e.target.closest("th");if(!th||cfg.cols[th.getAttribute("data-i")].ns)return;var i=+th.getAttribute("data-i");cfg.sd=cfg.sk===i?-cfg.sd:(cfg.cols[i].n?-1:1);cfg.sk=i;draw(cfg)});
}
function setRows(id,rows){var c=T[id];c.rows=rows;draw(c)}
function draw(c){
var el=document.getElementById(c.id),all=c.rows.filter(function(x){return show()||!x.test}),list=all;
if(c.q)list=list.filter(function(x){return(c.text?c.text(x):c.cols.map(function(k){return String(k.v(x))}).join(" ")).toLowerCase().indexOf(c.q)>=0});
if(c.sk>=0){var k=c.cols[c.sk],d=c.sd;list=list.slice().sort(function(a,b){var x=k.v(a),y=k.v(b);if(x==null)x=k.n?-Infinity:"";if(y==null)y=k.n?-Infinity:"";return(x<y?-1:x>y?1:0)*d})}
[].forEach.call(el.querySelectorAll("th"),function(th,i){th.className=(c.cols[i].n?"num":"")+(c.cols[i].ns?" ns":"")+(i===c.sk?(c.sd>0?" asc":" desc"):"")});
el.querySelector(".cnt").textContent=(c.q?list.length+" of ":"")+all.length;
el.querySelector("tbody").innerHTML=list.map(function(x){return'<tr class="'+(x.test?"test":"")+'">'+c.cols.map(function(k){return'<td class="'+(k.n?"num":"")+'">'+(k.r?k.r(x):esc(k.v(x)))+"</td>"}).join("")+"</tr>"}).join("")||'<tr><td class="empty" colspan="'+c.cols.length+'">'+(c.q?"Nothing matches that search.":esc(c.empty))+"</td></tr>";
}
function col(h,v,o){o=o||{};o.h=h;o.v=v;return o}

mount("t-sources",{cols:[col("Source",function(x){return x[0]}),col("Visits",function(x){return x[1]},{n:1})],sort:[1,-1],empty:"Visits and where they came from show up here once someone opens emera.social."});
mount("t-activity",{cols:[
col("When",function(x){return x.at},{r:function(x){return bkk(x.at)}}),col("What",function(x){return x.kind},{r:function(x){return'<span class="tag">'+esc(x.kind)+"</span>"}}),
col("Who",function(x){return x.who||""}),col("Detail",function(x){return x.detail||""})],sort:[0,-1],empty:"New accounts, posts, sign-ups, reports and flags show up here."});
mount("t-creators",{cols:[
col("Creator",function(x){return x.handle||x.email},{r:function(x){return'<div class="h">'+handleLink(x.handle)+test(x)+' <span class="tag">'+esc(x.plan)+'</span></div><div class="sm">'+esc(x.email)+"</div>"}}),
col("Paid until",function(x){return x.until||0},{r:function(x){return until(x.until)}}),
col("Works",function(x){return x.works},{n:1}),col("Scanned",function(x){return x.scanned},{n:1}),col("Copies",function(x){return x.found},{n:1}),col("Takedowns",function(x){return x.takedowns},{n:1}),
col("Last scan",function(x){return x.last||0},{r:function(x){return x.last?bkk(x.last):'<span class="muted">never</span>'}}),
col("Actions",function(){return""},{ns:1,r:function(x){return'<button class="b" data-pu="'+esc(x.id)+'" data-a="scan-now">Scan now</button> <button class="b" data-pu="'+esc(x.id)+'" data-a="give-plan" data-plan="creator" title="Give Creator for 30 days, free">+ Creator</button> <button class="b" data-pu="'+esc(x.id)+'" data-a="give-plan" data-plan="pro" title="Give Pro for 30 days, free">+ Pro</button> <button class="b dng" data-pu="'+esc(x.id)+'" data-a="end-plan" title="End this plan now">End</button>'}})],
sort:[1,-1],empty:"Creators on a Creator or Pro plan show up here with scan counts and plan actions."});
mount("t-matches",{cols:[
col("Copy",function(x){return x.site},{r:function(x){return'<div class="cell">'+(x.thumbnail?'<img class="thumb" loading="lazy" referrerpolicy="no-referrer" src="'+esc(x.thumbnail)+'" alt="">':'<div class="thumb"></div>')+'<div><div class="h">'+esc(x.site)+test(x)+'</div><div class="sm">@'+esc(x.handle||"?")+" · "+link(x.url,x.url.replace(/^https?:\/\//,"").replace(x.site,"").slice(0,24)||"/")+"</div></div></div>"}}),
col("Status",function(x){return x.status},{r:function(x){return stag(x.status)}}),
col("Found",function(x){return x.at},{r:function(x){return bkk(x.at)}}),
col("",function(){return""},{ns:1,r:function(x){return x.status==="new"?'<button class="b" data-pm="'+esc(x.id)+'">Dismiss</button>':""}})],
text:function(x){return[x.site,x.url,x.reason,x.handle,x.status].join(" ")},sort:[2,-1],empty:"Copies of creators' work found on other sites show up here, newest first."});
mount("t-pending",{cols:[
col("Email",function(x){return x.email},{r:function(x){return esc(x.email)+test(x)+' <span class="tag">'+esc(x.plan)+"</span>"}}),
col("Paid",function(x){return x.at},{r:function(x){return bkk(x.at)}}),
col("Until",function(x){return x.until||0},{r:function(x){return until(x.until)}}),
col("Stripe",function(x){return x.stripe||""},{r:function(x){return stripeLink(x.stripe)}})],sort:[1,-1],empty:"People who paid for Protect before making an account show up here."});
mount("t-leads",{cols:[
col("Lead",function(x){return x.name},{r:function(x){return'<div class="h">'+esc(x.name)+test(x)+'</div><div class="sm">'+esc(x.company)+" · "+esc(x.email)+"</div>"}}),
col("Creators",function(x){return x.creators||0},{n:1}),col("Place",function(x){return x.place||""}),col("When",function(x){return x.at},{r:function(x){return bkk(x.at)}})],
text:function(x){return[x.name,x.company,x.email,x.place].join(" ")},sort:[3,-1],empty:"Enterprise enquiries from the Protect page show up here."});
mount("t-tdhist",{cols:[
col("Creator",function(x){return x.handle},{r:function(x){return"@"+esc(x.handle)}}),
col("Site",function(x){return x.site},{r:function(x){return'<div class="h">'+esc(x.site)+'</div><div class="sm">'+link(x.url,x.url.replace(/^https?:\/\//,"").slice(0,40))+"</div>"}}),
col("Method",function(x){return x.method}),
col("Status",function(x){return x.status},{r:function(x){return stag(x.status)}}),
col("HTTP",function(x){return x.http||0},{n:1,r:function(x){return x.http||""}}),
col("Sent",function(x){return x.sentAt||x.at},{r:function(x){return bkk(x.sentAt||x.at)}}),
col("Check",function(x){return x.reason||""})],
text:function(x){return[x.handle,x.site,x.url,x.status,x.reason,x.method].join(" ")},sort:[5,-1],empty:"Takedowns you have sent show up here, with whether the copy came down."});
mount("t-accounts",{cols:[
col("Handle",function(x){return x.handle||""},{r:function(x){return handleLink(x.handle)+test(x)}}),
col("Name",function(x){return x.name||""}),col("Email",function(x){return x.email||""}),
col("Joined",function(x){return x.at},{r:function(x){return bkk(x.at)}}),col("Posts",function(x){return x.posts},{n:1})],sort:[3,-1],empty:"New accounts show up here."});
mount("t-early",{cols:[
col("Email",function(x){return x.email},{r:function(x){return esc(x.email)+test(x)}}),
col("When",function(x){return x.at},{r:function(x){return bkk(x.at)}}),col("Place",function(x){return x.place||""}),col("Device",function(x){return x.device||""}),col("Form",function(x){return x.source||""})],sort:[1,-1],empty:"People who typed their email on the landing page show up here."});
mount("t-visitors",{cols:[
col("Place",function(x){return x.place||"somewhere"}),col("Source",function(x){return x.source||""}),col("Device",function(x){return x.device||""}),
col("Pages",function(x){return x.pages.length},{n:1,r:function(x){return'<span title="'+esc(x.pages.join(" "))+'">'+x.pages.length+"</span>"}}),
col("Last seen",function(x){return x.last},{r:function(x){return ago(x.last)}})],text:function(x){return[x.place,x.source,x.device,x.pages.join(" ")].join(" ")},sort:[4,-1],empty:"Visitors show up here as people open emera.social."});
mount("t-posts",{cols:[
col("Post",function(x){return x.id},{r:function(x){return link("/p/"+x.id,"open")}}),
col("By",function(x){return x.handle||""},{r:function(x){return"@"+esc(x.handle)+test(x)}}),
col("Caption",function(x){return x.caption||""}),col("Media",function(x){return x.media||""}),
col("Posted",function(x){return x.at},{r:function(x){return bkk(x.at)}})],sort:[4,-1],empty:"New posts show up here."});
mount("t-reports",{cols:[
col("By",function(x){return x.handle||""},{r:function(x){return"@"+esc(x.handle||"?")+test(x)}}),
col("Copy",function(x){return x.copy_url},{r:function(x){return link(x.copy_url,x.copy_url.replace(/^https?:\/\//,"").slice(0,40))}}),
col("Status",function(x){return x.status},{r:function(x){return stag(x.status)}}),col("When",function(x){return x.at},{r:function(x){return bkk(x.at)}})],sort:[3,-1],empty:"Copies a creator reports by hand show up here."});
mount("t-flags",{cols:[
col("Target",function(x){return x.target}),col("Reason",function(x){return x.reason||""}),
col("By",function(x){return x.handle||""},{r:function(x){return"@"+esc(x.handle||"?")+test(x)}}),
col("Status",function(x){return x.status},{r:function(x){return stag(x.status)}}),col("When",function(x){return x.at},{r:function(x){return bkk(x.at)}})],sort:[4,-1],empty:"Posts and people that others flag show up here."});
mount("t-sponsors",{cols:[
col("Sponsor",function(x){return x.name},{r:function(x){return'<div class="h">'+(x.url?link(x.url,x.name):esc(x.name))+test(x)+'</div><div class="sm">'+esc(x.line||"no banner line")+"</div>"}}),
col("Banner",function(x){return x.banner},{r:function(x){return stag(x.banner)}}),
col("Paid",function(x){return x.paidCents},{n:1,r:function(x){return usd(x.paidCents/100)}}),
col("To",function(x){return x.lastMonth||""}),col("Email",function(x){return x.email||""}),
col("",function(){return""},{ns:1,r:function(x){return'<button class="b pri" data-sp="'+esc(x.id)+'" data-b="approved">Approve</button> <button class="b dng" data-sp="'+esc(x.id)+'" data-b="rejected">Reject</button>'}})],
text:function(x){return[x.name,x.line,x.email,x.banner].join(" ")},sort:[1,1],empty:"Sponsors who sign up for a banner show up here, waiting for Approve."});
mount("t-checkouts",{cols:[
col("Sponsor",function(x){return x.name},{r:function(x){return esc(x.name)+test(x)}}),
col("Status",function(x){return x.status},{r:function(x){return stag(x.status)}}),
col("Per mo",function(x){return x.monthlyCents},{n:1,r:function(x){return usd(x.monthlyCents/100)}}),col("Mo",function(x){return x.months},{n:1}),
col("Paid",function(x){return x.totalCents==null?-1:x.totalCents},{n:1,r:function(x){return x.totalCents!=null?usd(x.totalCents/100):""}}),
col("Code",function(x){return x.promo||""}),col("When",function(x){return x.at},{r:function(x){return bkk(x.at)}})],
text:function(x){return[x.name,x.email,x.status,x.promo].join(" ")},sort:[6,-1],empty:"Sponsor checkouts, paid or abandoned, show up here."});
mount("t-revenue",{cols:[
col("Creator",function(x){return x.handle||x.email},{r:function(x){return handleLink(x.handle)+test(x)+' <span class="tag">'+esc(x.plan)+"</span>"}}),
col("Per mo",function(x){return x.mrr},{n:1,r:function(x){return x.mrr?usd(x.mrr):'<span class="muted">comped</span>'}}),
col("Until",function(x){return x.until||0},{r:function(x){return until(x.until)}}),
col("Stripe",function(x){return x.stripe||""},{r:function(x){return stripeLink(x.stripe)}})],sort:[1,-1],empty:"Plans that bring in money show up here. Plans you give for free are marked comped."});

function sum(a){return a.reduce(function(x,y){return x+y},0)}
function counts(){
var c={td:0,copies:0,reports:0,sponsors:0,pending:0,leads:0};
if(tdata)c.td=tdata.filter(function(x){return x.status==="ready"}).length;
if(pdata){c.copies=pdata.tiles.copies.new;c.pending=pdata.tiles.pending;c.leads=pdata.tiles.leads;if(!tdata)c.td=pdata.tiles.takedowns.ready}
if(data){c.reports=data.totals.reportsOpen+data.totals.flagsOpen;c.sponsors=(data.sponsors||[]).filter(function(x){return x.banner==="pending"&&(show()||!x.test)}).length}
return c}
function badge(id,n,hot){var e=document.getElementById("bd-"+id);e.textContent=n>0?n:"";e.className="bd"+(hot&&n>0?" hot":"")}
function renderAll(){
var c=counts();
badge("protect",c.copies+c.pending);badge("takedowns",c.td,1);badge("content",c.reports);badge("money",c.sponsors,1);
if(pdata)renderP();if(data)renderData();renderTd();renderOverview(c)}
function renderOverview(c){
var t=data&&data.totals,p=pdata&&pdata.tiles,tiles=[];
if(p)tiles.push(tile(p.creator+p.pro,"paying creators",p.creator+" Creator · "+p.pro+" Pro"),tile(usd(p.revenue),"MRR","per month"+(p.revenueReal!==p.revenue?" · "+usd(p.revenueReal)+" real":"")),tile(p.copies.new,"copies found new",p.copies.reported+" reported · "+p.copies.dismissed+" dismissed"));
tiles.push(tile(c.td,"takedowns waiting","needs your approval",c.td>0));
if(data){tiles.push(tile(data.funnel[2][1],"signups 30d","accounts made"),tile(sum(data.daily.posts),"posts 30d",t.postsTest?"+"+t.postsTest+" test overall":""),tile(t.visitors30,"visitors","last 30 days"),tile(t.early,"started sign-up",t.earlyTest?"+"+t.earlyTest+" test":""))}
document.getElementById("otiles").innerHTML=tiles.join("");
var rows=[[c.td,"takedowns to approve","takedowns"],[c.copies,"new copies found","protect"],[c.pending,"paid, no account yet","protect"],[c.reports,"open reports and flags","content"],[c.sponsors,"banners to approve","money"],[c.leads,"Enterprise leads","protect"]];
var todo=rows.filter(function(r){return r[0]>0});
document.getElementById("need").innerHTML=(todo.length?todo:[]).map(function(r){return'<div class="c hot">'+r[0]+"</div><div>"+r[1]+'</div><div><button class="b" data-go="'+r[2]+'">Open</button></div>'}).join("")||'<div class="c">0</div><div>All clear. Takedowns, copies, reports and sponsors waiting on you show up here.</div><div></div>'}
function renderData(){
var d=data,t=d.totals;
document.getElementById("upd").textContent="updated "+bkk(d.at)+" Bangkok";
var top=Math.max(1,d.funnel[0][1]),worst=-1,wi=-1;
for(var i=1;i<d.funnel.length;i++){var prev=d.funnel[i-1][1];var lost=prev?1-d.funnel[i][1]/prev:0;if(prev&&lost>worst){worst=lost;wi=i}}
document.getElementById("funnel").innerHTML=d.funnel.map(function(f,i){var pct=i?(d.funnel[i-1][1]?Math.round(100*f[1]/d.funnel[i-1][1])+"%":"-"):"";
return'<div>'+f[0]+'</div><div class="bar" style="width:'+Math.max(2,100*f[1]/top)+'%"></div><div><b>'+f[1]+'</b> <span class="'+(i===wi?"drop":"muted")+'">'+pct+'</span></div>'}).join("")+(wi>0?'<div class="sm" style="grid-column:1/4">Biggest drop: '+d.funnel[wi-1][0]+' to '+d.funnel[wi][0]+'</div>':"");
var names={visitors:"visitors",early:"started sign-up",accounts:"accounts",posts:"posts"};
document.getElementById("chart").innerHTML=Object.keys(names).map(function(k){var s=d.daily[k],mx=Math.max(1,Math.max.apply(null,s));
return'<div class="sm">'+names[k]+'</div><div class="spark">'+s.map(function(v,i){return'<i class="'+(v?"":"z")+'" style="height:'+(v?Math.max(8,100*v/mx):4)+'%" title="'+d.days[i]+": "+v+'"></i>'}).join("")+'</div><div><b>'+sum(s)+'</b></div>'}).join("")+'<div class="days"><span>'+d.days[0]+'</span><span>today</span></div>';
setRows("t-sources",d.sources);
setRows("t-activity",d.accounts.map(function(x){return{at:x.at,test:x.test,kind:"account",who:x.handle?"@"+x.handle:x.email,detail:x.name||x.email}})
.concat(d.early.map(function(x){return{at:x.at,test:x.test,kind:"sign-up started",who:x.email,detail:x.place||""}}))
.concat(d.posts.map(function(x){return{at:x.at,test:x.test,kind:"post",who:"@"+x.handle,detail:x.caption}}))
.concat(d.reports.map(function(x){return{at:x.at,test:x.test,kind:"copy report",who:"@"+(x.handle||"?"),detail:x.copy_url}}))
.concat(d.flags.map(function(x){return{at:x.at,test:x.test,kind:"flag",who:"@"+(x.handle||"?"),detail:x.reason+" on "+x.target}})));
setRows("t-accounts",d.accounts);setRows("t-early",d.early);setRows("t-visitors",d.visitors);
document.getElementById("na").textContent=d.accounts.filter(function(x){return!x.test}).length+" real";
document.getElementById("ne").textContent=d.early.filter(function(x){return!x.test}).length+" real";
setRows("t-posts",d.posts);setRows("t-reports",d.reports);setRows("t-flags",d.flags);
document.getElementById("nps").textContent="latest "+d.posts.length;
document.getElementById("nrp").textContent=d.reports.filter(function(x){return x.status==="new"}).length+" open";
document.getElementById("nfl").textContent=d.flags.filter(function(x){return x.status==="new"}).length+" open";
setRows("t-sponsors",d.sponsors||[]);setRows("t-checkouts",d.checkouts||[]);
var ks=(d.checkouts||[]).filter(function(x){return!x.test}),kc=function(st){return ks.filter(function(x){return x.status===st}).length};
document.getElementById("nk").textContent=ks.length+" started · "+kc("paid")+" paid · "+kc("expired")+" left";
var sp=(d.sponsors||[]).filter(function(x){return!x.test}),pp=pdata&&pdata.tiles;
document.getElementById("mtiles").innerHTML=[
tile(pp?usd(pp.revenue):"-","Protect per month",pp?(pp.creator+pp.pro)+" paying · "+usd(pp.revenueReal)+" real":""),
tile(usd(sum(sp.map(function(x){return x.paidCents}))/100),"sponsor money paid",sp.length+" real sponsors"),
tile(sp.filter(function(x){return x.banner==="pending"}).length,"banners to approve","sponsors waiting",sp.some(function(x){return x.banner==="pending"})),
tile(kc("paid")+" / "+ks.length,"checkouts paid","of started")].join("")}
function renderP(){
var d=pdata,t=d.tiles,c=t.copies,k=t.takedowns;
document.getElementById("ptiles").innerHTML=[
tile(t.creator+t.pro,"paying creators",t.creator+" Creator · "+t.pro+" Pro"),
tile(usd(t.revenue),"per month","$10 Creator · $100 Pro"+(t.revenueReal!==t.revenue?" · "+usd(t.revenueReal)+" real":"")),
tile(t.pending,"paid, no account","waiting to sign up",t.pending>0),
tile(c.new+c.reported+c.dismissed,"copies found",c.new+" new · "+c.reported+" reported · "+c.dismissed+" dismissed",c.new>0),
tile(k.ready+" / "+k.sent+" / "+k.removed+" / "+k.still_up,"takedowns","waiting / sent / removed / still up",k.ready>0),
tile(t.leads,"Enterprise leads")].join("");
document.getElementById("npc").textContent=d.creators.filter(function(x){return!x.test}).length+" real";
setRows("t-creators",d.creators);setRows("t-matches",d.matches);
document.getElementById("npp").textContent=d.pending.length;setRows("t-pending",d.pending);
document.getElementById("nel").textContent=d.leads.length;setRows("t-leads",d.leads);
document.getElementById("scanmonth").textContent="month "+t.scanMonth;
var pct=Math.min(100,100*t.scans/Math.max(1,t.scanLimit));
document.getElementById("scans").innerHTML='<div class="n" style="font:700 24px/1.1 ui-sans-serif,system-ui">'+t.scans+' <span class="muted" style="font-size:14px;font-weight:400">of '+t.scanLimit+' searches</span></div><div class="meter"><i style="width:'+pct+'%"></i></div><div class="sm">'+(t.scans>=t.scanLimit?'<span class="drop">Budget used up. Scans stop until next month.</span>':(t.scanLimit-t.scans)+" left this month")+"</div>";
var plans={creator:10,pro:100};
setRows("t-revenue",d.creators.filter(function(x){return x.plan==="creator"||x.plan==="pro"}).map(function(x){var o={};for(var k2 in x)o[k2]=x[k2];o.mrr=x.stripe?plans[x.plan]||0:0;return o}))}
function renderTd(){
var list=tdata||[],vis=list.filter(function(x){return show()||!x.test});
var by=function(s){return list.filter(function(x){return x.status===s}).length},ready=list.filter(function(x){return x.status==="ready"});
document.getElementById("ktiles").innerHTML=[tile(ready.length,"waiting for you","approve, file or reject",ready.length>0),tile(by("sent"),"sent","email or form filed"),tile(by("removed"),"removed","copy came down"),tile(by("still_up"),"still up","copy did not come down",by("still_up")>0)].join("");
document.getElementById("nkw").textContent=ready.length+" to approve";
document.getElementById("nkh").textContent=(list.length-ready.length)+" so far";
document.getElementById("waiting").innerHTML=ready.map(function(x){
var act=(x.method==="email"&&x.target?'<button class="b pri" data-td="'+esc(x.id)+'" data-a="send-email">Send email</button> ':"")+'<button class="b" data-td="'+esc(x.id)+'" data-a="mark-filed">Mark form filed</button> <button class="b dng" data-td="'+esc(x.id)+'" data-a="reject">Reject</button>';
return'<div class="td"><div class="h">@'+esc(x.handle)+" to "+esc(x.site)+' <span class="tag">'+esc(x.method)+"</span></div>"
+'<div class="sm">'+(x.method==="email"?"email "+esc(x.target||"no contact"):'form '+link(x.target||"#",x.target||"no link, find the host page"))+" · "+esc(x.note)+"</div>"
+'<div class="sm">'+link(x.url,x.url)+" · "+bkk(x.at)+"</div>"
+'<pre class="notice">'+esc(x.notice)+"</pre><div>"+act+"</div></div>"}).join("")||'<div class="muted" style="padding:22px 4px;text-align:center">Nothing waiting. When a creator reports a copy, the notice we wrote shows up here for you to send, file or reject.</div>';
setRows("t-tdhist",list.filter(function(x){return x.status!=="ready"}))}
function setTab(t,keep){
if(TABS.indexOf(t)<0)t="overview";
[].forEach.call(document.querySelectorAll(".panel"),function(p){p.classList.toggle("on",p.id==="p-"+t)});
[].forEach.call(document.querySelectorAll("#tabs button"),function(b){b.classList.toggle("on",b.getAttribute("data-tab")===t)});
if(!keep)try{history.replaceState(null,"","#tab="+t)}catch(e){}
document.title="Emera admin - "+t}
function hashTab(){var m2=location.hash.match(/tab=(\w+)/);return m2?m2[1]:"overview"}
document.getElementById("tabs").addEventListener("click",function(e){var b=e.target.closest("button[data-tab]");if(b)setTab(b.getAttribute("data-tab"))});
document.addEventListener("keydown",function(e){if(e.metaKey||e.ctrlKey||e.altKey)return;var tg=e.target.tagName;if(tg==="INPUT"||tg==="TEXTAREA"||tg==="SELECT")return;var i=parseInt(e.key,10);if(i>=1&&i<=6)setTab(TABS[i-1])});
window.addEventListener("hashchange",function(){setTab(hashTab(),1)});

function loadTd(){return fetch("/admin/takedowns",{headers:hdr()}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j){tdata=j.takedowns;renderAll()}})}
function loadP(){return fetch("/admin/protect",{headers:hdr()}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j){pdata=j;renderAll()}})}
function pAct(path,body){return fetch("/admin/protect/"+path,{method:"POST",headers:{"x-admin-key":store().getItem(K),"content-type":"application/json"},body:JSON.stringify(body)}).then(function(r){return r.json()}).then(function(j){if(!j.ok)alert(j.error||"failed");loadP()})}
document.addEventListener("click",function(e){
var b=e.target.closest("button");if(!b)return;
if(b.hasAttribute("data-go")){setTab(b.getAttribute("data-go"));return}
if(b.hasAttribute("data-td")){var a=b.getAttribute("data-a"),reason=null;
if(a==="reject"){reason=prompt("Why? The creator sees this.");if(!reason)return}
if(a==="send-email"&&!confirm("Send this notice by email now?"))return;
b.disabled=true;fetch("/admin/takedowns/"+b.getAttribute("data-td")+"/"+a,{method:"POST",headers:{"x-admin-key":store().getItem(K),"content-type":"application/json"},body:JSON.stringify({reason:reason})}).then(function(r){return r.json()}).then(function(j){if(!j.ok)alert(j.error||"failed");loadTd();loadP()});return}
if(b.hasAttribute("data-pu")){var a2=b.getAttribute("data-a"),id=b.getAttribute("data-pu"),plan=b.getAttribute("data-plan");
if(a2==="give-plan"&&!confirm("Give "+plan+" for 30 days, free?"))return;if(a2==="end-plan"&&!confirm("End this plan now?"))return;
b.disabled=true;pAct(a2,{id:id,plan:plan});return}
if(b.hasAttribute("data-pm")){b.disabled=true;pAct("dismiss",{id:b.getAttribute("data-pm")});return}
if(b.hasAttribute("data-sp")){b.disabled=true;fetch("/admin/sponsor",{method:"POST",headers:{"x-admin-key":store().getItem(K),"content-type":"application/json"},body:JSON.stringify({id:b.getAttribute("data-sp"),banner:b.getAttribute("data-b")})}).then(function(){load()})}});
function load(){var key=store().getItem(K);if(!key){gate();return}
loadTd();loadP();
fetch("/admin/data",{headers:{"x-admin-key":key}}).then(function(r){if(r.status===401){gate("That key did not work");return null}return r.json()}).then(function(j){if(!j)return;data=j;document.getElementById("gate").style.display="none";document.getElementById("app").hidden=false;renderAll()}).catch(function(e){document.getElementById("upd").textContent="could not load: "+e})}
function gate(msg){document.getElementById("app").hidden=true;document.getElementById("gate").style.display="block";document.getElementById("gmsg").textContent=msg||""}
document.getElementById("key").addEventListener("change",function(e){store().setItem(K,e.target.value.trim());load()});
document.getElementById("showTest").addEventListener("change",function(){renderAll()});
setTab(hashTab(),1);
load();setInterval(load,60000);
</script></body></html>`;
