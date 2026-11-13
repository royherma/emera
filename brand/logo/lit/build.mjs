import fs from "node:fs";
import path from "node:path";

const HERE = import.meta.dirname;
const ROOT = path.join(HERE, "../../..");
const small = fs.readFileSync(path.join(ROOT, "brand/logo/final/mark-small.svg"), "utf8");
const inner = small.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/fill="currentColor"/g, "");
const { chromium } = await import(process.env.PLAYWRIGHT_CORE_MJS || path.join(ROOT, "tools/atlas/node_modules/playwright-core/index.mjs"));

const INK = "#2a1d14", CREAM = "#fbf3e8", DAY = "#fbf5ea", NIGHT = "#0c0a09";
const HOT = "#ffd25a", SUN = "#ff8a2b", RED = "#e8461e", CORE = "#fff4c2";
const TIP = [576, 318];

const lin = (x1, y1, x2, y2) => (id, stops) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
const rad = (cx, cy, r) => (id, stops) => `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${stops}</radialGradient>`;
const ROUND1 = lin(120, 200, 560, 400);

const R1 = [
  { id: "ember", label: "Ember tail", grad: ROUND1, whole: true, stops: (ink) => [[0, ink], [0.5, ink], [0.72, RED], [0.86, SUN], [1, HOT]] },
  { id: "match", label: "Lit match", grad: ROUND1, whole: true, stops: (ink) => [[0, ink], [0.7, ink], [0.84, SUN], [1, HOT]], spill: true },
  { id: "burn", label: "Burning down", grad: ROUND1, whole: true, stops: (ink) => [[0, ink], [0.3, ink], [0.55, RED], [0.8, SUN], [1, HOT]] },
  { id: "sunset", label: "All sun", grad: ROUND1, whole: true, stops: () => [[0, RED], [0.5, SUN], [1, HOT]] },
];
const TIPS = { along: { label: "Just the tip", grad: lin(470, 430, ...TIP), stops: () => [[0, RED], [0.45, SUN], [1, HOT]] },
  glow: { label: "Tip + glow", grad: rad(566, 326, 120), stops: () => [[0, HOT], [0.35, SUN], [0.75, RED], [1, RED]], spill: true },
  long: { label: "Longer ember", grad: lin(360, 470, ...TIP), stops: (ink) => [[0, ink], [0.25, RED], [0.6, SUN], [1, HOT]], from: 330 },
  edge: { label: "Straight edge", grad: lin(470, 0, 576, 0), stops: () => [[0, RED], [0.5, SUN], [1, HOT]] },
  below: { label: "From below", grad: lin(520, 300, 545, 430), stops: (ink) => [[0, ink], [0.35, RED], [0.7, SUN], [1, HOT]] } };
const tip = (k, extra) => ({ id: k, ...TIPS[k], ...extra });

export const options = [
  ...R1.map((o) => ({ ...o, id: `r1-${o.id}`, label: `R1 ${o.label}`, noFlame: true })),
  ...["along", "glow", "long", "edge", "below"].map((k) => ({ ...tip(k), id: `r2-${k}`, label: `R2 ${TIPS[k].label}`, noFlame: true })),
  { ...tip("along"), id: "r2-flame", label: "R2 Small flame", flame: 0.8 },
  ...R1.map((o) => ({ ...o, id: `r3-${o.id}`, label: `R3 ${o.label}` })),
  ...["along", "glow", "long"].map((k) => ({ ...tip(k), id: `r3-${k}`, label: `R3 ${TIPS[k].label}` })),
  { ...tip("along"), id: "r3-flame", label: "R3 Big flame", flame: 1.85 },
];

const FLAME = "M548 332C534 300 552 266 572 240C586 222 594 200 596 178C622 208 640 246 634 282C630 310 608 330 584 338C570 342 556 340 548 332Z";
const CORE_PATH = "M562 330C556 312 566 292 580 276C588 266 594 254 596 242C610 262 616 284 610 302C606 318 594 328 580 332C572 334 566 334 562 330Z";

let n = 0;
export function litMark(o, ink, size) {
  const id = `l${n++}`;
  const stops = o.stops(ink).map(([at, c]) => `<stop offset="${at}" stop-color="${ink === CREAM && c === RED ? SUN : c}"/>`).join("");
  const from = o.from ?? 445;
  const f = o.flame ?? 1.35;
  const flame = o.noFlame ? "" : `<ellipse cx="566" cy="328" rx="34" ry="22" transform="rotate(-38 566 328)" fill="${HOT}" opacity=".85" filter="url(#${id}s)"/><g transform="translate(560 334) scale(${f}) translate(-566 -336)">
<path d="${FLAME}" fill="${SUN}" opacity=".55" filter="url(#${id}b)"/><path d="${FLAME}" fill="url(#${id}fl)"/><path d="${CORE_PATH}" fill="url(#${id}co)"/></g>`;
  return `<svg style="overflow:visible" width="${size}" height="${size}" viewBox="${o.noFlame ? "0 0 600 600" : "-40 -80 720 720"}" xmlns="http://www.w3.org/2000/svg"><defs>${o.grad(`${id}g`, stops)}
<linearGradient id="${id}t" gradientUnits="userSpaceOnUse" x1="${from}" y1="0" x2="${from + 50}" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>
<mask id="${id}c"><rect x="0" y="${o.from ? 318 : 290}" width="600" height="310" fill="url(#${id}t)"/></mask>
<mask id="${id}m"><g fill="#fff">${inner}</g></mask>
<linearGradient id="${id}fl" gradientUnits="userSpaceOnUse" x1="560" y1="336" x2="600" y2="180"><stop offset="0" stop-color="${RED}"/><stop offset=".45" stop-color="${SUN}"/><stop offset="1" stop-color="${HOT}"/></linearGradient>
<linearGradient id="${id}co" gradientUnits="userSpaceOnUse" x1="570" y1="332" x2="596" y2="242"><stop offset="0" stop-color="${HOT}"/><stop offset="1" stop-color="${CORE}"/></linearGradient>
<filter id="${id}b" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="22"/></filter><filter id="${id}s" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="9"/></filter></defs>
${o.spill ? `<ellipse cx="556" cy="330" rx="70" ry="44" transform="rotate(-38 556 330)" fill="${SUN}" opacity="${ink === CREAM ? 0.55 : 0.42}" filter="url(#${id}b)"/>` : ""}
${o.whole ? `<rect x="-40" y="-40" width="680" height="680" fill="url(#${id}g)" mask="url(#${id}m)"/>` : `<rect width="600" height="600" fill="${ink}" mask="url(#${id}m)"/><g mask="url(#${id}c)"><rect width="600" height="600" fill="url(#${id}g)" mask="url(#${id}m)"/></g>`}
${flame}</svg>`;
}

const half = (o, ink, bg, tile) => `<div class="h" style="background:${bg};color:${ink}"><div class="lk">${litMark(o, ink, 92)}Emera</div><div class="ic" style="background:${tile}">${litMark(o, ink, 210)}</div></div>`;
const card = (o) => `<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=Sora:wght@600&display=block" rel="stylesheet">
<style>body{margin:0}#c{width:700px;height:800px;display:grid;grid-template-rows:1fr 1fr}
.h{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px}
.lk{display:flex;align-items:center;gap:14px;font:600 64px/1 Sora;letter-spacing:-.045em}
.ic{width:230px;height:230px;border-radius:52px;display:grid;place-items:center}</style></head>
<body><div id="c">${half(o, INK, DAY, "#f6f3ec")}${half(o, CREAM, NIGHT, "#1c1a17")}</div></body></html>`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 700, height: 800 } });
  for (const o of options) {
    await page.setContent(card(o), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.locator("#c").screenshot({ path: path.join(HERE, `${o.id}.png`) });
    fs.writeFileSync(path.join(HERE, `${o.id}.svg`), litMark(o, INK, 600));
  }
  await browser.close();
  console.log("wrote", options.map((o) => o.id).join(", "));
}
