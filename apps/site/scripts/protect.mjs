import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { footer, footerCss, starButton } from "./footer.mjs";
import { pages } from "./pages.mjs";
import { sprite } from "./screens.mjs";

const FAQS = [{"q": "Someone reposted my reel or TikTok. Can you get it removed?", "a": "Yes. Send us the link to the copy and your original. We file the copyright notice with the app that hosts it and check it every day until it is gone, then you get a Removed receipt."}, {"q": "Do I need to register my work first?", "a": "No. You own the copyright the moment you make something, and that is enough for a takedown. In the US, registering with the Copyright Office matters if you want to sue for damages, and we help you do it."}, {"q": "What about a fake account using my name or face?", "a": "We report it to the app under its impersonation rules with your proof. Pro also watches for new accounts using your name or face."}, {"q": "Can I get paid when someone made money with my work?", "a": "Often, yes. We send the claim for what they owe you, and partner copyright lawyers in the US go to court when needed. No win, no fee, you keep up to 80%."}, {"q": "Where do you look for copies?", "a": "Anywhere Google can see, including shops selling prints and shirts, plus every copy you or your followers report from inside the apps."}, {"q": "Is it free?", "a": "Yes. Sign in and turn on free protection: we check your 10 newest posts every month and file the takedowns. If we recover money, it is split 50/50. Creator ($10 a month) checks up to 100 posts every week and you keep 80%."}];
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = JSON.parse(readFileSync(join(root, "../../packages/brand/brand.json"), "utf8"));
const SITE = `https://${brand.domain}`;
const PATH = "/protect/";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const TITLE = "Emera Protect: someone stole your work? We take it down";
const OG_TITLE = "Someone stole your work. We take it down";
const DESCRIPTION = "Reposted reels, songs used without permission, copied photos and art, your design on a shirt, a fake account using your face. Emera Protect files the takedown, follows it until it is gone and, when they made money, goes after it. For every kind of creator. Free to report, $10 a month for weekly scans.";

const litSvg = readFileSync(join(root, "../../brand/logo/final/mark-lit-symbol.svg"), "utf8");
const litBox = litSvg.match(/viewBox="([^"]+)"/)[1];
const mark = `<svg viewBox="${litBox}" aria-hidden="true"><use href="#mark"/></svg>`;
const FREE = `https://${brand.domain}/sign-in?next=${encodeURIComponent("/protect?optin=1")}&ref=protect-free`;
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
.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(24px,5vw,64px);align-items:center;padding:clamp(18px,4vw,48px) 0 0}
h1{font:800 clamp(2.3rem,4.7vw,4rem)/1 var(--disp);letter-spacing:-.05em;margin-top:14px;text-wrap:balance}
.lead{text-wrap:pretty;color:var(--ink2);max-width:32em;margin-top:20px;font-size:clamp(1.02rem,1.5vw,1.18rem)}
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
.pay{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:clamp(20px,4vw,48px);padding:clamp(24px,4vw,44px);border-radius:28px;background:var(--dark);color:var(--darkink);position:relative;overflow:hidden}
.pay::before{content:"";position:absolute;inset:-40% auto auto -10%;width:380px;height:380px;background:radial-gradient(circle,rgba(255,170,60,.3),transparent 65%)}
.pay>*{position:relative}
.pay .eyebrow{color:var(--sun2)}
.pay h2{font:800 clamp(1.8rem,3.8vw,2.8rem)/1.05 var(--disp);letter-spacing:-.045em;margin-top:10px;text-wrap:balance}
.pay h2 em{font-style:normal;color:var(--sun2)}
.pay p{color:rgba(251,243,232,.82);margin-top:12px;max-width:34em}
.pay .split{font:800 clamp(2.6rem,6vw,4rem)/1 var(--disp);letter-spacing:-.05em;color:var(--sun2);margin-top:20px}
.pay .split small{display:block;font:600 1rem/1.4 var(--body);letter-spacing:0;color:rgba(251,243,232,.85);margin-top:6px}
.pay .form label{color:var(--darkink)}
.pay .form input[type=checkbox]{width:18px;height:18px;padding:0;accent-color:var(--sun)}
.pay .form label.chk{display:flex;align-items:center;gap:10px}
.pay .note{color:var(--darkink)}
.pay .note.err{color:#ff9a85}
.pay .fine2{font-size:.88rem;margin-top:16px;color:rgba(251,243,232,.72)}
.hp{position:absolute;left:-9999px}
.note{font-size:.95rem;min-height:1.4em;margin-top:12px;font-weight:600}
.note.err{color:#a3240f}
.fine{color:var(--ink3);font-size:.88rem;margin:28px 0 64px;max-width:44em}
.paid{position:sticky;top:0;z-index:9;padding:14px 20px;text-align:center;background:#1c1512;color:#fff7e8;font-size:15px}.paid a{color:#ffb547;margin-left:6px}
@media (max-width:980px){.tiers{grid-template-columns:1fr 1fr}}
@media (max-width:820px){.hero{grid-template-columns:1fr}.steps{grid-template-columns:1fr}.ent,.pay{grid-template-columns:1fr}}
@media (max-width:560px){.tiers{grid-template-columns:1fr}.form{grid-template-columns:1fr}.cta a{flex:1 1 100%}}`;

const HM = "<div class=\"hm\" role=\"img\" aria-label=\"A reel by @techguyver, the same reel re-uploaded on TikTok by another account with 1.2 million views and a Take it down button, then a Removed receipt. Below it, a fake account using your face, a design on a T-shirt shop and a song in a brand's ad with a claim sent for $2,400.\">\n<div class=\"hm-card\" aria-hidden=\"true\">\n<div class=\"hm-hd\">Found copies<span>3 new</span></div>\n<div class=\"hm-vid\">\n<div class=\"hm-col\"><div class=\"hm-lbl\">Original</div>\n<div class=\"hm-reel\"><video src=\"/assets/work/techguyver-reel.mp4\" poster=\"/assets/work/techguyver-reel.jpg\" autoplay muted loop playsinline preload=\"metadata\"></video><div class=\"hm-meta\"><b>Your reel</b><span>@techguyver</span></div></div>\n<span class=\"hm-act dim\">Signed at upload</span></div>\n<div class=\"hm-col\"><div class=\"hm-lbl bad\">TikTok copy</div>\n<div class=\"hm-reel hm-copy\"><video src=\"/assets/work/techguyver-reel.mp4\" poster=\"/assets/work/techguyver-reel.jpg\" autoplay muted loop playsinline preload=\"metadata\"></video><span class=\"hm-wm\"></span><span class=\"hm-bar\">caption hack you NEED 🤯</span><div class=\"hm-meta\"><b>1.2M views</b><span>@ai.clips.daily</span></div></div>\n<span class=\"hm-act\">Take it down</span></div>\n<div class=\"hm-col\"><div class=\"hm-lbl ok\">Removed</div>\n<div class=\"hm-reel hm-copy hm-rm\"><img src=\"/assets/work/techguyver-reel.jpg\" alt=\"\"><span class=\"hm-seal\"><svg viewBox=\"0 0 24 24\"><path d=\"M5 12.5l4.5 4.5L19 7.5\"/></svg></span><div class=\"hm-meta\"><b>Taken down</b><span>Receipt saved</span></div></div>\n<span class=\"hm-act done\">Receipt ready</span></div>\n</div>\n<div class=\"hm-rows\">\n<div class=\"hm-row\"><span class=\"t\"><img src=\"/assets/work/techguyver-avatar.jpg\" alt=\"\"></span><div><strong>A fake account using your face</strong><small>instagram.com/techguyver.official</small></div><span class=\"hm-act\">Take it down</span></div>\n<div class=\"hm-row\"><span class=\"t hm-shirt\"><svg viewBox=\"0 0 64 64\" aria-hidden=\"true\"><defs><clipPath id=\"hm-c\"><rect x=\"21\" y=\"22\" width=\"22\" height=\"20\" rx=\"2\"/></clipPath></defs><path d=\"M22 8l10 5 10-5 18 9-7 14-7-3v27H18V28l-7 3L4 17z\" fill=\"#e9ddc9\" stroke=\"#cdbb9f\" stroke-width=\"1.2\" stroke-linejoin=\"round\"/><image href=\"/assets/work/swirl3d.jpg\" x=\"18\" y=\"20\" width=\"28\" height=\"24\" preserveAspectRatio=\"xMidYMid slice\" clip-path=\"url(#hm-c)\"/></svg></span><div><strong>Your design on a T-shirt shop</strong><small>shirtbarn.example, 93% match</small></div><span class=\"hm-act\">Take it down</span></div>\n<div class=\"hm-row\"><span class=\"t hm-song\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 18V6l11-2v12\"/><circle cx=\"6.5\" cy=\"18\" r=\"2.5\"/><circle cx=\"17.5\" cy=\"16\" r=\"2.5\"/></svg></span><div><strong>Your song in a brand's ad</strong><small>Claim sent: $2,400</small></div><span class=\"hm-act done\">Claim sent</span></div>\n</div>\n</div>\n</div>";
const HM_CSS = ".hm{position:relative;min-width:0;width:100%;max-width:560px;margin-left:auto}\n.hm-card{background:var(--card);border:1px solid var(--line);border-radius:28px;box-shadow:0 30px 60px -36px rgba(90,45,10,.45);padding:18px}\n.hm-hd{display:flex;align-items:center;justify-content:space-between;font:700 .95rem var(--disp,inherit);letter-spacing:-.02em;margin-bottom:14px;color:var(--ink)}\n.hm-hd span{font:600 .74rem var(--body);padding:5px 10px;border-radius:99px;background:color-mix(in srgb,var(--sun) 22%,transparent);color:var(--sunink)}\n.hm-vid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}\n.hm-col{min-width:0;display:flex;flex-direction:column;gap:7px}\n.hm-lbl{font:700 .68rem var(--body);letter-spacing:.1em;text-transform:uppercase;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.hm-lbl.bad{color:#b4321a}\n.hm-lbl.ok{color:#2f7a3d}\n:root[data-theme=dark] .hm-lbl.bad{color:#ff9a85}\n:root[data-theme=dark] .hm-lbl.ok{color:#7bd68a}\n.hm-reel{position:relative;aspect-ratio:9/16;border-radius:16px;overflow:hidden;background:#000;color:#fff}\n.hm-reel>img,.hm-reel>video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}\n.hm-reel:after{content:\"\";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.28),transparent 28%,transparent 55%,rgba(0,0,0,.72))}\n.hm-play{position:absolute;z-index:2;left:50%;top:42%;width:42px;height:42px;margin:-21px 0 0 -21px;border-radius:50%;background:rgba(255,255,255,.88);display:grid;place-items:center;color:#111}\n.hm-play svg{width:18px;height:18px;margin-left:2px;fill:currentColor}\n.hm-meta{position:absolute;z-index:2;left:9px;right:9px;bottom:9px;font:600 .72rem/1.25 var(--body)}\n.hm-meta b{display:block;font:800 1.02rem/1.1 var(--disp,inherit);letter-spacing:-.03em}\n.hm-meta span{opacity:.85}\n.hm-copy>img{transform:scale(1.28);transform-origin:50% 30%;filter:saturate(.8) contrast(1.05)}\n.hm-bar{position:absolute;z-index:3;left:0;right:0;bottom:30%;background:#000;color:#fff;font:700 .7rem var(--body);text-align:center;padding:6px 4px}\n.hm-wm{position:absolute;z-index:3;right:0;top:0;width:46%;height:16%;background:rgba(40,30,25,.92);filter:blur(6px)}\n.hm-rm>img{filter:grayscale(1) brightness(.55)}\n.hm-rm:after{background:rgba(12,10,9,.4)}\n.hm-seal{position:absolute;z-index:3;left:50%;top:44%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:#7bd68a;display:grid;place-items:center;color:#0f2a14}\n.hm-seal svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}\n.hm-act{display:block;text-align:center;font:700 .78rem var(--body);padding:10px 6px;border-radius:99px;color:#1a1008;background:linear-gradient(135deg,var(--sun2),var(--sun));white-space:nowrap}\n.hm-act.done{background:color-mix(in srgb,#7bd68a 28%,transparent);color:var(--ink)}\n.hm-act.dim{background:transparent;color:var(--ink2);border:1px solid var(--line)}\n.hm-rows{display:grid;grid-template-columns:minmax(0,1fr);gap:7px;margin-top:12px}\n.hm-row{display:flex;align-items:center;gap:12px;padding:9px 10px;border-radius:16px;background:var(--bg2);border:1px solid var(--line)}\n.hm-row .t{flex:none;width:50px;height:50px;border-radius:11px;overflow:hidden;position:relative}\n.hm-row .t img{width:100%;height:100%;object-fit:cover;display:block}\n.hm-row>div{min-width:0;flex:1}\n.hm-row strong{display:block;font-weight:600;font-size:.9rem;line-height:1.25;color:var(--ink)}\n.hm-row small{display:block;color:var(--ink2);font-size:.78rem}\n.hm-row .hm-act{flex:none;padding:9px 12px}\n.hm-shirt{background:#f4efe6;display:grid;place-items:center}\n.hm-shirt svg{width:100%;height:100%}\n.hm-song{background:color-mix(in srgb,var(--sun) 24%,var(--bg2));display:grid;place-items:center;color:var(--sunink)}\n.hm-song svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}\n@media (max-width:560px){.hm-card{padding:14px}.hm-play{width:34px;height:34px;margin:-17px 0 0 -17px}.hm-meta b{font-size:.9rem}.hm-meta{font-size:.64rem}.hm-bar{font-size:.6rem}.hm-act{font-size:.72rem;padding:9px 4px}.hm-row .hm-act{padding:8px 10px}}";
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

const caseScript = `<script>(function(){var f=document.querySelector("[data-case]");if(!f)return;var n=document.querySelector("[data-case-note]"),b=f.querySelector("button");
function err(t,el){n.textContent=t;n.classList.add("err");if(el)el.focus()}
f.addEventListener("submit",function(e){e.preventDefault();n.className="note";if(f.website.value)return;
var em=f.email.value.trim(),cu=f.copy_url.value.trim(),ou=f.original_url.value.trim();
if(!/^[^\\s@]+@[^\\s@.]+(\\.[^\\s@.]+)+$/.test(em))return err("That email does not look right. Check it and try again.",f.email);
if(!cu)return err("Add the link to the copy.",f.copy_url);
if(!ou)return err("Add the link to your original.",f.original_url);
if(!f.owns.checked)return err("Tick the box to confirm this is yours.",f.owns);
b.disabled=true;fetch("/api/case",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:em,copy_url:cu,original_url:ou,note:f.note.value,owns:true,referrer:document.referrer})}).then(function(r){return r.json().then(function(j){return{s:r.status,j:j}})}).then(function(x){if(x.j.ok){f.hidden=true;n.textContent="Thanks. We read every case and reply within two working days.";return}
err(x.s===429?"We already have your case. We will be in touch.":x.j.error==="invalid_copy_url"?"That link to the copy does not look right.":x.j.error==="invalid_original_url"?"That link to your original does not look right.":"Something went wrong on our side. Try again in a moment.");b.disabled=false}).catch(function(){err("Something went wrong on our side. Try again in a moment.");b.disabled=false})})})()</script>`;

function html(github) {
  const ld = [
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
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
.pstats{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:22px}.pstats>div{border-top:1.5px solid currentColor;padding-top:14px}.pstats b{display:block;font:800 clamp(2rem,4vw,3rem)/1 Sora,sans-serif;letter-spacing:-.04em}.pstats p{margin-top:8px;opacity:.8;font-size:.98rem}@media (max-width:760px){.pstats{grid-template-columns:1fr}}
${HM_CSS}
${footerCss}</style>
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body>${sprite}<div class="wrap">
<nav class="nav"><a class="mk" href="/" aria-label="${esc(brand.name)}">${mark}${esc(brand.name.toLowerCase())}</a><div class="navr">${starButton(github)}<a class="pill" href="${plan("nav")}">Create your account</a></div></nav>
<main>
<div class="hero">
<div>
<div class="eyebrow">${esc(brand.name)} Protect</div>
<h1>Someone stole your work. We take it down</h1>
<p class="lead">Your reel reposted on another account. Your song used without permission. Your art sold as a print. Your design on someone else's shirt. A fake account using your face. We find it, file the takedown and follow it until it is gone. For video creators, musicians, photographers, artists, designers and makers.</p>
<div class="cta"><a class="pill" href="${FREE}">Get free protection</a><a class="ghost" href="#plans">Plans from $10</a></div>
</div>
${HM}
</div>

<section aria-labelledby="h-prob">
<h2 class="t" id="h-prob">Copied in seconds. Fighting it takes weeks</h2>
<p class="sub">A different form on every app, an ID check, legal wording, and nobody tells you if it worked.</p>
<div class="pstats">
<div><b>75%</b><p>of creative professionals have had work stolen, copied or not credited online (<a href="https://blog.adobe.com/en/publish/2020/12/08/adobe-research-disinformation" rel="noopener">Adobe</a>)</p></div>
<div><b>10M</b><p>fake profiles posing as big creators, removed by one app in six months (<a href="https://www.nbcchicago.com/news/business/money-report/meta-removes-10-million-facebook-profiles-in-effort-to-combat-spam/3788949/" rel="noopener">report</a>)</p></div>
<div><b>$4,000</b><p>a month one designer pays to take down fake listings of her work (<a href="https://www.fox19.com/2025/09/08/fashion-graphic-designers-say-their-work-is-being-stolen-marketed-with-ai/" rel="noopener">FOX19</a>)</p></div>
</div>
</section>

<section aria-labelledby="h-how">
<h2 class="t" id="h-how">You tap once. We chase it until it is gone</h2>
<div class="steps">
<div class="step"><h3>Add your reels, TikToks and photos</h3><p>Upload them, or bring in what you already posted. Each one is signed with your name and the date.</p></div>
<div class="step"><h3>We find re-uploads and reposts</h3><p>We check where Google can see them, plus anything you report. Every match lands in your list, next to the original.</p></div>
<div class="step"><h3>One tap takedown</h3><p>We send the notice to the platform and track it until you get a Removed receipt.</p></div>
</div>
</section>

<section id="plans" aria-labelledby="h-plans">
<h2 class="t" id="h-plans">Pick how much you want covered</h2>
<p class="sub">Start free. Move up as you post more.</p>
<div class="tiers">
<div class="tier"><h3>Free</h3><div class="for">Sign in and turn it on</div><div class="price">$0</div><ul><li>Your 10 newest posts checked every month</li><li>One tap takedowns for every copy</li><li>Copies your followers spot come straight to you</li><li>Money recovery: no win, no fee, 50/50 split</li></ul><a class="ghost" href="${FREE}">Get free protection</a></div>
<div class="tier"><h3>Creator</h3><div class="for">Your work, watched every week</div><div class="price">$10<small> / month</small></div><ul><li>Up to 100 posts watched</li><li>Videos, music, photos, art and designs</li><li>Reposts and copies found across TikTok, Instagram, YouTube and the web</li><li>Unlimited takedowns</li><li>Weekly scans</li><li>Money recovery: you keep 80%</li></ul><a class="pill" data-buy="creator" href="${plan("creator", "creator")}">Get Creator</a></div>
<div class="tier pro"><span class="badge">Most coverage</span><h3>Pro</h3><div class="for">For creators who post a lot</div><div class="price">$100<small> / month</small></div><ul><li>Unlimited posts watched</li><li>Every new post checked daily</li><li>Videos checked across the whole clip</li><li>Fake accounts using your name or face</li><li>Automatic filing</li><li>Priority help and a monthly report</li><li>Money recovery: you keep 80%</li></ul><a class="pill" data-buy="pro" href="${plan("pro", "pro")}">Get Pro</a></div>
<div class="tier"><h3>Enterprise</h3><div class="for">Agencies, labels and brands with many creators</div><div class="price">Custom</div><ul><li>Everyone you represent in one place</li><li>Plans built around your list</li><li>Money recovery: you keep 80%</li></ul><a class="ghost" href="#talk">Talk to us</a></div>
</div>
</section>

<section id="paid" class="pay" aria-labelledby="h-pay">
<div><div class="eyebrow">Money recovery</div><h2 id="h-pay">They made money with your work. <em>Get paid</em></h2>
<p>We send the claim for the money they owe you. If they do not pay, partner copyright lawyers in the US take it to court.</p>
<div class="split">80%<small>No win, no fee. You keep 80% of what we recover on any paid plan, and half on Free.</small></div>
<p class="fine2">US cases first. Registering your work with the US Copyright Office can raise what a court awards; we help you do it.</p></div>
<div><form class="form" data-case novalidate>
<label class="wide">Your email<input type="email" name="email" autocomplete="email" maxlength="254" required></label>
<label class="wide">Link to the copy<input name="copy_url" inputmode="url" maxlength="500" placeholder="https://" required></label>
<label class="wide">Link to your original<input name="original_url" inputmode="url" maxlength="500" placeholder="https://" required></label>
<label class="wide">What they made, or what it is (optional)<input name="note" maxlength="1000" placeholder="A brand ad with 2M views"></label>
<label class="chk wide"><input type="checkbox" name="owns" required>I made this or own the rights</label>
<input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<button class="pill" type="submit">Check my case</button>
</form><p class="note" data-case-note role="status" aria-live="polite"></p></div>
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

<section aria-labelledby="h-faq">
<h2 class="t" id="h-faq">Questions creators ask</h2>
${FAQS.map((f) => `<details class="step" style="margin:10px 0"><summary><h3 style="display:inline">${esc(f.q)}</h3></summary><p>${esc(f.a)}</p></details>`).join("")}
</section>

<p class="fine">Plans bill monthly and you can stop any time. Every takedown follows the rules of the place the copy lives, and you can see each step we took. Emera is open source and run as a nonprofit: the code that finds copies and writes the notices is <a href="https://github.com/royherma/emera?ref=protect#protect">public</a>, so you can run it yourself or let us run it and file for you.</p>
</main>
</div>${footer({ pages, mark, github, year: new Date().getFullYear() })}${script}${caseScript}${buy}</body></html>`;
}

export function writeProtect(today, { github }) {
  const dir = join(root, "public", PATH);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html(github));
  const sitemap = join(root, "public/sitemap.xml");
  const xml = readFileSync(sitemap, "utf8");
  if (!xml.includes(`${SITE}${PATH}<`)) writeFileSync(sitemap, xml.replace("</urlset>", `<url><loc>${SITE}${PATH}</loc><lastmod>${today}</lastmod></url>\n</urlset>`));
}
