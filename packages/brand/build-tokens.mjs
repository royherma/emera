import { writeFileSync } from "node:fs";

const day = { bg: "#fbf5ea", surface: "#fffaf1", sunk: "#f1e8d8", ink: "#2a1d14", ink2: "#6b5846", ink3: "#7d6a57", sunInk: "#8a4300", tab: "#fffaf1", scrim: "#0e0a08" };
const night = { bg: "#0c0a09", surface: "#1a1613", sunk: "#221d19", ink: "#fbf3e8", ink2: "#bcae9d", ink3: "#8f8171", sunInk: "#ffc98a", tab: "#1f1a16", scrim: "#0e0a08" };
const hair = { day: { rgb: "60 35 10", a: 0.1 }, night: { rgb: "255 235 210", a: 0.1 } };
const sun = { sun: "#ff8a2b", sunHigh: "#ffc24a", onSun: "#1a1008", danger: { day: "#b3261e", night: "#ff8f84" } };
const creator = [
  ["#ff9a3c", "#ffd61c"], ["#ff4f8b", "#ff9a3c"], ["#8a7bff", "#ff4f8b"], ["#3dbcf0", "#8a7bff"], ["#3ccf91", "#3dbcf0"], ["#ffd61c", "#3ccf91"],
  ["#5180d6", "#8a5cd6"], ["#d66e51", "#f0b98a"], ["#e0587a", "#a95a5c"], ["#49b6a8", "#7bd36b"], ["#c06ae0", "#6a8ae0"], ["#f08a4b", "#b5452f"],
];

const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
function oklch(h) {
  const [r, g, b] = rgb(h).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  const H = C < 0.002 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(0)})`;
}
const lum = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const pack = (set, scheme) => {
  const out = {};
  for (const [k, v] of Object.entries(set)) out[k] = { hex: v, oklch: oklch(v) };
  out.hair = { rgba: `rgba(${hair[scheme].rgb.split(" ").join(",")},${hair[scheme].a})` };
  out.danger = { hex: sun.danger[scheme], oklch: oklch(sun.danger[scheme]) };
  return out;
};

for (const [n, s] of [["day", day], ["night", night]]) {
  for (const k of ["ink", "ink2", "ink3"]) {
    const c = contrast(s[k], s.bg);
    if (c < 4.5) throw new Error(`${n} ${k} on bg is ${c.toFixed(2)}:1`);
  }
  const c = contrast(s.sunInk, s.sunk);
  if (c < 4.5) throw new Error(`${n} sunInk on sunk is ${c.toFixed(2)}:1`);
}
if (contrast(sun.onSun, sun.sun) < 4.5) throw new Error("onSun on sun fails");

const tokens = {
  name: "Emera Twilight",
  colors: {
    day: pack(day, "day"),
    night: pack(night, "night"),
    sun: { sun: { hex: sun.sun, oklch: oklch(sun.sun) }, sunHigh: { hex: sun.sunHigh, oklch: oklch(sun.sunHigh) }, onSun: { hex: sun.onSun, oklch: oklch(sun.onSun) } },
    creator: creator.map(([a, b]) => ({ from: { hex: a, oklch: oklch(a) }, to: { hex: b, oklch: oklch(b) } })),
  },
  font: {
    display: { family: "Sora", weights: { regular: "Sora_400Regular", semibold: "Sora_600SemiBold", bold: "Sora_700Bold" } },
    body: { family: "DM Sans", weights: { regular: "DMSans_400Regular", medium: "DMSans_500Medium", semibold: "DMSans_600SemiBold", bold: "DMSans_700Bold" } },
  },
  type: {
    hero: { font: "display.bold", size: 44, lineHeight: 46, letterSpacing: -2 },
    h1: { font: "display.bold", size: 28, lineHeight: 32, letterSpacing: -0.8 },
    h2: { font: "display.semibold", size: 20, lineHeight: 24, letterSpacing: -0.5 },
    title: { font: "display.semibold", size: 17, lineHeight: 22, letterSpacing: -0.3 },
    section: { font: "display.semibold", size: 15, lineHeight: 20, letterSpacing: -0.15 },
    stat: { font: "display.bold", size: 18, lineHeight: 22, letterSpacing: -0.4 },
    body: { font: "body.regular", size: 15, lineHeight: 21 },
    bodySm: { font: "body.regular", size: 13.5, lineHeight: 19 },
    name: { font: "body.semibold", size: 13.5, lineHeight: 18 },
    meta: { font: "body.medium", size: 12, lineHeight: 16 },
    label: { font: "body.semibold", size: 11, lineHeight: 14, letterSpacing: 0.4 },
    button: { font: "body.bold", size: 14, lineHeight: 18 },
  },
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64 },
  radius: { tile: 12, card: 18, media: 20, proof: 16, field: 14, button: 13, sheet: 24, tab: 24, pill: 999 },
  size: { tapMin: 44, tabBar: 64, avatarRow: 38, avatarProfile: 84, ring: 2.2 },
  elevation: {
    tab: { day: "0px 12px 26px -10px rgba(40,20,0,.35)", night: "0px 14px 30px -10px rgba(0,0,0,.8)" },
    sun: "0px 6px 16px -6px rgba(255,120,30,.6)",
    media: "0px 14px 26px -16px rgba(0,0,0,.5)",
    sheet: "0px -12px 40px -12px rgba(0,0,0,.5)",
  },
  motion: { press: 90, fast: 160, base: 220, sheet: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  themes: ["day", "night", "auto"],
};

writeFileSync(new URL("./tokens.json", import.meta.url), JSON.stringify(tokens, null, 2) + "\n");
console.log("tokens.json written");
