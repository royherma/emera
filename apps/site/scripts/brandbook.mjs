import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = JSON.parse(readFileSync(join(root, "../../packages/brand/brand.json"), "utf8"));
const tokens = JSON.parse(readFileSync(join(root, "../../packages/brand/tokens.json"), "utf8"));
const FILES = join(root, "public/brand/files");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const hasBrandKit = () => existsSync(join(FILES, "icons.json"));

const mark = (cls = "") => `<svg class="${cls}" viewBox="0 0 600 600" aria-hidden="true"><use href="#mark"/></svg>`;
const lockup = (cls) => `<span class="lk ${cls}">${mark()}<span>${esc(brand.name)}</span></span>`;
const f = (name) => `/brand/files/${name}`;
const kb = (name) => `${Math.max(1, Math.round(statSync(join(FILES, name)).size / 1024))} KB`;
const dl = (label, name) => `<a class="dl" href="${f(name)}" download>${esc(label)}</a>`;

export const brandCss = `.bw{max-width:1120px;margin:0 auto;padding:0 var(--gutter)}
.bw .nav{padding:22px 0}
.bh{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:20px;margin-top:10px}
.bh p{margin-top:10px;max-width:34em;color:var(--ink2)}
.kit{display:inline-flex;align-items:center;gap:10px;background:linear-gradient(180deg,var(--sun2),var(--sun));color:#2a1406;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:999px}
.kit small{font-weight:600;opacity:.7}
.bs{margin-top:56px}
.bs>h2{margin:0}
.bs>.lead{margin-top:6px;color:var(--ink2)}
.tiles{display:grid;gap:14px;margin-top:18px;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))}
.tile{border-radius:22px;border:1px solid var(--line);overflow:hidden;background:var(--card);display:flex;flex-direction:column}
.stage{aspect-ratio:16/10;display:grid;place-items:center;padding:24px}
.stage.day{background:#fbf5ea;color:#2a1d14}
.stage.night{background:#0c0a09;color:#fbf3e8}
.stage.sun{background:linear-gradient(160deg,#ffc24a,#ff8a2b);color:#2a1d14}
.meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:14px 16px;border-top:1px solid var(--line)}
.meta b{flex:1 1 auto;font-weight:600;font-size:.95rem}
.dl{font-size:.82rem;font-weight:600;text-decoration:none;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:var(--bg)}
.dl:hover{border-color:var(--sun)}
.lk{display:inline-flex;align-items:center;gap:.16em;font:600 clamp(2.4rem,6vw,3.6rem)/1.2 var(--disp);letter-spacing:-.045em}
.lk svg{width:1.27em;height:1.27em}
.stage>svg{width:42%;height:auto}
.stage img{width:44%;height:auto;border-radius:22%}
.rules{display:grid;gap:14px;margin-top:18px;grid-template-columns:repeat(3,1fr)}
@media (max-width:760px){.rules{grid-template-columns:1fr 1fr}}
.rule .stage{aspect-ratio:4/3}
.rule .stage .lk{font-size:1.7rem}
.rule .meta{font-size:.88rem;color:var(--ink2)}
.rule .meta b{color:var(--ink)}
.no b::before{content:"";display:inline-block;width:.62em;height:.62em;margin-right:8px;border-radius:50%;background:#d23b2b;vertical-align:.05em}
.yes b::before{content:"";display:inline-block;width:.62em;height:.62em;margin-right:8px;border-radius:50%;background:#2f9e5b;vertical-align:.05em}
.space{position:relative;padding:.5em;outline:2px dashed color-mix(in srgb,var(--sun) 80%,transparent);outline-offset:0}
.sq{transform:scaleX(1.5)}
.tint{color:#3d6bff}
.tilt{transform:rotate(-14deg)}
.busy{background:url(/assets/work/mural.jpg) center/cover;color:#fbf3e8}
.glow{filter:drop-shadow(0 0 10px #ff4f8b) drop-shadow(0 6px 0 #3d6bff)}
.sw{display:grid;gap:10px;margin-top:14px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.sw button{all:unset;cursor:pointer;border-radius:16px;border:1px solid var(--line);background:var(--card);overflow:hidden;display:flex;flex-direction:column}
.sw button:focus-visible{outline:2px solid var(--sun);outline-offset:2px}
.sw i{display:block;height:72px}
.sw span{padding:10px 12px;font-size:.82rem;line-height:1.35}
.sw span b{display:block;font-size:.9rem}
.sw span em{font-style:normal;color:var(--ink3);font-variant-numeric:tabular-nums}
.grp{margin-top:22px;font:600 .74rem var(--body);letter-spacing:.14em;text-transform:uppercase;color:var(--sunink)}
.type{display:grid;gap:14px;margin-top:18px;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))}
.spec{padding:24px;border-radius:22px;border:1px solid var(--line);background:var(--card)}
.spec .big{font-size:clamp(2.2rem,5vw,3.2rem);line-height:1.05;letter-spacing:-.04em;margin-top:10px}
.spec .row{margin-top:14px;color:var(--ink2);font-size:.95rem}
.spec .row a{font-weight:600}
.ic{display:grid;gap:8px;margin-top:18px;grid-template-columns:repeat(auto-fill,minmax(96px,1fr))}
.ic a{display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 6px 12px;border-radius:16px;border:1px solid var(--line);background:var(--card);text-decoration:none;font-size:.75rem;color:var(--ink2)}
.ic a:hover{border-color:var(--sun);color:var(--ink)}
.ic svg{width:28px;height:28px;fill:none;stroke:var(--ink);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.words{margin-top:18px;border-radius:22px;border:1px solid var(--line);overflow:hidden}
.words div{display:grid;grid-template-columns:minmax(110px,180px) 1fr;gap:12px;padding:14px 18px;border-top:1px solid var(--line)}
.words div:first-child{border-top:0}
.words dt{color:var(--ink3);font-size:.9rem}
.words dd{font-weight:600}
.toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);opacity:0;transition:.2s;background:var(--ink);color:var(--bg);padding:10px 18px;border-radius:999px;font-size:.9rem;pointer-events:none}
.toast.on{opacity:1;transform:translate(-50%,0)}`;

const swatch = (name, hex, sub) => `<button type="button" data-copy="${esc(hex)}" aria-label="Copy ${esc(name)} ${esc(hex)}"><i style="background:${esc(hex)}"></i><span><b>${esc(name)}</b><em>${esc(hex)}</em></span></button>`;
const gradSwatch = (g, i) => `<button type="button" data-copy="linear-gradient(135deg, ${g.from.hex}, ${g.to.hex})" aria-label="Copy creator gradient ${i + 1}"><i style="background:linear-gradient(135deg,${g.from.hex},${g.to.hex})"></i><span><b>Creator ${i + 1}</b><em>${g.from.hex} to ${g.to.hex}</em></span></button>`;

const NAMES = { bg: "Background", surface: "Card", sunk: "Sunk", ink: "Ink", ink2: "Ink 2", ink3: "Ink 3", sunInk: "Sun ink", danger: "Danger", sun: "Sun", sunHigh: "Sun high", onSun: "On sun" };
const KEEP = ["bg", "surface", "sunk", "ink", "ink2", "ink3", "sunInk", "danger"];

export function brandBody() {
  const icons = JSON.parse(readFileSync(join(FILES, "icons.json"), "utf8"));
  const c = tokens.colors;
  const modeSwatches = (mode) => KEEP.filter((k) => c[mode][k]?.hex).map((k) => swatch(NAMES[k], c[mode][k].hex, c[mode][k].oklch)).join("");
  return `<div class="bh"><div><h1>${esc(brand.name)} brand</h1><p>Our logo, app icon, colors, type and icons, ready to download. Use them to write about ${esc(brand.name)}, link to it or build on it.</p></div>
<a class="kit" href="${f("emera-brand-kit.zip")}" download>Download everything <small>${kb("emera-brand-kit.zip")}</small></a></div>

<section class="bs" id="logo"><h2>Logo</h2><p class="lead">The brush e and the name, side by side. Dark ink on light backgrounds, white on dark ones.</p>
<div class="tiles">
<div class="tile"><div class="stage day">${lockup("")}</div><div class="meta"><b>On light</b>${dl("PNG", "emera-logo.png")}${dl("On cream", "emera-logo-on-day.png")}</div></div>
<div class="tile"><div class="stage night">${lockup("")}</div><div class="meta"><b>On dark</b>${dl("PNG", "emera-logo-white.png")}${dl("On night", "emera-logo-on-night.png")}</div></div>
<div class="tile"><div class="stage sun">${mark()}</div><div class="meta"><b>Mark</b>${dl("SVG", "emera-mark.svg")}${dl("White SVG", "emera-mark-white.svg")}${dl("Detailed SVG", "emera-mark-detailed.svg")}</div></div>
</div></section>

<section class="bs" id="icon"><h2>App icon</h2><p class="lead">What people see on their home screen and in the browser tab.</p>
<div class="tiles">
<div class="tile"><div class="stage day"><img src="${f("emera-icon.png")}" alt="${esc(brand.name)} app icon, light"></div><div class="meta"><b>Light</b>${dl("PNG 1024", "emera-icon.png")}${dl("Square", "emera-icon-square.png")}</div></div>
<div class="tile"><div class="stage night"><img src="${f("emera-icon-dark.png")}" alt="${esc(brand.name)} app icon, dark"></div><div class="meta"><b>Dark</b>${dl("PNG 1024", "emera-icon-dark.png")}</div></div>
<div class="tile"><div class="stage day"><img src="${f("emera-favicon.svg")}" alt="${esc(brand.name)} favicon" style="width:22%"></div><div class="meta"><b>Favicon</b>${dl("SVG", "emera-favicon.svg")}</div></div>
</div></section>

<section class="bs" id="use"><h2>Using the logo</h2><p class="lead">Give it room, keep its colors, keep its shape.</p>
<div class="rules">
<div class="tile rule yes"><div class="stage day"><span class="space">${lockup("")}</span></div><div class="meta"><b>Room around it</b>At least the height of the e on every side</div></div>
<div class="tile rule no"><div class="stage day">${lockup("sq")}</div><div class="meta"><b>No stretching</b></div></div>
<div class="tile rule no"><div class="stage day">${lockup("tint")}</div><div class="meta"><b>No new colors</b></div></div>
<div class="tile rule no"><div class="stage day">${lockup("tilt")}</div><div class="meta"><b>No turning</b></div></div>
<div class="tile rule no"><div class="stage day">${lockup("glow")}</div><div class="meta"><b>No effects</b></div></div>
<div class="tile rule no"><div class="stage busy">${lockup("")}</div><div class="meta"><b>No busy photos behind it</b></div></div>
</div></section>

<section class="bs" id="colors"><h2>Colors</h2><p class="lead">Warm daylight by day, a dark room by night, and the sun for anything you tap. Click a color to copy it.</p>
<p class="grp">Sun</p><div class="sw">${Object.entries(c.sun).map(([k, v]) => swatch(NAMES[k] || k, v.hex, v.oklch)).join("")}</div>
<p class="grp">Day</p><div class="sw">${modeSwatches("day")}</div>
<p class="grp">Night</p><div class="sw">${modeSwatches("night")}</div>
<p class="grp">Creator gradients</p><div class="sw">${(c.creator || []).map(gradSwatch).join("")}</div>
<p class="lead" style="margin-top:14px">${dl("CSS", "emera-colors.css")} ${dl("JSON", "emera-colors.json")}</p>
</section>

<section class="bs" id="type"><h2>Type</h2><p class="lead">Two free typefaces from Google Fonts.</p>
<div class="type">
<div class="spec" style="font-family:var(--disp)"><span class="grp">Headings</span><p class="big" style="font-weight:700">Sora</p><p class="big" style="font-weight:600;font-size:1.6rem;letter-spacing:-.03em">${esc(brand.tagline)}</p><p class="row" style="font-family:var(--body)">Semibold 600 and Bold 700, tight letter spacing. <a href="https://fonts.google.com/specimen/Sora" rel="noopener">Get Sora</a></p></div>
<div class="spec"><span class="grp">Text</span><p class="big" style="font-weight:700">DM Sans</p><p style="margin-top:10px;font-size:1.1rem">Every post carries proof of who made it. The people are real and the algorithm is open.</p><p class="row">Regular 400 to Bold 700. <a href="https://fonts.google.com/specimen/DM+Sans" rel="noopener">Get DM Sans</a></p></div>
</div></section>

<section class="bs" id="icons"><h2>Icons</h2><p class="lead">${icons.length} icons from the app, drawn on a 24 px grid with a 1.7 line and round ends. Click one to download it.</p>
<div class="ic">${icons.map((i) => `<a href="${f(`icons/${i.name}.svg`)}" download title="${esc(i.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${esc(i.d)}"/></svg>${esc(i.name)}</a>`).join("")}</div>
</section>

<section class="bs" id="name"><h2>Name and words</h2>
<dl class="words">
<div><dt>Name</dt><dd>${esc(brand.name)}, one capital E</dd></div>
<div><dt>Line</dt><dd>${esc(brand.line)}</dd></div>
<div><dt>Tagline</dt><dd>${esc(brand.tagline)}</dd></div>
<div><dt>Where it comes from</dt><dd>${esc(brand.meaning)}</dd></div>
<div><dt>Web</dt><dd><a href="https://${esc(brand.domain)}">${esc(brand.domain)}</a></dd></div>
</dl></section>
<div class="toast" data-toast role="status" aria-live="polite"></div>
<script>(function(){var t=document.querySelector("[data-toast]"),h;document.querySelectorAll("[data-copy]").forEach(function(b){b.addEventListener("click",function(){var v=b.getAttribute("data-copy");(navigator.clipboard?navigator.clipboard.writeText(v):Promise.reject()).then(function(){t.textContent="Copied "+v},function(){t.textContent=v}).then(function(){t.classList.add("on");clearTimeout(h);h=setTimeout(function(){t.classList.remove("on")},1600)})})})})()</script>`;
}
