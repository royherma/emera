import fs from "node:fs";
import path from "node:path";

const HERE = import.meta.dirname;
const ROOT = path.join(HERE, "../../..");
const small = fs.readFileSync(path.join(ROOT, "brand/logo/final/mark-small.svg"), "utf8");
const inner = small.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const { chromium } = await import(process.env.PLAYWRIGHT_CORE_MJS || path.join(ROOT, "tools/atlas/node_modules/playwright-core/index.mjs"));

const INK = "#2a1d14", CREAM = "#fbf3e8", DAY = "#fbf5ea", NIGHT = "#0c0a09";
const HOT = "#ffd25a", SUN = "#ff8a2b", RED = "#e8461e";

const lin = (x1, y1, x2, y2) => (id, stops) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
const rad = (cx, cy, r) => (id, stops) => `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${stops}</radialGradient>`;
const TIP = [576, 318];
const FLAME = "M562 330C552 312 566 294 586 287C600 282 612 274 622 258C622 284 612 304 596 318C584 329 572 335 562 330Z";

export const options = [
  { id: "along", label: "1 Just the tip", grad: lin(470, 430, ...TIP), stops: () => [[0, RED], [0.45, SUN], [1, HOT]] },
  { id: "glow", label: "2 Tip + glow", grad: rad(566, 326, 120), stops: () => [[0, HOT], [0.35, SUN], [0.75, RED], [1, RED]], spill: true },
  { id: "long", label: "3 Longer ember", grad: lin(360, 470, ...TIP), stops: (ink) => [[0, ink], [0.25, RED], [0.6, SUN], [1, HOT]], from: 330 },
  { id: "flame", label: "4 Flame at the tip", grad: lin(470, 430, ...TIP), stops: () => [[0, RED], [0.45, SUN], [1, HOT]], flame: true },
];

let n = 0;
export function litMark(o, ink, size) {
  const id = `l${n++}`;
  const stops = o.stops(ink).map(([at, c]) => `<stop offset="${at}" stop-color="${ink === CREAM && c === RED ? SUN : c}"/>`).join("");
  const halo = o.halo ? o.halo(`${id}h`, `<stop offset="0" stop-color="${HOT}"/><stop offset=".5" stop-color="${SUN}" stop-opacity=".8"/><stop offset="1" stop-color="${SUN}" stop-opacity="0"/>`) + `<filter id="${id}f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="20"/></filter>` : "";
  return `<svg style="overflow:visible" width="${size}" height="${size}" viewBox="${o.flame ? "-10 -20 640 640" : "0 0 600 600"}" xmlns="http://www.w3.org/2000/svg"><defs>${o.grad(`${id}g`, stops)}${halo}
<mask id="${id}m"><g fill="#fff">${inner.replace(/fill="currentColor"/g, "")}</g></mask><linearGradient id="${id}t" gradientUnits="userSpaceOnUse" x1="${(o.from ?? 445)}" y1="0" x2="${(o.from ?? 445) + 50}" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient><mask id="${id}c"><rect x="0" y="${o.from ? 318 : 290}" width="600" height="310" fill="url(#${id}t)"/></mask></defs>
${o.halo ? `<g filter="url(#${id}f)" mask="url(#${id}c)"><rect width="600" height="600" fill="url(#${id}h)" mask="url(#${id}m)"/></g><g filter="url(#${id}f)" mask="url(#${id}c)" opacity=".8"><rect width="600" height="600" fill="url(#${id}h)" mask="url(#${id}m)"/></g>` : ""}${o.spill ? `<filter id="${id}b" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="26"/></filter><ellipse cx="556" cy="330" rx="70" ry="44" transform="rotate(-38 556 330)" fill="${SUN}" opacity="${ink === CREAM ? .55 : .42}" filter="url(#${id}b)"/>` : ""}<rect width="600" height="600" fill="${ink}" mask="url(#${id}m)"/><g mask="url(#${id}c)"><rect width="600" height="600" fill="url(#${id}g)" mask="url(#${id}m)"/></g>${o.flame ? `<defs><linearGradient id="${id}fl" gradientUnits="userSpaceOnUse" x1="566" y1="330" x2="622" y2="262"><stop offset="0" stop-color="${RED}"/><stop offset=".45" stop-color="${SUN}"/><stop offset="1" stop-color="${HOT}"/></linearGradient><filter id="${id}fb" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="14"/></filter></defs><path d="${FLAME}" fill="${SUN}" opacity=".6" filter="url(#${id}fb)"/><path d="${FLAME}" fill="url(#${id}fl)"/>` : ""}</svg>`;
}

const half = (o, ink, bg, tile) => `<div class="h" style="background:${bg};color:${ink}"><div class="lk">${litMark(o, ink, 82)}Emera</div><div class="ic" style="background:${tile}">${litMark(o, ink, 200)}</div></div>`;
const card = (o) => `<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=Sora:wght@600&display=block" rel="stylesheet">
<style>body{margin:0}#c{width:700px;height:1000px;display:grid;grid-template-rows:1fr 1fr}
.h{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px}
.lk{display:flex;align-items:center;gap:10px;font:600 64px/1 Sora;letter-spacing:-.045em}
.ic{width:250px;height:250px;border-radius:56px;display:grid;place-items:center}</style></head>
<body><div id="c">${half(o, INK, DAY, "#f6f3ec")}${half(o, CREAM, NIGHT, "#1c1a17")}</div></body></html>`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 700, height: 1000 } });
  for (const o of options) {
    await page.setContent(card(o), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.locator("#c").screenshot({ path: path.join(HERE, `${o.id}.png`) });
    fs.writeFileSync(path.join(HERE, `${o.id}.svg`), litMark(o, INK, 600));
  }
  await browser.close();
  console.log("wrote", options.map((o) => o.id).join(", "));
}
