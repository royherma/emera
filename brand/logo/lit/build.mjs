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

const card = (o) => `<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=Sora:wght@600&display=block" rel="stylesheet">
<style>body{margin:0;font-family:Sora}#c{width:1200px;height:640px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:200px 440px}
.rail{display:flex;align-items:center;gap:10px;padding:0 56px;font:600 52px/1 Sora;letter-spacing:-.045em}
.big{display:grid;place-items:center}.ic{width:240px;height:240px;border-radius:54px;display:grid;place-items:center}</style></head>
<body><div id="c">
<div class="rail" style="background:${DAY};color:${INK}">${litMark(o, INK, 84)}Emera</div>
<div class="rail" style="background:${NIGHT};color:${CREAM}">${litMark(o, CREAM, 84)}Emera</div>
<div class="big" style="background:${DAY}"><div class="ic" style="background:#f6f3ec;box-shadow:0 10px 40px rgba(60,35,10,.18)">${litMark(o, INK, 190)}</div></div>
<div class="big" style="background:${NIGHT}"><div class="ic" style="background:#1c1a17">${litMark(o, CREAM, 190)}</div></div>
</div></body></html>`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 640 } });
  for (const o of options) {
    await page.setContent(card(o), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.locator("#c").screenshot({ path: path.join(HERE, `${o.id}.png`) });
    fs.writeFileSync(path.join(HERE, `${o.id}.svg`), litMark(o, INK, 600));
  }
  await browser.close();
  console.log("wrote", options.map((o) => o.id).join(", "));
}
