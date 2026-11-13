import fs from "node:fs";
import path from "node:path";

const HERE = import.meta.dirname;
const ROOT = path.join(HERE, "../../..");
const small = fs.readFileSync(path.join(ROOT, "brand/logo/final/mark-small.svg"), "utf8");
const inner = small.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const { chromium } = await import(process.env.PLAYWRIGHT_CORE_MJS || path.join(ROOT, "tools/atlas/node_modules/playwright-core/index.mjs"));

const INK = "#2a1d14", CREAM = "#fbf3e8", DAY = "#fbf5ea", NIGHT = "#0c0a09";
const HOT = "#ffd25a", SUN = "#ff8a2b", RED = "#e8461e";

export const options = [
  { id: "ember", label: "1 Ember tail", note: "the strokes at the end of the e burn orange to yellow", stops: (ink) => [[0, ink], [0.5, ink], [0.72, RED], [0.86, SUN], [1, HOT]], glow: 0 },
  { id: "match", label: "2 Lit match", note: "ink e, only the tip is lit, with a soft glow", stops: (ink) => [[0, ink], [0.7, ink], [0.84, SUN], [1, HOT]], glow: 1 },
  { id: "burn", label: "3 Burning down", note: "dark at the start, the fire runs along the whole stroke", stops: (ink) => [[0, ink], [0.3, ink], [0.55, RED], [0.8, SUN], [1, HOT]], glow: 0 },
  { id: "sunset", label: "4 All sun", note: "the whole e in the sun colors, no ink", stops: () => [[0, RED], [0.5, SUN], [1, HOT]], glow: 0 },
];

let n = 0;
export function litMark(o, ink, size) {
  const id = `l${n++}`;
  const stops = o.stops(ink).map(([at, c]) => `<stop offset="${at}" stop-color="${ink === CREAM && c === RED ? SUN : c}"/>`).join("");
  const glow = o.glow ? `<filter id="${id}f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>` : "";
  const fill = (extra = "") => `<rect width="600" height="600" fill="url(#${id}g)" mask="url(#${id}m)"${extra}/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg"><defs>
<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="120" y1="200" x2="560" y2="400">${stops}</linearGradient>
<linearGradient id="${id}h" gradientUnits="userSpaceOnUse" x1="120" y1="200" x2="560" y2="400"><stop offset="0.68" stop-color="${SUN}" stop-opacity="0"/><stop offset="0.85" stop-color="${SUN}"/><stop offset="1" stop-color="${HOT}"/></linearGradient>
<mask id="${id}m"><g fill="#fff">${inner.replace(/fill="currentColor"/g, "")}</g></mask>${glow}</defs>
${o.glow ? `<g filter="url(#${id}f)"><rect width="600" height="600" fill="url(#${id}h)" mask="url(#${id}m)"/></g><g filter="url(#${id}f)" opacity=".7"><rect width="600" height="600" fill="url(#${id}h)" mask="url(#${id}m)"/></g>` : ""}${fill()}</svg>`;
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
