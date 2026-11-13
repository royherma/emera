import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { footer, footerCss } from "./footer.mjs";
import { pages } from "./pages.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = JSON.parse(readFileSync(join(root, "../../packages/brand/brand.json"), "utf8"));
const SITE = `https://${brand.domain}`;
const PATH = "/fund/";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const TITLE = "Half of every sponsor dollar goes to creators | Emera fund";
const OG_TITLE = "Half of every sponsor dollar goes to the creators people watch";
const DESCRIPTION = "Companies sponsor Emera. Half of every dollar goes to the creators people watched that month, split by watch time, and every dollar is public.";

const markInner = readFileSync(join(root, "../../brand/logo/final/mark-small.svg"), "utf8").replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const mark = `<svg viewBox="0 0 600 600" aria-hidden="true"><use href="#mark"/></svg>`;
const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="mark" viewBox="0 0 600 600">${markInner}</symbol></svg>`;

const css = `:root{--sun:#ff8a2b;--sun2:#ffc24a;--bg:#fbf5ea;--bg2:#f3e8d5;--ink:#2a1d14;--ink2:#6b5846;--ink3:#857260;--card:#fffaf1;--line:rgba(60,35,10,.12);--sunink:#9a4a00;--half:#2a1d14;--halfink:#fbf3e8;--err:#a3240f;--disp:"Sora",ui-sans-serif,system-ui,sans-serif;--body:"DM Sans",ui-sans-serif,system-ui,sans-serif;--gutter:clamp(16px,5vw,72px);color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0c0a09;--bg2:#14110f;--ink:#fbf3e8;--ink2:#bcae9d;--ink3:#8a7c6d;--card:#1a1613;--line:rgba(255,235,210,.12);--sunink:#ffc98a;--half:#2b241f;--halfink:#fbf3e8;--err:#ff9a85;color-scheme:dark}}
:root[data-theme=dark]{--bg:#0c0a09;--bg2:#14110f;--ink:#fbf3e8;--ink2:#bcae9d;--ink3:#8a7c6d;--card:#1a1613;--line:rgba(255,235,210,.12);--sunink:#ffc98a;--half:#2b241f;--halfink:#fbf3e8;--err:#ff9a85;color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:17px/1.55 var(--body);-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit;text-underline-offset:3px}
.wrap{max-width:1100px;margin:0 auto;padding:0 var(--gutter)}
.nav{display:flex;align-items:center;justify-content:space-between;padding:22px 0}
.mk{display:flex;align-items:center;gap:10px;font:700 1.35rem var(--disp);letter-spacing:-.04em;text-decoration:none}
.mk svg{width:30px;height:30px;color:var(--ink)}
.pill{display:inline-block;background:linear-gradient(180deg,var(--sun2),var(--sun));color:#2a1406;font-weight:700;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:.95rem;border:0;cursor:pointer;font-family:var(--body)}
.ghost{display:inline-block;padding:10px 18px;border-radius:999px;border:1px solid var(--line);text-decoration:none;font-weight:600;font-size:.95rem}
.eyebrow{font:600 .78rem var(--body);letter-spacing:.14em;text-transform:uppercase;color:var(--sunink);margin-top:28px}
h1{font:800 clamp(2.3rem,6vw,4.4rem)/1 var(--disp);letter-spacing:-.05em;margin-top:14px;max-width:14em;text-wrap:balance}
.lead{color:var(--ink2);max-width:36em;margin-top:20px;font-size:clamp(1.02rem,1.5vw,1.18rem)}
.cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
section{margin-top:72px}
h2{font:700 clamp(1.5rem,3vw,2.1rem)/1.1 var(--disp);letter-spacing:-.035em;text-wrap:balance}
.sub{color:var(--ink2);margin-top:10px;max-width:38em}
.split{display:grid;grid-template-columns:1fr 1fr;margin-top:26px;border-radius:24px;overflow:hidden;border:1px solid var(--line)}
.half{padding:clamp(22px,4vw,40px)}
.half.c{background:linear-gradient(160deg,var(--sun2),var(--sun));color:#2a1406}
.half.e{background:var(--half);color:var(--halfink)}
.half b{display:block;font:800 clamp(3rem,9vw,6rem)/.9 var(--disp);letter-spacing:-.06em}
.half h3{font:700 1.15rem/1.2 var(--disp);margin-top:14px;letter-spacing:-.02em}
.half p{margin-top:6px;opacity:.85;max-width:24em}
.calc{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:16px;margin-top:26px}
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:clamp(18px,3vw,28px)}
.tag{display:inline-block;font:600 .72rem var(--body);letter-spacing:.12em;text-transform:uppercase;color:var(--sunink);border:1px solid var(--line);border-radius:999px;padding:4px 10px}
.field{display:block;margin-top:18px}
.field span{display:block;font-weight:600;font-size:.95rem}
.field small{color:var(--ink3);font-size:.85rem}
.money{display:flex;align-items:center;margin-top:8px;border:1px solid var(--line);border-radius:14px;background:var(--bg);padding:0 14px}
.money i{font-style:normal;color:var(--ink3);font-weight:600}
.money input{flex:1;min-width:0;border:0;background:none;padding:12px 8px;font:600 1.15rem var(--body);color:var(--ink);outline:none;font-variant-numeric:tabular-nums}
.money:focus-within{border-color:var(--sun)}
.out{display:grid;gap:14px}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--line)}
.row span{color:var(--ink2)}
.row b{font:700 1.4rem var(--disp);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.row.you{border:0;padding:0}
.row.you b{font-size:clamp(2.4rem,6vw,3.4rem);color:var(--sunink);letter-spacing:-.05em}
.formula{margin-top:6px;font-size:.92rem;color:var(--ink3)}
details{margin-top:16px;border-top:1px solid var(--line);padding-top:14px}
summary{cursor:pointer;font-weight:600}
details ul{margin-top:10px;padding-left:20px;color:var(--ink2)}
details li{margin-top:6px}
.deal{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:26px}
.deal h3{font:700 1.1rem var(--disp);letter-spacing:-.02em}
.deal ul{list-style:none;margin-top:12px;display:grid;gap:10px}
.deal li{display:grid;grid-template-columns:22px 1fr;gap:8px;color:var(--ink)}
.deal li::before{content:"";width:10px;height:10px;border-radius:50%;margin-top:8px;background:var(--sun)}
.deal .no li::before{background:none;border:2px solid var(--ink3);width:9px;height:9px}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:22px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 20px}
.tile b{display:block;font:800 clamp(1.8rem,4vw,2.6rem)/1 var(--disp);letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.tile span{display:block;margin-top:6px;color:var(--ink2);font-size:.95rem;line-height:1.3}
.list{margin-top:14px}
.list h3{font:700 1.05rem var(--disp);margin-bottom:6px}
.list li{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--line);font-variant-numeric:tabular-nums}
.list ol{list-style:none}
.list a{color:var(--sunink);font-weight:600;text-decoration:none}
.tw{overflow-x:auto;margin-top:8px}
table{width:100%;border-collapse:collapse;font-size:.95rem;min-width:520px;font-variant-numeric:tabular-nums}
th,td{padding:10px 12px;text-align:left;border-top:1px solid var(--line);white-space:nowrap}
th{font-weight:600;color:var(--ink2);border-top:0;white-space:nowrap}
td code{font:.85rem ui-monospace,SFMono-Regular,Menlo,monospace}
td a{color:var(--sunink)}
.join{padding:clamp(24px,4vw,44px);border-radius:28px;background:linear-gradient(180deg,#fff2dc,#f8d3a6);color:#2a1d14}
.join .sub{color:#5a4634}
.form{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:22px;max-width:760px}
.form label{display:grid;gap:6px;font-weight:600;font-size:.92rem}
.form label small{font-weight:400;color:#7a6450}
.form input,.form select{width:100%;border:1px solid rgba(60,35,10,.16);border-radius:14px;background:#fffaf1;padding:13px 14px;font:inherit;font-weight:400;color:#2a1d14;outline:none}
.form input:focus,.form select:focus{border-color:var(--sun)}
.form .go{grid-column:1/-1;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.form button{padding:14px 26px;font-size:1rem}
.form button:disabled{opacity:.6;cursor:default}
.form[hidden]{display:none}
.hp{position:absolute;left:-9999px}
.note{font-size:.95rem;min-height:1.4em;margin-top:16px;font-weight:600}
.note.err{color:#a3240f}
.fine{color:var(--ink3);font-size:.88rem;margin:28px 0 64px;max-width:44em}
.fine a{color:var(--ink2)}
@media (max-width:760px){.split,.calc,.deal{grid-template-columns:1fr}.tiles{grid-template-columns:1fr 1fr}.tile{padding:16px}.form{grid-template-columns:1fr}.form button{width:100%}}`;

const themeBoot = `<script>(function(){try{var s=localStorage.getItem("emera-theme");if(s)document.documentElement.setAttribute("data-theme",s)}catch(e){}})()</script>`;

const script = `<script>(function(){
var root=document.querySelector("[data-api]"),share=0.5;
function usd(c){return"$"+(c/100).toLocaleString("en-US",{minimumFractionDigits:c%100?2:0,maximumFractionDigits:2})}
function num(el){var v=parseFloat(String(el.value).replace(/[^0-9.]/g,""));return isFinite(v)&&v>0?v:0}
var total=document.getElementById("c-total"),pct=document.getElementById("c-share");
function calc(){var cents=Math.round(num(total)*100),pool=Math.floor(cents*share),p=Math.min(num(pct),100),you=Math.floor(pool*p/100);
document.getElementById("o-pool").textContent=usd(pool);document.getElementById("o-emera").textContent=usd(cents-pool);document.getElementById("o-you").textContent=usd(you)}
total.addEventListener("input",calc);pct.addEventListener("input",calc);calc();
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function safeUrl(u){return/^https?:\\/\\//i.test(u||"")?u:null}
function month(m){return new Date(m+"-15T00:00:00Z").toLocaleDateString("en-US",{month:"short",year:"numeric",timeZone:"UTC"})}
function live(d,api){var m=d.month||{},tiles=[[m.creatorPoolCents,"to creators this month",usd],[m.sponsoredCents,"sponsored this month",usd],[m.sponsors,"sponsors this month",String],[m.creators,"creators earning this month",String]].filter(function(t){return t[0]>0});
var sp=(d.sponsors||[]).filter(function(s){return s.amountCents>0}),hist=(d.history||[]).filter(function(h){return h.sha256});
if(!tiles.length&&!sp.length&&!hist.length)return;
var box=document.getElementById("live");
box.querySelector("[data-tiles]").innerHTML=tiles.map(function(t){return'<div class="tile"><b>'+t[2](t[0])+"</b><span>"+t[1]+"</span></div>"}).join("");
if(sp.length){var s=box.querySelector("[data-sponsors]");s.hidden=false;s.querySelector("ol").innerHTML=sp.map(function(x){var u=safeUrl(x.url);return"<li><span>"+(u?'<a href="'+esc(u)+'" rel="noopener sponsored">'+esc(x.name)+"</a>":esc(x.name))+"</span><span>"+usd(x.amountCents)+"</span></li>"}).join("")}
if(hist.length){var h=box.querySelector("[data-history]");h.hidden=false;h.querySelector("tbody").innerHTML=hist.map(function(x){return"<tr><td>"+month(x.month)+"</td><td>"+usd(x.sponsoredCents)+"</td><td>"+usd(x.creatorPoolCents)+"</td><td>"+x.creators+'</td><td><a href="'+esc(api)+"/v1/fund/months/"+encodeURIComponent(x.month)+'" rel="noopener" title="'+esc(x.sha256)+'"><code>'+esc(x.sha256.slice(0,12))+"</code></a></td></tr>"}).join("")}
box.hidden=false}
var api=root&&root.getAttribute("data-api");
if(api)fetch(api+"/v1/fund").then(function(r){return r.ok?r.json():null}).then(function(d){if(!d)return;if(d.rules&&d.rules.creatorShare>0){share=d.rules.creatorShare;calc()}live(d,api)}).catch(function(){});
var f=document.querySelector("[data-sponsor]");if(!f)return;var n=document.querySelector("[data-snote]"),b=f.querySelector("button");
var paid=new URLSearchParams(location.search).get("paid");
if(paid&&api)fetch(api+"/v1/fund/checkout/"+encodeURIComponent(paid)).then(function(r){return r.json()}).then(function(j){f.hidden=true;n.className="note";n.textContent=j.paid?"Thank you, "+j.sponsorName+". "+usd(j.amountCents)+" is booked over "+j.months+(j.months===1?" month":" months")+". Your banner goes up once we check the words.":"Payment received. It shows here within a minute."}).catch(function(){});
function err(t,el){n.textContent=t;n.classList.add("err");if(el)el.focus()}
f.addEventListener("submit",function(e){e.preventDefault();n.className="note";var em=f.email.value.trim(),co=f.company.value.trim(),mo=Math.round(parseFloat(String(f.monthly.value).replace(/[$,\\s]/g,""))*100);
if(!co)return err("Add your company or your name.",f.company);
if(!/^[^\\s@]+@[^\\s@.]+(\\.[^\\s@.]+)+$/.test(em))return err("That email does not look right. Check it and try again.",f.email);
if(!(mo>=1000))return err("Put at least $10 a month.",f.monthly);
var body={sponsorName:co,contactEmail:em,monthlyCents:mo,months:Number(f.months.value),sponsorUrl:f.url.value.trim()||undefined,line:f.line.value.trim()||undefined};
if(f.website.value)return;
b.disabled=true;fetch(api+"/v1/fund/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){return{s:r.status,j:j}})}).then(function(x){if(x.j.url){location.href=x.j.url;return}
if(x.s===503)return fetch("/api/sponsor",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({company:co,email:em,monthly:String(mo/100),url:f.url.value,referrer:document.referrer})}).then(function(){f.hidden=true;n.textContent="Thanks. We will email "+em+" to set up your sponsorship."});
err((x.j.error&&x.j.error.message)||"Something went wrong on our side. Try again in a moment.");b.disabled=false}).catch(function(){err("Something went wrong on our side. Try again in a moment.");b.disabled=false})})
})()</script>`;

function html(github) {
  const ld = [
    { "@context": "https://schema.org", "@type": "WebPage", name: OG_TITLE, description: DESCRIPTION, url: `${SITE}${PATH}` },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: brand.name, item: `${SITE}/` }, { "@type": "ListItem", position: 2, name: "Fund", item: `${SITE}${PATH}` }] },
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(TITLE)}</title>
<meta name="description" content="${esc(DESCRIPTION)}">
<link rel="canonical" href="${SITE}${PATH}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(brand.name)}">
<meta property="og:title" content="${esc(OG_TITLE)}">
<meta property="og:description" content="${esc(DESCRIPTION)}">
<meta property="og:url" content="${SITE}${PATH}">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(OG_TITLE)}">
<meta name="twitter:description" content="${esc(DESCRIPTION)}">
<meta name="twitter:image" content="${SITE}/assets/og.png">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${themeBoot}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&display=swap" rel="stylesheet">
<style>${css}
${footerCss}</style>
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body>${sprite}<div class="wrap">
<nav class="nav"><a class="mk" href="/" aria-label="${esc(brand.name)}">${mark}${esc(brand.name.toLowerCase())}</a><a class="pill" href="/#join">Create your account</a></nav>
<main data-api="">
<div class="eyebrow">${esc(brand.name)} fund</div>
<h1>The creators people watch get half of every sponsor dollar</h1>
<p class="lead">People who create get copied, faked and paid in exposure. ${esc(brand.name)} pays them. Companies sponsor ${esc(brand.name)}, half of every dollar goes to the creators people watched that month, half keeps ${esc(brand.name)} running, and every dollar in and out is public.</p>
<div class="cta"><a class="pill" href="#sponsor">Become a sponsor</a><a class="ghost" href="#share">See how a share is worked out</a></div>

<section aria-labelledby="h-split">
<h2 id="h-split">Every sponsor dollar, split down the middle</h2>
<div class="split">
<div class="half c"><b>50¢</b><h3>To the creators people watched</h3><p>Shared out each month by the watch time real, signed-in people gave each creator.</p></div>
<div class="half e"><b>50¢</b><h3>To run ${esc(brand.name)}</h3><p>Servers, the takedown desk, moderation and staff, spent in the open.</p></div>
</div>
</section>

<section id="share" aria-labelledby="h-share">
<h2 id="h-share">Your share is your watch time</h2>
<p class="sub">Each month the creator half is shared by watch time. If 2% of the month's counted watch time was on your posts, you get 2% of the creator pool.</p>
<div class="calc">
<div class="card"><span class="tag">Example</span>
<label class="field"><span>Sponsors put in this month</span><div class="money"><i>$</i><input id="c-total" inputmode="decimal" value="10,000" aria-label="Sponsor money this month in dollars"></div></label>
<label class="field"><span>Your share of the month's watch time</span><small>40,000 of 2,000,000 counted seconds is 2%</small><div class="money"><input id="c-share" inputmode="decimal" value="2" aria-label="Your share of watch time in percent"><i>%</i></div></label>
</div>
<div class="card out" aria-live="polite">
<div class="row"><span>Creator pool</span><b id="o-pool">$5,000</b></div>
<div class="row"><span>Runs ${esc(brand.name)}</span><b id="o-emera">$5,000</b></div>
<div class="row you"><span>You get</span><b id="o-you">$100</b></div>
<p class="formula">Your amount = creator pool x your share of counted watch time, rounded down to the cent. Leftover cents roll into next month's pool.</p>
<details><summary>What counts as a watched second</summary><ul>
<li>Only signed-in viewers count, so a crowd of logged-out bots adds nothing.</li>
<li>Your own views never count.</li>
<li>One viewer counts for at most 60 seconds on a photo post and 10 minutes on a video post each day.</li>
<li>One viewer counts for at most 30 minutes across one creator's posts each day, so no superfan or farm account decides who gets paid.</li>
<li>Accounts younger than 24 hours count zero.</li>
<li>A post taken down as a copy earns nothing, and its seconds go back to everyone else.</li>
</ul></details>
</div>
</div>
<div class="cta"><a class="ghost" href="/#join">Create your account and start posting</a></div>
</section>

<section aria-labelledby="h-deal">
<h2 id="h-deal">Money can't buy reach here</h2>
<p class="sub">Sponsors back what people create. They get their name in daylight and a statement of where every dollar went. They never get a say in what anyone sees.</p>
<div class="deal">
<div class="card"><h3>What a sponsor gets</h3><ul>
<li>A one-line banner marked Sponsor at the top of the app feed</li>
<li>Your name and link on this page, sorted by amount</li>
<li>Each month's statement showing where your money went, creator by creator</li>
</ul></div>
<div class="card no"><h3>What a sponsor never gets</h3><ul>
<li>A boost for any post, or a say in ranking, moderation or takedowns</li>
<li>Targeting, a badge, or any data about who watched what</li>
</ul></div>
</div>
<p class="sub" data-gate>Sponsor cards between posts start once ${esc(brand.name)} has 1,000 posts, one after every 12, always marked Sponsor. Until then the first sponsors get the feed banner.</p>
</section>

<section id="live" aria-labelledby="h-live" hidden>
<h2 id="h-live">The fund, live</h2>
<p class="sub">Read straight from the fund's books. Each closed month is frozen with a fingerprint anyone can re-check.</p>
<div class="tiles" data-tiles></div>
<div class="card list" data-sponsors hidden><h3>This month's sponsors</h3><ol></ol></div>
<div class="card list" data-history hidden><h3>Closed months</h3><div class="tw"><table><thead><tr><th scope="col">Month</th><th scope="col">Sponsored</th><th scope="col">To creators</th><th scope="col">Creators paid</th><th scope="col">Fingerprint</th></tr></thead><tbody></tbody></table></div></div>
</section>

<section id="sponsor" class="join" aria-labelledby="h-sponsor">
<h2 id="h-sponsor">Put your name behind the people who create</h2>
<p class="sub">Pick a monthly amount and how many months. You pay once through Stripe. Half goes to the creators people watch each month.</p>
<form class="form" data-sponsor novalidate>
<label>Company or your name<input name="company" autocomplete="organization" maxlength="80" required></label>
<label>Email<input type="email" name="email" autocomplete="email" maxlength="254" required></label>
<label>Monthly amount <small>in dollars, at least $10</small><input name="monthly" inputmode="decimal" value="25" maxlength="9"></label>
<label>Months<select name="months"><option value="1">1 month</option><option value="3" selected>3 months</option><option value="6">6 months</option><option value="12">12 months</option></select></label>
<label>Link <small>optional</small><input name="url" inputmode="url" placeholder="acme.com" maxlength="300" autocomplete="url"></label>
<label>Banner line <small>optional, shown after your name</small><input name="line" maxlength="80" placeholder="Paper for people who draw"></label>
<input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<div class="go"><button class="pill" type="submit">Sponsor with Stripe</button></div>
</form>
<p class="note" data-snote role="status" aria-live="polite"></p>
</section>

<p class="fine">The full rules, every number and how they change are public in <a href="${esc(github)}/blob/main/docs/mission/funding-rules.md" rel="noopener">funding-rules.md</a>. Payouts go out every quarter through Stripe once a balance reaches $10.</p>
</main>
</div>${footer({ pages, mark, github, year: new Date().getFullYear() })}${script}</body></html>`;
}

export function writeFund(today, { github }) {
  const dir = join(root, "public", PATH);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html(github));
  const sitemap = join(root, "public/sitemap.xml");
  const xml = readFileSync(sitemap, "utf8");
  if (!xml.includes(`${SITE}${PATH}<`)) writeFileSync(sitemap, xml.replace("</urlset>", `<url><loc>${SITE}${PATH}</loc><lastmod>${today}</lastmod></url>\n</urlset>`));
}

