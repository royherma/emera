import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { footer, footerCss, starButton } from "./footer.mjs";
import { pages } from "./pages.mjs";
import { sprite } from "./screens.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = JSON.parse(readFileSync(join(root, "../../packages/brand/brand.json"), "utf8"));
const SITE = `https://${brand.domain}`;
const PATH = "/protect/";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const TITLE = "Emera Protect: we find the copies and get them taken down";
const OG_TITLE = "Someone copied what you made. We get it taken down";
const DESCRIPTION = "Emera Protect scans for copies of what you create, files the takedown and tracks it until the copy is gone. Free to report, $10 a month for weekly scans.";

const litSvg = readFileSync(join(root, "../../brand/logo/final/mark-lit-symbol.svg"), "utf8");
const litBox = litSvg.match(/viewBox="([^"]+)"/)[1];
const mark = `<svg viewBox="${litBox}" aria-hidden="true"><use href="#mark"/></svg>`;
const plan = (tier, p) => `https://${brand.domain}/?ref=protect-${tier}${p ? `&plan=${p}` : ""}`;

const css = `:root{--sun:#ff8a2b;--sun2:#ffc24a;--bg:#fbf5ea;--bg2:#f3e8d5;--ink:#2a1d14;--ink2:#6b5846;--ink3:#857260;--card:#fffaf1;--line:rgba(60,35,10,.12);--sunink:#9a4a00;--dark:#14100d;--darkink:#fbf3e8;--ok:#2f7a3d;--err:#a3240f;--disp:"Sora",ui-sans-serif,system-ui,sans-serif;--body:"DM Sans",ui-sans-serif,system-ui,sans-serif;--gutter:clamp(16px,5vw,72px);color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0c0a09;--bg2:#14110f;--ink:#fbf3e8;--ink2:#bcae9d;--ink3:#8a7c6d;--card:#1a1613;--line:rgba(255,235,210,.12);--sunink:#ffc98a;--dark:#201a16;--ok:#7bd68a;--err:#ff9a85;color-scheme:dark}}
:root[data-theme=dark]{--bg:#0c0a09;--bg2:#14110f;--ink:#fbf3e8;--ink2:#bcae9d;--ink3:#8a7c6d;--card:#1a1613;--line:rgba(255,235,210,.12);--sunink:#ffc98a;--dark:#201a16;--ok:#7bd68a;--err:#ff9a85;color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:17px/1.55 var(--body);-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit;text-underline-offset:3px}
.wrap{max-width:1100px;margin:0 auto;padding:0 var(--gutter)}
.nav{display:flex;align-items:center;justify-content:space-between;padding:22px 0}
.mk{display:flex;align-items:center;gap:10px;font:700 1.35rem var(--disp);letter-spacing:-.04em;text-decoration:none}
.mk svg{width:38px;height:38px;color:var(--ink)}
.pill{display:inline-block;background:linear-gradient(180deg,var(--sun2),var(--sun));color:#2a1406;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:.98rem;border:0;cursor:pointer;font-family:var(--body);text-align:center}
.ghost{display:inline-block;padding:12px 20px;border-radius:999px;border:1px solid var(--line);text-decoration:none;font-weight:600;font-size:.98rem;text-align:center}
.eyebrow{font:600 .78rem var(--body);letter-spacing:.14em;text-transform:uppercase;color:var(--sunink)}
.hero{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:clamp(24px,5vw,64px);align-items:center;padding:clamp(18px,4vw,48px) 0 0}
h1{font:800 clamp(2.4rem,6vw,4.6rem)/.98 var(--disp);letter-spacing:-.05em;margin-top:14px;text-wrap:balance}
.lead{color:var(--ink2);max-width:30em;margin-top:20px;font-size:clamp(1.02rem,1.5vw,1.18rem)}
.cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
.trk{background:var(--dark);color:var(--darkink);border-radius:28px;padding:clamp(20px,3vw,30px);box-shadow:0 40px 60px -34px rgba(120,60,10,.6);position:relative;overflow:hidden}
.trk::before{content:"";position:absolute;inset:-40% -30% auto auto;width:320px;height:320px;background:radial-gradient(circle,rgba(255,170,60,.38),transparent 65%)}
.trk h2{font:600 .75rem var(--body);letter-spacing:.14em;text-transform:uppercase;color:rgba(251,243,232,.6);position:relative}
.trk .big{font:800 clamp(3.2rem,8vw,5.2rem)/.9 var(--disp);letter-spacing:-.06em;margin-top:10px;position:relative;color:var(--sun2)}
.trk .big small{display:block;font:600 1rem/1.3 var(--body);letter-spacing:0;color:rgba(251,243,232,.8);margin-top:8px}
.trk ol{list-style:none;margin-top:22px;display:grid;gap:10px;position:relative}
.trk li{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:12px 14px;border-radius:14px;background:rgba(255,235,210,.07);font-size:.95rem}
.trk li span{color:rgba(251,243,232,.62);font-size:.85rem;display:block}
.st{font:700 .72rem var(--body);letter-spacing:.08em;text-transform:uppercase;padding:5px 10px;border-radius:999px;white-space:nowrap}
.st.rm{background:#7bd68a;color:#0f2a14}
.st.fl{background:var(--sun2);color:#2a1406}
.st.nw{background:rgba(251,243,232,.16);color:#fbf3e8}
section{margin-top:clamp(56px,8vw,96px)}
h2.t{font:700 clamp(1.6rem,3.2vw,2.3rem)/1.1 var(--disp);letter-spacing:-.035em;text-wrap:balance}
.sub{color:var(--ink2);margin-top:10px;max-width:38em}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px;counter-reset:s}
.step{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:24px}
.step::before{counter-increment:s;content:counter(s);display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:linear-gradient(180deg,var(--sun2),var(--sun));color:#2a1406;font:800 1.1rem var(--disp)}
.step h3{font:700 1.2rem/1.2 var(--disp);letter-spacing:-.02em;margin-top:16px}
.step p{color:var(--ink2);margin-top:6px}
.tiers{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:28px;align-items:stretch}
.tier{background:var(--card);border:1px solid var(--line);border-radius:24px;padding:24px 20px;display:flex;flex-direction:column}
.tier h3{font:700 1.05rem var(--disp);letter-spacing:-.02em}
.tier .for{color:var(--ink3);font-size:.88rem;margin-top:2px;min-height:2.6em}
.tier .price{font:800 2.6rem/1 var(--disp);letter-spacing:-.05em;margin-top:14px}
.tier .price small{font:600 .9rem var(--body);letter-spacing:0;color:var(--ink3)}
.tier ul{list-style:none;margin:18px 0 22px;display:grid;gap:9px;font-size:.95rem;flex:1;align-content:start}
.tier li{display:grid;grid-template-columns:18px 1fr;gap:8px}
.tier li::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--sun);margin-top:9px}
.tier .pill,.tier .ghost{width:100%}
.tier.pro{background:var(--dark);color:var(--darkink);border-color:transparent;box-shadow:0 30px 50px -30px rgba(120,60,10,.6)}
.tier.pro .for,.tier.pro .price small{color:rgba(251,243,232,.6)}
.tier.pro .ghost{border-color:rgba(255,235,210,.25)}
.badge{align-self:flex-start;font:700 .68rem var(--body);letter-spacing:.1em;text-transform:uppercase;background:var(--sun2);color:#2a1406;border-radius:999px;padding:4px 9px;margin-bottom:10px}
.ent{margin-top:clamp(40px,6vw,72px);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:clamp(20px,4vw,48px);padding:clamp(24px,4vw,44px);border-radius:28px;background:linear-gradient(180deg,#fff2dc,#f8d3a6);color:#2a1d14}
.ent .sub{color:#5a4634}
.ent .eyebrow{color:#9a4a00}
.ent h2{font:700 clamp(1.5rem,3vw,2rem)/1.1 var(--disp);letter-spacing:-.035em;margin-top:8px}
.form{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.form label{display:grid;gap:6px;font-weight:600;font-size:.92rem}
.form input{width:100%;border:1px solid rgba(60,35,10,.16);border-radius:14px;background:#fffaf1;padding:13px 14px;font:inherit;font-weight:400;color:#2a1d14;outline:none}
.form input:focus{border-color:var(--sun)}
.form .wide{grid-column:1/-1}
.form button{padding:14px 26px;font-size:1rem;grid-column:1/-1}
.form button:disabled{opacity:.6;cursor:default}
.form[hidden]{display:none}
.hp{position:absolute;left:-9999px}
.note{font-size:.95rem;min-height:1.4em;margin-top:12px;font-weight:600}
.note.err{color:#a3240f}
.fine{color:var(--ink3);font-size:.88rem;margin:28px 0 64px;max-width:44em}
.paid{position:sticky;top:0;z-index:9;padding:14px 20px;text-align:center;background:#1c1512;color:#fff7e8;font-size:15px}.paid a{color:#ffb547;margin-left:6px}
@media (max-width:980px){.tiers{grid-template-columns:1fr 1fr}}
@media (max-width:820px){.hero{grid-template-columns:1fr}.steps{grid-template-columns:1fr}.ent{grid-template-columns:1fr}}
@media (max-width:560px){.tiers{grid-template-columns:1fr}.form{grid-template-columns:1fr}.cta a{flex:1 1 100%}}`;

const buy = `<script>(function(){var api=/(^|\\.)emera\\.social$/.test(location.hostname)?"https://api.emera.social":"https://emera-api-staging.techguyver1337.workers.dev";
var q=new URLSearchParams(location.search);if(q.get("subscribed")){var d=document.createElement("div");d.className="paid";d.innerHTML='<strong>You are protected.</strong> Sign in or create your account with the email you paid with and your plan is already there. <a href="/?ref=protect-paid#join">Create your account</a>';document.body.prepend(d)}
document.querySelectorAll("[data-buy]").forEach(function(a){a.addEventListener("click",function(e){e.preventDefault();var t=a.textContent;a.textContent="Opening checkout...";
fetch(api+"/v1/protect/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({plan:a.getAttribute("data-buy"),code:q.get("code")||undefined})}).then(function(r){return r.json()}).then(function(j){if(j.url)location.href=j.url;else{a.textContent=t;location.href=a.href}}).catch(function(){a.textContent=t;location.href=a.href})})})})()</script>`;

const script =`<script>(function(){var f=document.querySelector("[data-ent]");if(!f)return;var n=document.querySelector("[data-note]"),b=f.querySelector("button");
function err(t,el){n.textContent=t;n.classList.add("err");if(el)el.focus()}
f.addEventListener("submit",function(e){e.preventDefault();n.className="note";if(f.website.value)return;
var nm=f.name.value.trim(),em=f.email.value.trim(),co=f.company.value.trim();
if(!nm)return err("Add your name.",f.name);
if(!/^[^\\s@]+@[^\\s@.]+(\\.[^\\s@.]+)+$/.test(em))return err("That email does not look right. Check it and try again.",f.email);
if(!co)return err("Add your company.",f.company);
b.disabled=true;fetch("/api/enterprise",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:nm,email:em,company:co,creators:f.creators.value,referrer:document.referrer})}).then(function(r){return r.json().then(function(j){return{s:r.status,j:j}})}).then(function(x){if(x.j.ok){f.hidden=true;n.textContent="Thanks "+nm.split(" ")[0]+". We will email "+em+" within one working day.";return}
err(x.s===429?"We already have your details. We will be in touch.":"Something went wrong on our side. Try again in a moment.");b.disabled=false}).catch(function(){err("Something went wrong on our side. Try again in a moment.");b.disabled=false})})})()</script>`;

function html(github) {
  const ld = [
    { "@context": "https://schema.org", "@type": "WebPage", name: OG_TITLE, description: DESCRIPTION, url: `${SITE}${PATH}` },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: brand.name, item: `${SITE}/` }, { "@type": "ListItem", position: 2, name: "Emera Protect", item: `${SITE}${PATH}` }] },
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
<script>(function(){try{var s=localStorage.getItem("emera-theme");if(s)document.documentElement.setAttribute("data-theme",s)}catch(e){}})()</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&display=swap" rel="stylesheet">
<style>${css}
${footerCss}</style>
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body>${sprite}<div class="wrap">
<nav class="nav"><a class="mk" href="/" aria-label="${esc(brand.name)}">${mark}${esc(brand.name.toLowerCase())}</a><div class="navr">${starButton(github)}<a class="pill" href="${plan("nav")}">Create your account</a></div></nav>
<main>
<div class="hero">
<div>
<div class="eyebrow">${esc(brand.name)} Protect</div>
<h1>Someone copied what you made. We get it taken down</h1>
<p class="lead">Creators get copied and resold every day. ${esc(brand.name)} Protect finds the copies, files the takedown for you and tracks it until the copy is gone.</p>
<div class="cta"><a class="pill" data-buy="creator" href="${plan("hero", "creator")}">Start for $10 a month</a><a class="ghost" href="#plans">See every plan</a></div>
</div>
<aside class="trk" aria-label="Example of a takedown being tracked">
<h2>Takedowns this month, example</h2>
<div class="big">12<small>copies found and taken down for one illustrator</small></div>
<ol>
<li><div>Print listing of a ceramic series<span>Filed Tuesday</span></div><b class="st rm">Removed</b></li>
<li><div>Re-upload of a travel film<span>Filed Thursday</span></div><b class="st fl">Filed</b></li>
<li><div>Cloned portrait account<span>Found this morning</span></div><b class="st nw">One tap</b></li>
</ol>
</aside>
</div>

<section aria-labelledby="h-how">
<h2 class="t" id="h-how">Three steps, then we do the chasing</h2>
<div class="steps">
<div class="step"><h3>Add what you create</h3><p>Upload it, or bring your Instagram posts in one go.</p></div>
<div class="step"><h3>We scan for copies</h3><p>Every copy we find lands in your list, next to the original.</p></div>
<div class="step"><h3>One tap and it is filed</h3><p>We send the takedown and track it until the copy is removed.</p></div>
</div>
</section>

<section id="plans" aria-labelledby="h-plans">
<h2 class="t" id="h-plans">Pick how much you want covered</h2>
<p class="sub">Start free. Move up when more of what you create is out there.</p>
<div class="tiers">
<div class="tier"><h3>Free</h3><div class="for">Found a copy yourself</div><div class="price">$0</div><ul><li>Report a copy you found</li><li>We file the takedown for you</li></ul><a class="ghost" href="${plan("free")}">Start free</a></div>
<div class="tier"><h3>Creator</h3><div class="for">For people who make things</div><div class="price">$10<small> / month</small></div><ul><li>Unlimited works</li><li>Unlimited takedowns</li><li>Weekly scans</li></ul><a class="pill" data-buy="creator" href="${plan("creator", "creator")}">Get Creator</a></div>
<div class="tier pro"><span class="badge">For bigger names</span><h3>Pro</h3><div class="for">Bigger names and brands</div><div class="price">$100<small> / month</small></div><ul><li>Unlimited works and takedowns</li><li>Daily scans of new work</li><li>Video covered</li><li>Automatic filing</li><li>Fake-account takedowns</li><li>Priority help</li><li>Monthly report</li></ul><a class="pill" data-buy="pro" href="${plan("pro", "pro")}">Get Pro</a></div>
<div class="tier"><h3>Enterprise</h3><div class="for">Agencies, labels and brands with many creators</div><div class="price">Custom</div><ul><li>Everyone you represent in one place</li><li>Plans built around your list</li></ul><a class="ghost" href="#talk">Talk to us</a></div>
</div>
</section>

<section id="talk" class="ent" aria-labelledby="h-ent">
<div><div class="eyebrow">Enterprise</div><h2 id="h-ent">Protect every creator you represent</h2><p class="sub">Tell us who you work with. We reply within one working day with a plan and a price.</p></div>
<div><form class="form" data-ent novalidate>
<label>Your name<input name="name" autocomplete="name" maxlength="120" required></label>
<label>Email<input type="email" name="email" autocomplete="email" maxlength="254" required></label>
<label>Company<input name="company" autocomplete="organization" maxlength="120" required></label>
<label>How many creators<input name="creators" inputmode="numeric" maxlength="9" placeholder="50"></label>
<input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<button class="pill" type="submit">Talk to us</button>
</form><p class="note" data-note role="status" aria-live="polite"></p></div>
</section>

<p class="fine">Plans bill monthly and you can stop any time. Every takedown follows the rules of the place the copy lives, and you can see each step we took.</p>
</main>
</div>${footer({ pages, mark, github, year: new Date().getFullYear() })}${script}${buy}</body></html>`;
}

export function writeProtect(today, { github }) {
  const dir = join(root, "public", PATH);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html(github));
  const sitemap = join(root, "public/sitemap.xml");
  const xml = readFileSync(sitemap, "utf8");
  if (!xml.includes(`${SITE}${PATH}<`)) writeFileSync(sitemap, xml.replace("</urlset>", `<url><loc>${SITE}${PATH}</loc><lastmod>${today}</lastmod></url>\n</urlset>`));
}
