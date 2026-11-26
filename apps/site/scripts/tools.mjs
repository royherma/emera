import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { footer, footerCss, starButton } from "./footer.mjs";
import { pages } from "./pages.mjs";
import { sprite } from "./screens.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = JSON.parse(readFileSync(join(root, "../../packages/brand/brand.json"), "utf8"));
const SITE = `https://${brand.domain}`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const litSvg = readFileSync(join(root, "../../brand/logo/final/mark-lit-symbol.svg"), "utf8");
const mark = `<svg viewBox="${litSvg.match(/viewBox="([^"]+)"/)[1]}" aria-hidden="true"><use href="#mark"/></svg>`;

// Every form URL below was opened on 2026-11-26. 403 = the site blocks bots, so the URL comes from the
// platform's own pages as returned by search and is marked verified:"search".
const PLATFORMS = [
  {
    key: "instagram", slug: "instagram", name: "Instagram", hosts: ["instagram.com", "instagr.am"],
    form: "https://help.instagram.com/contact/552695131608132", formName: "Instagram copyright report form", verified: "opened, 200 (Meta IP reporting form)",
    steps: ["Open the form, pick Copyright, then Instagram.", "Paste the link to the exact post or reel, not the profile.", "Paste the link to your original and send."],
    sources: ["https://help.instagram.com/contact/552695131608132"],
  },
  {
    key: "tiktok", slug: "tiktok", name: "TikTok", hosts: ["tiktok.com"],
    form: "https://www.tiktok.com/legal/report/Copyright", formName: "TikTok copyright report form", verified: "opened, 200",
    steps: ["Open the form and choose that the content is yours.", "Paste the link to the video, not the account.", "Add the link to your original so the reviewer can compare."],
    sources: ["https://www.tiktok.com/legal/report/Copyright"],
  },
  {
    key: "youtube", slug: "youtube", name: "YouTube", hosts: ["youtube.com", "youtu.be"],
    form: "https://www.youtube.com/copyright_complaint_form", formName: "YouTube copyright complaint form", verified: "opened, 200 (asks you to sign in with Google)",
    steps: ["Sign in with the Google account that owns the original.", "Paste the link to the video you want removed.", "Add the link to your original and submit the form."],
    sources: ["https://www.youtube.com/copyright_complaint_form", "https://support.google.com/youtube/answer/2807622"],
  },
  {
    key: "facebook", slug: "facebook", name: "Facebook", hosts: ["facebook.com", "fb.com", "fb.watch"],
    form: "https://www.facebook.com/help/contact/634636770043106", formName: "Facebook copyright report form", verified: "opened, 200",
    steps: ["Open the form and pick Copyright.", "Paste the link to the post, photo or video.", "Add the link to your original and submit."],
    sources: ["https://www.facebook.com/help/contact/634636770043106"],
  },
  {
    key: "x", slug: "x", name: "X", hosts: ["x.com", "twitter.com", "t.co"],
    form: "https://help.x.com/forms/ipi", formName: "X copyright report form", email: "copyright@x.com", verified: "403 to bots; URL and copyright@x.com are the ones X's terms give (found via search, not opened)",
    steps: ["Open the form and choose copyright.", "Paste the link to the post itself. A link to the profile is not enough for X.", "Add the link to your original and submit."],
    sources: ["https://help.x.com/forms/ipi", "https://help.x.com/en/rules-and-policies/copyright-policy"],
  },
  {
    key: "pinterest", slug: "pinterest", name: "Pinterest", hosts: ["pinterest.com", "pin.it"],
    form: "https://www.pinterest.com/about/copyright/dmca-pin/", formName: "Pinterest copyright notification form", email: "copyright@pinterest.com", verified: "opened, 200; copyright@pinterest.com from policy.pinterest.com/en/copyright",
    steps: ["Open the form and add your details.", "Paste the link to the Pin. Pinterest shares your name with the person who saved it.", "Add the link to your original and submit."],
    sources: ["https://www.pinterest.com/about/copyright/dmca-pin/", "https://policy.pinterest.com/en/copyright"],
  },
  {
    key: "etsy", slug: "etsy", name: "Etsy", hosts: ["etsy.com"],
    form: "https://www.etsy.com/ipreporting", formName: "Etsy Reporting Portal", verified: "opened, 200; policy page 403 to bots, portal confirmed via search",
    steps: ["Open the Reporting Portal and register as the owner.", "Add your original work, then report each listing that copies it.", "Use the listing link, not the shop link."],
    sources: ["https://www.etsy.com/ipreporting", "https://www.etsy.com/legal/ip-dmca/"],
  },
  {
    key: "redbubble", slug: "redbubble", name: "Redbubble", hosts: ["redbubble.com"],
    form: "https://help.redbubble.com/hc/en-us/requests/new", formName: "Redbubble Notice and Takedown report", email: "dmca@redbubble.com", verified: "403 to bots; form and dmca@redbubble.com from help.redbubble.com article 201579195 (found via search, not opened)",
    steps: ["Open the request form and choose Notice and Takedown.", "List the link to each product page, not a search results page.", "Add the link to your original and submit."],
    sources: ["https://help.redbubble.com/hc/en-us/requests/new", "https://help.redbubble.com/hc/en-us/articles/201579195-Redbubble-IP-Publicity-Rights-Policy"],
  },
  {
    key: "amazon", slug: "amazon", name: "Amazon", hosts: ["amazon.*"],
    form: "https://www.amazon.com/report/infringement", formName: "Amazon Report Infringement form", verified: "opened, 200 (asks you to sign in)",
    steps: ["Sign in and open the Report Infringement form.", "Choose copyright and paste the link to the product page.", "Add the link to your original and submit."],
    sources: ["https://www.amazon.com/report/infringement"],
  },
  {
    key: "shopify", slug: null, name: "Shopify store", hosts: ["myshopify.com"],
    form: "https://www.shopify.com/legal/dmca", formName: "Shopify copyright report", verified: "opened, 200",
    steps: [], sources: ["https://www.shopify.com/legal/dmca"],
  },
];
const LANDINGS = PLATFORMS.filter((p) => p.slug);

const clientPlatforms = JSON.stringify(PLATFORMS.map((p) => ({ k: p.key, n: p.name, h: p.hosts, f: p.form, fn: p.formName, e: p.email || "" })));

const css = `:root{--sun:#ff8a2b;--sun2:#ffc24a;--bg:#fbf5ea;--bg2:#f3e8d5;--ink:#2a1d14;--ink2:#6b5846;--ink3:#857260;--card:#fffaf1;--line:rgba(60,35,10,.12);--sunink:#9a4a00;--dark:#14100d;--darkink:#fbf3e8;--ok:#2f7a3d;--err:#a3240f;--disp:"Sora",ui-sans-serif,system-ui,sans-serif;--body:"DM Sans",ui-sans-serif,system-ui,sans-serif;--gutter:clamp(16px,5vw,72px);color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0c0a09;--bg2:#14110f;--ink:#fbf3e8;--ink2:#bcae9d;--ink3:#8a7c6d;--card:#1a1613;--line:rgba(255,235,210,.12);--sunink:#ffc98a;--dark:#201a16;--ok:#7bd68a;--err:#ff9a85;color-scheme:dark}}
:root[data-theme=dark]{--bg:#0c0a09;--bg2:#14110f;--ink:#fbf3e8;--ink2:#bcae9d;--ink3:#8a7c6d;--card:#1a1613;--line:rgba(255,235,210,.12);--sunink:#ffc98a;--dark:#201a16;--ok:#7bd68a;--err:#ff9a85;color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:17px/1.55 var(--body);-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit;text-underline-offset:3px}
.wrap{max-width:1100px;margin:0 auto;padding:0 var(--gutter)}
.nav{display:flex;align-items:center;justify-content:space-between;padding:18px 0}
.mk{display:flex;align-items:center;gap:10px;font:700 1.35rem var(--disp);letter-spacing:-.04em;text-decoration:none}
.mk svg{width:38px;height:38px;color:var(--ink)}
.pill{display:inline-block;background:linear-gradient(180deg,var(--sun2),var(--sun));color:#2a1406;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:.98rem;border:0;cursor:pointer;font-family:var(--body);text-align:center}
.pill[aria-disabled=true]{opacity:.45;pointer-events:none}
.ghost{display:inline-block;padding:11px 18px;border-radius:999px;border:1px solid var(--line);text-decoration:none;font-weight:600;font-size:.95rem;text-align:center;background:transparent;color:inherit;cursor:pointer;font-family:var(--body)}
.eyebrow{font:600 .78rem var(--body);letter-spacing:.14em;text-transform:uppercase;color:var(--sunink)}
h1{font:800 clamp(2rem,3.8vw,3.1rem)/1.02 var(--disp);letter-spacing:-.05em;margin-top:10px;text-wrap:balance}
.lead{text-wrap:pretty;color:var(--ink2);max-width:40em;margin-top:12px;font-size:1.05rem}
.crumbs{font-size:.88rem;color:var(--ink3);margin-top:4px}
.crumbs a{text-decoration:none}
.tool{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:18px;margin-top:24px;align-items:stretch}
.card{background:var(--card);border:1px solid var(--line);border-radius:24px;padding:clamp(18px,2.4vw,26px)}
.out{background:var(--dark);color:var(--darkink);border-radius:24px;padding:clamp(18px,2.4vw,26px);position:relative;overflow:hidden;display:flex;flex-direction:column;gap:12px}
.out::before{content:"";position:absolute;inset:-40% -30% auto auto;width:320px;height:320px;background:radial-gradient(circle,rgba(255,170,60,.3),transparent 65%);pointer-events:none}
.out>*{position:relative}
.out h2{font:600 .75rem var(--body);letter-spacing:.14em;text-transform:uppercase;color:rgba(251,243,232,.6)}
.form{display:grid;gap:12px}
.form label{display:grid;gap:5px;font-weight:600;font-size:.92rem}
.form input,.form select,.box{width:100%;border:1px solid var(--line);border-radius:14px;background:var(--bg);padding:12px 14px;font:inherit;font-weight:400;color:var(--ink);outline:none}
.form input:focus,.form select:focus{border-color:var(--sun)}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.seg{display:flex;gap:8px;flex-wrap:wrap}
.seg label{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;padding:9px 16px;cursor:pointer;font-weight:600;font-size:.92rem;background:var(--bg)}
.seg input{width:auto;accent-color:var(--sun)}
.seg label:has(input:checked){border-color:var(--sun);background:color-mix(in srgb,var(--sun) 16%,transparent)}
.badge{display:inline-flex;align-items:center;gap:8px;align-self:flex-start;font:700 .72rem var(--body);letter-spacing:.08em;text-transform:uppercase;padding:6px 12px;border-radius:999px;background:var(--sun2);color:#2a1406}
.big{font:800 clamp(1.5rem,2.6vw,2rem)/1.1 var(--disp);letter-spacing:-.04em}
.small{font-size:.88rem;color:rgba(251,243,232,.7)}
.notice{width:100%;min-height:170px;flex:1;resize:none;background:rgba(255,235,210,.07);color:var(--darkink);border:1px solid rgba(255,235,210,.14);border-radius:14px;padding:12px 14px;font:.82rem/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;outline:none}
.acts{display:flex;flex-wrap:wrap;gap:8px}
.out .ghost{border-color:rgba(255,235,210,.28);color:var(--darkink)}
.note{font-size:.92rem;min-height:1.3em;font-weight:600}
.note.err{color:var(--err)}
.out .note.err{color:#ff9a85}
.hint{color:var(--ink3);font-size:.88rem}
.pl{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:16px;font-size:.92rem;color:var(--ink2)}
.pl a{text-decoration:none;border-bottom:1px solid var(--line)}
.pl a:hover,.pl a.on{color:var(--sunink);border-color:var(--sun)}
section{margin-top:clamp(40px,6vw,72px)}
h2.t{font:700 clamp(1.4rem,2.6vw,1.9rem)/1.1 var(--disp);letter-spacing:-.035em;text-wrap:balance}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:20px;counter-reset:s}
.step{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:22px}
.step::before{counter-increment:s;content:counter(s);display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:linear-gradient(180deg,var(--sun2),var(--sun));color:#2a1406;font:800 1rem var(--disp)}
.step h3{font:700 1.1rem/1.2 var(--disp);letter-spacing:-.02em;margin-top:12px}
.step p{color:var(--ink2);margin-top:6px;font-size:.96rem}
.faq{margin-top:16px;display:grid;gap:10px}
.faq details{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px 20px}
.faq summary{cursor:pointer;font:700 1.02rem var(--disp);letter-spacing:-.01em}
.faq p{color:var(--ink2);margin-top:10px;font-size:.98rem}
.cta{margin-top:clamp(40px,6vw,72px);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;padding:clamp(20px,3vw,32px);border-radius:26px;background:var(--dark);color:var(--darkink)}
.cta h2{font:800 clamp(1.4rem,2.6vw,1.9rem)/1.1 var(--disp);letter-spacing:-.04em;max-width:22em}
.cta p{color:rgba(251,243,232,.75);margin-top:6px;max-width:34em;font-size:.98rem}
.fine{color:var(--ink3);font-size:.86rem;margin:24px 0 56px;max-width:46em}
.grid4{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:24px}
.tc{display:flex;flex-direction:column;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:24px;padding:24px;text-decoration:none}
.tc h2{font:700 1.3rem/1.15 var(--disp);letter-spacing:-.03em}
.tc p{color:var(--ink2);font-size:.98rem}
.tc span{color:var(--sunink);font-weight:700;margin-top:auto;padding-top:8px}
.tc:hover{border-color:var(--sun)}
.kv{display:grid;grid-template-columns:7.5em 1fr;gap:6px 14px;font-size:.96rem}
.kv dt{color:rgba(251,243,232,.6)}
.kv dd{word-break:break-word;font-weight:600}
.range{display:grid;gap:10px}
.rng{background:rgba(255,235,210,.07);border-radius:14px;padding:12px 14px}
.rng b{display:block;font:800 1.5rem/1.1 var(--disp);letter-spacing:-.04em;color:var(--sun2)}
.rng span{font-size:.88rem;color:rgba(251,243,232,.78)}
.chk{display:grid;grid-template-columns:auto 1fr auto;gap:6px 14px;align-items:start;padding:12px 4px;border-bottom:1px solid var(--line)}
.chk input{width:20px;height:20px;margin-top:3px;accent-color:var(--sun)}
.chk b{display:block;font-weight:700}
.chk span{display:block;color:var(--ink2);font-size:.92rem}
.chk.done b{text-decoration:line-through;color:var(--ink3)}
.chk a{font-weight:600;font-size:.9rem;white-space:nowrap}
.grp{font:700 .74rem var(--body);letter-spacing:.12em;text-transform:uppercase;color:var(--sunink);margin:18px 0 2px}
.prog{height:8px;border-radius:99px;background:var(--line);overflow:hidden;margin-top:6px}
.prog i{display:block;height:100%;background:linear-gradient(90deg,var(--sun2),var(--sun));width:0;transition:width .2s}
pre.code{background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:14px;font:.8rem/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;overflow:auto;max-height:260px;white-space:pre}
.hp{position:absolute;left:-9999px}
[hidden]{display:none!important}
@media (max-width:900px){.tool{grid-template-columns:1fr}.steps{grid-template-columns:1fr}.grid4{grid-template-columns:1fr}}
@media (max-width:560px){.row2{grid-template-columns:1fr}.chk{grid-template-columns:auto 1fr}.chk a{grid-column:2}}`;

const faqLd = (faqs) => ({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a.replace(/<[^>]+>/g, "") } })) });

function shell({ path, title, ogTitle, desc, h1, lead, crumbs, body, how, faqs, cta, script, github, appName, preset }) {
  const url = `${SITE}${path}`;
  const ld = [
    { "@context": "https://schema.org", "@type": "WebApplication", name: appName || ogTitle, url, description: desc, applicationCategory: "UtilitiesApplication", operatingSystem: "Any", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, publisher: { "@type": "Organization", name: brand.name, url: `${SITE}/` } },
    ...(faqs?.length ? [faqLd(faqs)] : []),
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map(([n, u], i) => ({ "@type": "ListItem", position: i + 1, name: n, item: `${SITE}${u}` })) },
  ];
  const crumbHtml = crumbs.slice(1).map(([n, u], i, a) => (i === a.length - 1 ? esc(n) : `<a href="${u}">${esc(n)}</a>`)).join(" / ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(brand.name)}">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle)}">
<meta name="twitter:description" content="${esc(desc)}">
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
<body${preset ? ` data-preset="${preset}"` : ""}>${sprite}<div class="wrap">
<nav class="nav"><a class="mk" href="/" aria-label="${esc(brand.name)}">${mark}${esc(brand.name.toLowerCase())}</a><div class="navr">${starButton(github)}<a class="pill" href="/protect/?ref=tool-nav">Emera Protect</a></div></nav>
<main>
<div class="eyebrow">Free tool</div>
<h1>${esc(h1)}</h1>
<p class="lead">${esc(lead)}</p>
<p class="crumbs">${crumbHtml}</p>
${body}
<section aria-labelledby="h-how"><h2 class="t" id="h-how">How it works</h2><div class="steps">${how.map(([h, p]) => `<div class="step"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join("")}</div></section>
<section aria-labelledby="h-faq"><h2 class="t" id="h-faq">Questions</h2><div class="faq">${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join("")}</div></section>
<div class="cta"><div><h2>${esc(cta.h)}</h2><p>${esc(cta.p)}</p></div><a class="pill" href="${cta.href}">${esc(cta.label)}</a></div>
${cta.fine ? `<p class="fine">${cta.fine}</p>` : `<p class="fine"></p>`}
</main>
</div>${footer({ pages, mark, github, year: new Date().getFullYear() })}${script || ""}</body></html>`;
}

const COPY_JS = `function copy(t,b){var o=b.textContent;function ok(){b.textContent="Copied";setTimeout(function(){b.textContent=o},1500)}if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,function(){fb()});else fb();function fb(){var a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();try{document.execCommand("copy");ok()}catch(e){}a.remove()}}`;

/* ---------- 1. takedown notice ---------- */

const TD_BODY = (p) => `<div class="tool" data-td>
<div class="card"><form class="form" novalidate autocomplete="on">
<label>Link to the copy<input name="copy" inputmode="url" maxlength="500" placeholder="https://${p ? p.hosts[0].replace("amazon.*", "amazon.com") : "www.tiktok.com"}/..." autocomplete="off"></label>
<label>Link to your original<input name="orig" inputmode="url" maxlength="500" placeholder="https://" autocomplete="off"></label>
<div class="row2"><label>Your name<input name="name" autocomplete="name" maxlength="120"></label><label>Your email<input type="email" name="email" autocomplete="email" maxlength="254"></label></div>
<label>What it is (optional)<input name="desc" maxlength="300" placeholder="My reel from 14 March, posted by me first"></label>
</form>
<p class="note" data-note role="status" aria-live="polite"></p>
<p class="hint">Nothing you type leaves this page until you press Track it with Emera.</p>
<p class="pl">${p ? "Other places: " : "Start from: "}${LANDINGS.filter((x) => x !== p).map((x) => `<a href="/tools/takedown-notice/${x.slug}/">${esc(x.name)}</a>`).join("")}</p>
</div>
<div class="out">
<span class="badge" data-badge>Paste the link to the copy</span>
<div class="big" data-head>We find the right form</div>
<div class="acts"><a class="pill" data-form href="#" rel="noopener" target="_blank" aria-disabled="true">Open the official form</a><button class="ghost" type="button" data-copy>Copy notice</button><a class="ghost" data-mail href="#" hidden>Email it</a></div>
<textarea class="notice" data-notice readonly aria-label="Your DMCA takedown notice"></textarea>
<div class="acts"><button class="pill" type="button" data-track>Track it with Emera</button></div>
<p class="small" data-trackhint>Free. We use the email you typed, so there is nothing to fill in twice.</p>
</div>
</div>`;

const TD_SCRIPT = (p) => `<script>(function(){var P=${clientPlatforms},preset=${JSON.stringify(p ? p.key : "")};${COPY_JS}
var root=document.querySelector("[data-td]");if(!root)return;var f=root.querySelector("form"),$=function(s){return root.querySelector(s)},note=$("[data-note]"),badge=$("[data-badge]"),head=$("[data-head]"),form=$("[data-form]"),mail=$("[data-mail]"),ta=$("[data-notice]"),track=$("[data-track]");
function parse(u){u=(u||"").trim();if(!u)return null;try{var x=new URL(/^https?:\\/\\//i.test(u)?u:"https://"+u);return x.hostname.indexOf(".")>0?x:null}catch(e){return null}}
function match(h){h=h.replace(/^www\\./,"").toLowerCase();for(var i=0;i<P.length;i++){var q=P[i];for(var j=0;j<q.h.length;j++){var d=q.h[j];if(d==="amazon.*"?/(^|\\.)amazon\\.[a-z.]+$/.test(h):(h===d||h.slice(-d.length-1)==="."+d))return q}}return null}
function find(k){for(var i=0;i<P.length;i++)if(P[i].k===k)return P[i];return null}
function build(pl){var v=function(n){return f[n].value.trim()},nm=v("name")||"[your name]",em=v("email")||"[your email]",orig=v("orig")||"[link to your original]",cp=v("copy")||"[link to the copy]",d=v("desc"),to=pl?pl.n+" copyright agent":"The copyright agent at the site host";
var dt=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
return "To: "+to+"\\nSubject: Copyright takedown notice (17 U.S.C. 512(c)(3))\\n\\nI am writing to ask you to remove material that copies my work.\\n\\n1. My copyrighted work\\nOriginal: "+orig+(d?"\\nAbout it: "+d:"")+"\\n\\n2. The infringing material\\nCopy: "+cp+"\\nPlease remove it or disable access to it.\\n\\n3. My contact details\\n"+nm+"\\n"+em+"\\n\\n4. Good faith statement\\nI have a good faith belief that the use of this material is not authorized by the copyright owner, its agent, or the law.\\n\\n5. Accuracy and authority\\nThe information in this notice is accurate, and under penalty of perjury, I am the owner of the copyright in the work described above, or authorized to act for the owner.\\n\\n6. Signature\\n/"+nm+"/\\n"+dt+"\\n"}
function render(){var cu=parse(f.copy.value),pl=cu?match(cu.hostname):find(preset);note.textContent="";note.className="note";
if(f.copy.value.trim()&&!cu){note.textContent="That does not look like a link yet.";note.classList.add("err")}
var generic=cu&&!pl;
if(pl){badge.textContent=cu?"Detected: "+pl.n:pl.n;head.textContent=pl.n+" has its own form";form.textContent="Open the "+pl.fn;form.href=pl.f;form.setAttribute("aria-disabled","false");form.removeAttribute("hidden")}
else if(generic){badge.textContent="Detected: "+cu.hostname.replace(/^www\\./,"");head.textContent="Send it to the site's host";form.textContent="Find who hosts it";form.href="/tools/who-hosts/?url="+encodeURIComponent(cu.href);form.removeAttribute("target");form.setAttribute("aria-disabled","false")}
else{badge.textContent="Paste the link to the copy";head.textContent="We find the right form";form.textContent="Open the official form";form.href="#";form.setAttribute("aria-disabled","true")}
if(pl)form.target="_blank";
var text=build(pl);ta.value=text;
if(pl&&pl.e){mail.hidden=false;mail.href="mailto:"+pl.e+"?subject="+encodeURIComponent("Copyright takedown notice (17 U.S.C. 512(c)(3))")+"&body="+encodeURIComponent(text);mail.textContent="Email it to "+pl.e}else mail.hidden=true}
f.addEventListener("input",render);f.addEventListener("submit",function(e){e.preventDefault()});
$("[data-copy]").addEventListener("click",function(){copy(ta.value,this)});
form.addEventListener("click",function(e){if(form.getAttribute("aria-disabled")==="true")e.preventDefault()});
track.addEventListener("click",function(){var em=f.email.value.trim(),ok=/^[^\\s@]+@[^\\s@.]+(\\.[^\\s@.]+)+$/.test(em);
if(!ok){location.href="/protect/?ref=tool-takedown";return}
track.disabled=true;track.textContent="Opening Emera...";
fetch("/api/early",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:em,source:"tool-takedown",website:"",referrer:document.referrer||null})}).catch(function(){}).then(function(){location.href="/sign-in?email="+encodeURIComponent(em)+"&next=%2Fprotect"})});
var q=new URLSearchParams(location.search);if(q.get("copy"))f.copy.value=q.get("copy");if(q.get("orig"))f.orig.value=q.get("orig");
render()})()</script>`;

const TD_HOW = [
  ["Paste two links", "The copy you found and your original. We read the site name from the first link."],
  ["Send the notice", "We open that platform's own copyright form and write the notice with every item the law asks for. Copy it, paste it, send it."],
  ["Follow it up", "Platforms usually reply within days. Emera can keep track of it and chase it for you."],
];
const TD_FAQ = [
  ["What is in the notice?", "The six items US copyright law lists for a takedown notice (17 U.S.C. 512(c)(3)): a signature, your original work, the copy and where it is, your contact details, a good faith statement, and a statement under penalty of perjury that you own the work or act for the owner."],
  ["Does it cost anything or need an account?", "No. It runs in your browser and nothing you type is sent to us. If you press Track it with Emera, only then we get your email."],
  ["Which sites does it know?", "Instagram, TikTok, YouTube, Facebook, X, Pinterest, Etsy, Redbubble, Amazon and Shopify stores. For any other site it points you to the tool that finds who hosts it, so you can send the notice there."],
  ["What happens after I send it?", "The platform reviews it and, if it holds up, removes the copy. The other person can answer with a counter-notice. If they do, the platform may put the copy back after 10 to 14 business days unless you tell it you have gone to court (17 U.S.C. 512(g)). Only send a notice for work that is yours: knowingly false notices can make you liable for damages (512(f)). This is not legal advice."],
];
const TD_CTA = { h: "Found one copy? There are usually more", p: "Emera Protect finds the reposts, files the takedowns and follows each one until it is gone. Free to report.", label: "Track it with Emera", href: "/protect/?ref=tool-takedown-cta" };

function takedownPages(github) {
  const out = [];
  out.push({
    path: "/tools/takedown-notice/",
    html: shell({
      path: "/tools/takedown-notice/", title: "Free DMCA takedown notice generator | Emera", ogTitle: "Free takedown notice",
      desc: "Paste the link to the copy and your original. Get the official copyright form for that platform and a ready DMCA notice with every legal element filled in. Free, no sign-up.",
      h1: "Free takedown notice for stolen work", lead: "Paste the link to the copy and your original. You get the platform's own form and a notice that is ready to send.",
      crumbs: [[brand.name, "/"], ["Free tools", "/tools/"], ["Takedown notice", "/tools/takedown-notice/"]],
      body: TD_BODY(null), how: TD_HOW, faqs: TD_FAQ, cta: TD_CTA, script: TD_SCRIPT(null), github, appName: "Free takedown notice",
    }),
  });
  for (const p of LANDINGS) {
    const path = `/tools/takedown-notice/${p.slug}/`;
    out.push({
      path,
      html: shell({
        path, title: `${p.name} takedown notice: free generator | Emera`, ogTitle: `${p.name} takedown notice: free generator`,
        desc: `Someone copied your work on ${p.name}? Paste the links and get the official ${p.name} copyright form plus a ready DMCA notice. Free, no sign-up.`,
        h1: `${p.name} takedown notice, ready in a minute`, lead: `Paste the link to the copy on ${p.name} and your original. You get ${p.name}'s own form and a notice to paste into it.`,
        crumbs: [[brand.name, "/"], ["Free tools", "/tools/"], ["Takedown notice", "/tools/takedown-notice/"], [p.name, path]],
        body: TD_BODY(p) + `<section aria-labelledby="h-steps"><h2 class="t" id="h-steps">Reporting a copy on ${esc(p.name)}</h2><div class="steps">${p.steps.map((s, i) => `<div class="step"><h3>Step ${i + 1}</h3><p>${esc(s)}</p></div>`).join("")}</div></section>`,
        how: TD_HOW, faqs: [[`Where is the ${p.name} copyright form?`, `It is here: <a href="${p.form}" rel="noopener">${esc(p.formName)}</a>. The tool above opens it for you and writes the notice to paste in.`], ...TD_FAQ], cta: TD_CTA, script: TD_SCRIPT(p), github, preset: p.key, appName: `${p.name} takedown notice`,
      }),
    });
  }
  return out;
}

/* ---------- 2. case worth ---------- */

const CW_BODY = `<div class="tool" data-cw>
<div class="card"><form class="form" novalidate>
<div><div class="hint" style="font-weight:600;color:var(--ink);margin-bottom:6px">Where are you</div><div class="seg"><label><input type="radio" name="where" value="us" checked>United States</label><label><input type="radio" name="where" value="other">Somewhere else</label></div></div>
<div><div class="hint" style="font-weight:600;color:var(--ink);margin-bottom:6px">Did you register the work with the US Copyright Office before the copying, or within 3 months of publishing it</div><div class="seg"><label><input type="radio" name="reg" value="yes">Yes</label><label><input type="radio" name="reg" value="no">No</label><label><input type="radio" name="reg" value="unsure" checked>Not sure</label></div></div>
<div><div class="hint" style="font-weight:600;color:var(--ink);margin-bottom:6px">Did they make money with it</div><div class="seg"><label><input type="radio" name="money" value="yes">Yes</label><label><input type="radio" name="money" value="no">No</label><label><input type="radio" name="money" value="unsure" checked>Not sure</label></div></div>
<label>How many of your works were copied<input type="number" name="works" min="1" max="500" value="1" inputmode="numeric"></label>
</form></div>
<div class="out" data-out aria-live="polite"></div>
</div>`;

const CW_SCRIPT = `<script>(function(){var r=document.querySelector("[data-cw]");if(!r)return;var f=r.querySelector("form"),o=r.querySelector("[data-out]");
function v(n){var e=f.querySelector("input[name="+n+"]:checked");return e?e.value:""}
function $(n){return "$"+Math.round(n).toLocaleString("en-US")}
function render(){var w=Math.max(1,Math.min(500,parseInt(f.works.value,10)||1)),reg=v("reg"),us=v("where")==="us",money=v("money"),h="";
var wk=w===1?"1 work":w+" works";
if(!us)h+='<p class="small">These ranges come from US law. They apply when the copying happens in the US. Elsewhere the rules differ by country, and the takedown works the same everywhere.</p>';
if(reg==="yes"){h+='<h2>Registered in time</h2><div class="range"><div class="rng"><b>'+$(750*w)+" to "+$(30000*w)+'</b><span>Court-set statutory damages for '+wk+": $750 to $30,000 each, no need to prove a loss</span></div><div class=\\"rng\\"><b>Up to "+$(150000*w)+'</b><span>If the court finds it willful, up to $150,000 per work. Attorney fees can be added</span></div></div>'}
else if(reg==="no"){h+='<h2>Not registered in time</h2><div class="range"><div class="rng"><b>Your real loss + their profit</b><span>A court can award actual damages and what they earned from your work. No set minimum, no statutory damages and no attorney fees in court</span></div></div>'}
else{h+='<h2>It depends on one date</h2><div class="range"><div class="rng"><b>'+$(750*w)+" to "+$(30000*w)+'</b><span>If you registered in time: $750 to $30,000 per work, up to $150,000 per work if willful</span></div><div class="rng"><b>Your real loss + their profit</b><span>If you did not: actual damages and their profits only</span></div></div><p class="small">Check the date in the <a href="https://publicrecords.copyright.gov/" rel="noopener" style="color:inherit">Copyright Office public records</a>.</p>'}
if(money==="yes")h+='<p class="small">Their profit from your work counts, so keep proof of what they earned: ad revenue, sales, a brand deal.</p>';
else if(money==="no")h+='<p class="small">If they made nothing, your own loss may be small. Statutory damages (if you registered in time) do not depend on profit.</p>';
h+='<div class="rng"><b>Copyright Claims Board: up to $30,000</b><span><a href="https://ccb.gov" rel="noopener" style="color:inherit">ccb.gov</a> is the cheaper route. $30,000 per case, $15,000 per work, $100 to file. Not registered in time: $7,500 per work, $15,000 in total. The work must be registered or an application filed</span></div>';
h+='<div class="acts"><a class="pill" href="/protect/?ref=tool-case-worth#paid">Get paid</a><span class="small" style="align-self:center">You keep 70%, no win no fee</span></div><p class="small">Ranges, not predictions: courts pick the number. Not legal advice.</p>';
o.innerHTML=h}
f.addEventListener("input",render);f.addEventListener("change",render);render()})()</script>`;

const CW_FAQ = [
  ["What does registered in time mean?", "You registered the work with the US Copyright Office before the copying began, or within 3 months after you first published it (17 U.S.C. 412). Registering after that still helps going forward, but it does not bring back statutory damages for copying that already started."],
  ["Why are the ranges so wide?", "For each work, the court picks a sum between $750 and $30,000, and up to $150,000 if the copying was willful (17 U.S.C. 504(c)). The sum is per work, not per copy or per view."],
  ["What is the Copyright Claims Board?", "A small claims panel inside the US Copyright Office. It handles claims up to $30,000 without a lawyer, and the other side can opt out. Sources: ccb.gov and 17 U.S.C. 1504."],
  ["Do I have to sue?", "No. Most cases end with a takedown or a payment after a claim letter. A court is the last step, not the first."],
];

function caseWorthPage(github) {
  return {
    path: "/tools/case-worth/",
    html: shell({
      path: "/tools/case-worth/", title: "What is your stolen work worth? Free calculator | Emera", ogTitle: "What is your stolen work worth",
      desc: "Four questions, a plain answer: what a court can award when someone copies your work. US statutory damages, the Copyright Claims Board, and what changes if you did not register.",
      h1: "What is your stolen work worth", lead: "Four questions. You get the ranges US law allows, in plain words, with the sources.",
      crumbs: [[brand.name, "/"], ["Free tools", "/tools/"], ["Case worth", "/tools/case-worth/"]],
      body: CW_BODY, how: [["Answer four questions", "Where you are, whether you registered in time, whether they made money, how many works."], ["See the ranges", "Statutory damages, the Copyright Claims Board and real loss, each with its limit."], ["Decide", "Send a takedown, make a claim, or let Emera chase the money for a 70% share."]],
      faqs: CW_FAQ, cta: { h: "They made money with your work. Get paid", p: "We send the claim for what they owe you. No win, no fee, you keep 70%.", label: "Get paid", href: "/protect/?ref=tool-case-worth-cta#paid" },
      script: CW_SCRIPT, github, appName: "What is your stolen work worth",
      // sources
    }).replace("<p class=\"fine\"></p>", `<p class="fine">Sources: <a href="https://www.law.cornell.edu/uscode/text/17/504" rel="noopener">17 U.S.C. 504</a>, <a href="https://www.law.cornell.edu/uscode/text/17/412" rel="noopener">17 U.S.C. 412</a>, <a href="https://www.law.cornell.edu/uscode/text/17/1504" rel="noopener">17 U.S.C. 1504</a>, <a href="https://ccb.gov/about/" rel="noopener">ccb.gov</a>, <a href="https://www.copyright.gov/title17/92chap5.html" rel="noopener">copyright.gov chapter 5</a>.</p>`),
  };
}

/* ---------- 3. who hosts ---------- */

const WH_BODY = `<div class="tool" data-wh>
<div class="card"><form class="form" novalidate>
<label>Link to the site or page<input name="url" inputmode="url" maxlength="500" placeholder="https://example.com/the-copy" autocomplete="off" autofocus></label>
<button class="pill" type="submit">Find the host</button>
</form>
<p class="note" data-note role="status" aria-live="polite"></p>
<p class="hint">We look up public records only: the domain's address, then who owns that address. We never open the site.</p></div>
<div class="out" data-out aria-live="polite"><span class="badge">Result</span><div class="big">Paste a link to see who hosts it</div><p class="small">The host is who you send a copyright notice to when the site itself does not answer.</p></div>
</div>`;

const WH_SCRIPT = `<script>(function(){${COPY_JS}
var r=document.querySelector("[data-wh]");if(!r)return;var f=r.querySelector("form"),n=r.querySelector("[data-note]"),o=r.querySelector("[data-out]"),b=f.querySelector("button");
function E(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function go(){var u=f.url.value.trim();n.className="note";n.textContent="";if(!u){n.textContent="Add the link first.";n.classList.add("err");return}
b.disabled=true;b.textContent="Looking...";
fetch("/api/tools/who-hosts?url="+encodeURIComponent(u)).then(function(x){return x.json().then(function(j){return{s:x.status,j:j}})}).then(function(x){b.disabled=false;b.textContent="Find the host";var j=x.j;
if(!j.ok){n.textContent=j.error==="invalid_url"?"That does not look like a link to a website.":j.error==="rate_limited"?"Too many lookups. Try again in a minute.":j.error==="no_address"?"We could not find that site's address. Check the link.":"The lookup failed. Try again in a moment.";n.classList.add("err");return}
var h='<span class="badge">'+E(j.domain)+'</span><div class="big">'+E(j.host||"Host not named in public records")+"</div><dl class=\\"kv\\">";
h+="<dt>Address</dt><dd>"+E(j.ip)+"</dd>";if(j.network)h+="<dt>Network</dt><dd>"+E(j.network)+"</dd>";if(j.registrar)h+="<dt>Domain registrar</dt><dd>"+E(j.registrar)+"</dd>";
h+="<dt>Abuse email</dt><dd>"+(j.abuseEmail?E(j.abuseEmail):"None listed")+"</dd></dl>";
if(j.cdn)h+='<p class="small">This site sits behind '+E(j.cdn)+'. That company passes notices on to the real host. '+(j.cdnForm?'Its form: <a href="'+E(j.cdnForm)+'" rel="noopener" style="color:inherit">'+E(j.cdnForm)+"</a>":"")+"</p>";
h+='<div class="acts">';if(j.abuseEmail)h+='<a class="pill" href="mailto:'+E(j.abuseEmail)+'">Email the abuse address</a><button class="ghost" type="button" data-cp="'+E(j.abuseEmail)+'">Copy email</button>';
h+='<a class="'+(j.abuseEmail?"ghost":"pill")+'" href="https://dmca.copyright.gov/osp/" target="_blank" rel="noopener">Search the DMCA agent directory</a></div>';
h+='<p class="small">Search the directory for '+E(j.host||j.domain)+" to find the address its copyright agent uses. Then <a href=\\"/tools/takedown-notice/?copy="+encodeURIComponent(j.url)+'" style="color:inherit">write the notice</a>.</p>';
o.innerHTML=h;var c=o.querySelector("[data-cp]");if(c)c.addEventListener("click",function(){copy(c.getAttribute("data-cp"),c)})}).catch(function(){b.disabled=false;b.textContent="Find the host";n.textContent="The lookup failed. Try again in a moment.";n.classList.add("err")})}
f.addEventListener("submit",function(e){e.preventDefault();go()});
var q=new URLSearchParams(location.search).get("url");if(q){f.url.value=q;go()}})()</script>`;

function whoHostsPage(github) {
  return {
    path: "/tools/who-hosts/",
    html: shell({
      path: "/tools/who-hosts/", title: "Who hosts this site? Free lookup | Emera", ogTitle: "Who hosts this site",
      desc: "Paste any website link. Get the hosting company, the domain registrar and the abuse email from public records, plus a link to the US DMCA agent directory.",
      h1: "Who hosts this site", lead: "Paste any link. You get the company that hosts it and the address to send a copyright notice to.",
      crumbs: [[brand.name, "/"], ["Free tools", "/tools/"], ["Who hosts this site", "/tools/who-hosts/"]],
      body: WH_BODY, how: [["Paste the link", "Any page of the site that copied your work."], ["We read public records", "The domain's address from Cloudflare DNS, then the owner of that address from the regional internet registry."], ["Send the notice", "Email the abuse address or find the DMCA agent in the US Copyright Office directory."]],
      faqs: [
        ["Where does the answer come from?", "Public records only: a DNS lookup for the site's address and an RDAP lookup (the standard registry record) for who owns that address. We never open or scan the site."],
        ["The result says Cloudflare. Now what?", "Cloudflare sits in front of many sites and hides the real host. It will forward your notice to the host. Report through its abuse form and it tells the site owner."],
        ["What is the DMCA agent directory?", "A US Copyright Office list of the address each US service provider has registered for copyright notices. A notice sent there carries legal weight."],
        ["What if no abuse email shows?", "Some networks list none. Use the DMCA agent directory, the host's own abuse page, or the registrar shown here."],
      ],
      cta: { h: "Skip the chasing", p: "Emera Protect finds the copies, works out who hosts them and files the takedown for you.", label: "See Emera Protect", href: "/protect/?ref=tool-who-hosts-cta" },
      script: WH_SCRIPT, github, appName: "Who hosts this site",
    }),
  };
}

/* ---------- 4. AI opt-out ---------- */

const ROBOTS = `User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Meta-ExternalAgent
Disallow: /`;

const OPT = [
  ["On the apps where you post", [
    ["meta", "Instagram and Facebook", "Meta has no single off switch for posts. Send the objection form; what Meta honors depends on where you live.", "https://www.facebook.com/help/contact/510058597920541", "Open the form"],
    ["x", "X and Grok", "Untick the box that lets X use your posts and Grok chats for training.", "https://x.com/settings/grok_settings", "Open the setting"],
    ["linkedin", "LinkedIn", "Settings, Data privacy, then turn off Data for Generative AI Improvement. Not shown in some regions.", "https://www.linkedin.com/help/linkedin/answer/a5538339", "How to turn it off"],
    ["pinterest", "Pinterest", "Settings, Privacy and data, untick Use your data to train Pinterest Canvas.", "https://help.pinterest.com/en/article/manage-genai-settings", "How to turn it off"],
    ["deviantart", "DeviantArt", "Mark your art NoAI so dataset builders skip it.", "https://www.deviantart.com/team/journal/A-New-Standard-for-Opting-Out-of-AI-Datasets-934500371", "How it works"],
    ["adobe", "Adobe", "Personal accounts can switch off content analysis. Adobe says it does not train generative AI on your files.", "https://account.adobe.com/privacy", "Open privacy settings"],
  ]],
  ["On your own website", [
    ["squarespace", "Squarespace", "Settings, Crawlers: ask AI crawlers to stay out.", "https://support.squarespace.com/hc/en-us/articles/360022347072-Request-that-AI-models-exclude-your-site", "How to do it"],
    ["wix", "Wix", "Add the AI crawlers to your robots.txt in the SEO settings.", "https://support.wix.com/en/article/blocking-ai-crawlers-from-your-site", "How to do it"],
    ["robots", "Any other site", "Paste the lines in the box below into your robots.txt file.", "", ""],
  ]],
  ["Tools that work on the picture itself", [
    ["spawning", "Have I Been Trained", "Search the images used in open training sets and add yours to the Do Not Train registry.", "https://haveibeentrained.com/", "Open the site"],
    ["glaze", "Glaze and Nightshade", "Free University of Chicago tools that change your image in ways people do not see. The project site was unreachable when we checked on 26 November 2026.", "https://glaze.cs.uchicago.edu/", "Open the site"],
  ]],
];
const OPT_COUNT = OPT.reduce((n, [, items]) => n + items.length, 0);

const AO_BODY = `<div class="card" data-ao style="margin-top:24px">
<div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap"><b data-count>0 of ${OPT_COUNT} done</b><span class="hint">Saved in this browser only</span></div>
<div class="prog" aria-hidden="true"><i data-bar></i></div>
${OPT.map(([g, items]) => `<div class="grp">${esc(g)}</div>${items.map(([id, t, d, href, label]) => `<div class="chk" data-id="${id}"><input type="checkbox" id="c-${id}" aria-label="${esc(t)} done"><label for="c-${id}"><b>${esc(t)}</b><span>${esc(d)}</span></label>${href ? `<a href="${href}" target="_blank" rel="noopener">${esc(label)}</a>` : ""}</div>`).join("")}`).join("")}
<div class="grp">robots.txt for your own site</div>
<pre class="code" data-code>${esc(ROBOTS)}</pre>
<div class="acts" style="margin-top:10px"><button class="pill" type="button" data-cp>Copy these lines</button></div>
<p class="fine" style="margin:14px 0 0">These stop future training, not models that were already trained. They ask crawlers to stay away and rely on each company to honor that. They leave Google Search and other search crawlers alone.</p>
</div>`;

const AO_SCRIPT = `<script>(function(){${COPY_JS}
var r=document.querySelector("[data-ao]");if(!r)return;var K="emera-ai-opt-out",s={};try{s=JSON.parse(localStorage.getItem(K)||"{}")||{}}catch(e){}
var rows=r.querySelectorAll(".chk"),c=r.querySelector("[data-count]"),bar=r.querySelector("[data-bar]");
function upd(){var n=0;rows.forEach(function(x){var on=x.querySelector("input").checked;x.classList.toggle("done",on);if(on)n++});c.textContent=n+" of "+rows.length+" done";bar.style.width=(n/rows.length*100)+"%"}
rows.forEach(function(x){var i=x.querySelector("input"),id=x.getAttribute("data-id");i.checked=!!s[id];i.addEventListener("change",function(){s[id]=i.checked;try{localStorage.setItem(K,JSON.stringify(s))}catch(e){}upd()})});upd();
var b=r.querySelector("[data-cp]");b.addEventListener("click",function(){copy(r.querySelector("[data-code]").textContent,b)})})()</script>`;

function aiOptOutPage(github) {
  return {
    path: "/tools/ai-opt-out/",
    html: shell({
      path: "/tools/ai-opt-out/", title: "Stop AI training on your work: opt-out checklist | Emera", ogTitle: "Stop AI training on your work",
      desc: "A tick-off checklist of the AI training opt-outs that exist today: Meta, X, LinkedIn, Pinterest, DeviantArt, Adobe, Squarespace, Wix, robots.txt and tools like Glaze. Official links, free.",
      h1: "Stop AI training on your work", lead: "Every opt-out we could verify, with the official link. Tick each one off as you go.",
      crumbs: [[brand.name, "/"], ["Free tools", "/tools/"], ["AI opt-out checklist", "/tools/ai-opt-out/"]],
      body: AO_BODY, how: [["Work down the list", "Start with the apps you post on. Each item opens the official setting or form."], ["Protect your own site", "Paste the robots.txt lines so the main AI crawlers are asked to skip it."], ["Add a layer", "Tools like Glaze change the image itself. Emera Protect watches for copies."]],
      faqs: [
        ["Does opting out remove my work from AI that already learned it?", "No. Opt-outs stop future training. Models that were already trained keep what they learned."],
        ["Do crawlers have to obey robots.txt?", "No. It is a request. The big AI companies say they honor it, and some other crawlers do not."],
        ["Will this hurt my search ranking?", "These lines name AI training crawlers only. Google-Extended, for example, does not change how your site appears in Google Search."],
        ["Why does the list not include every platform?", "We only list opt-outs we could open and read on 26 November 2026. If a platform you use is missing, it has none we could confirm."],
      ],
      cta: { h: "An opt-out does not catch copies", p: "Emera Protect finds reposts and copies of your work and files the takedown.", label: "See Emera Protect", href: "/protect/?ref=tool-ai-opt-out-cta" },
      script: AO_SCRIPT, github, appName: "AI opt-out checklist",
    }),
  };
}

/* ---------- index ---------- */

function indexPage(github) {
  const items = [
    ["/tools/takedown-notice/", "Free takedown notice", "Paste the link to the copy. Get the platform's official form and a ready DMCA notice."],
    ["/tools/case-worth/", "What is your stolen work worth", "Four questions, a plain answer on what a court can award."],
    ["/tools/who-hosts/", "Who hosts this site", "Find the host and the abuse email for any link."],
    ["/tools/ai-opt-out/", "Stop AI training on your work", "A checklist of every opt-out we could verify."],
  ];
  return {
    path: "/tools/",
    html: shell({
      path: "/tools/", title: "Free tools for creators whose work gets copied | Emera", ogTitle: "Free tools for creators",
      desc: "Four free tools for creators whose work gets copied: a takedown notice, a case value calculator, a host lookup and an AI opt-out checklist.",
      h1: "Free tools for when your work gets copied", lead: "Each one works in your browser with no account. When you want it handled for you, Emera Protect does that.",
      crumbs: [[brand.name, "/"], ["Free tools", "/tools/"]],
      body: `<div class="grid4">${items.map(([h, t, d]) => `<a class="tc" href="${h}"><h2>${esc(t)}</h2><p>${esc(d)}</p><span>Open</span></a>`).join("")}</div>`,
      how: [["Find the copy", "Use any of these once you spot a repost, a print or a fake account."], ["Use the tool", "Each one gives you something you can send or act on right away."], ["Let Emera follow up", "Protect tracks the takedown and goes after the money."]],
      faqs: [["Are these really free?", "Yes. No sign-up and no card. Emera Protect is a separate paid plan with a free tier for reporting."], ["Do you keep what I type?", "The takedown notice runs in your browser. The host lookup sends the domain to our server to read public records and keeps nothing."]],
      cta: { h: "Someone stole your work? We take it down", p: "Emera Protect files the takedown, follows it until it is gone and goes after the money.", label: "See Emera Protect", href: "/protect/?ref=tools-index" },
      github, appName: "Free tools for creators",
    }),
  };
}

export function writeTools(today, { github }) {
  const list = [indexPage(github), ...takedownPages(github), caseWorthPage(github), whoHostsPage(github), aiOptOutPage(github)];
  for (const p of list) {
    const dir = join(root, "public", p.path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), p.html);
  }
  const sitemap = join(root, "public/sitemap.xml");
  let xml = readFileSync(sitemap, "utf8");
  const add = list.filter((p) => !xml.includes(`${SITE}${p.path}<`)).map((p) => `<url><loc>${SITE}${p.path}</loc><lastmod>${today}</lastmod></url>`);
  if (add.length) writeFileSync(sitemap, xml.replace("</urlset>", `${add.join("\n")}\n</urlset>`));
  return list.length;
}
