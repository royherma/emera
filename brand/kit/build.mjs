import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.join(import.meta.dirname, "../..");
const FINAL = path.join(ROOT, "brand/logo/final");
const OUT = path.join(ROOT, "apps/site/public/brand/files");
const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, "packages/brand/tokens.json"), "utf8"));
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, "packages/brand/brand.json"), "utf8"));
const { chromium } = await import(process.env.PLAYWRIGHT_CORE_MJS || path.join(ROOT, "tools/atlas/node_modules/playwright-core/index.mjs"));

const INK = tokens.colors.day.ink.hex;
const CREAM = tokens.colors.night.ink.hex;
const NIGHT = tokens.colors.night.bg.hex;
const DAY = tokens.colors.day.bg.hex;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "icons"), { recursive: true });

const recolor = (svg, color) => svg.replace(/currentColor/g, color);
const small = fs.readFileSync(path.join(FINAL, "mark-lit-symbol.svg"), "utf8");
const ink = fs.readFileSync(path.join(FINAL, "mark-small.svg"), "utf8");
const full = fs.readFileSync(path.join(FINAL, "mark.svg"), "utf8");
const write = (name, data) => fs.writeFileSync(path.join(OUT, name), data);

write("emera-mark.svg", recolor(small, INK));
write("emera-mark-white.svg", recolor(small, CREAM));
write("emera-mark-ink.svg", recolor(ink, INK));
write("emera-mark-detailed-ink.svg", recolor(full, INK));
for (const [from, to] of [["icon-1024.png", "emera-icon.png"], ["icon-dark-1024.png", "emera-icon-dark.png"], ["app-icon-1024.png", "emera-icon-square.png"], ["favicon.svg", "emera-favicon.svg"]]) {
  fs.copyFileSync(path.join(FINAL, from), path.join(OUT, to));
}

const iconSrc = fs.readFileSync(path.join(ROOT, "apps/mobile/src/components/Icon.tsx"), "utf8");
const icons = [...iconSrc.matchAll(/^\s+(\w+): "([^"]+)",?$/gm)].map(([, name, d]) => ({ name, d }));
for (const { name, d } of icons) {
  write(`icons/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>\n`);
}
write("icons.json", JSON.stringify(icons, null, 2) + "\n");

const css = [":root {"];
for (const mode of ["day", "night"]) for (const [k, v] of Object.entries(tokens.colors[mode])) css.push(`  --emera-${mode}-${k}: ${v.hex ?? v.rgba};`);
for (const [k, v] of Object.entries(tokens.colors.sun)) css.push(`  --emera-${k}: ${v.hex};`);
css.push("}");
write("emera-colors.css", css.join("\n") + "\n");
write("emera-colors.json", JSON.stringify(tokens.colors, null, 2) + "\n");

const inner = small.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const lockup = (fg, bg) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600&display=block" rel="stylesheet">
<style>html,body{margin:0;background:${bg}}#l{display:inline-flex;align-items:center;gap:24px;padding:80px;color:${fg};font:600 400px/1.2 Sora;letter-spacing:-.045em}#l svg{width:640px;height:640px}</style></head>
<body><div id="l"><svg viewBox="${small.match(/viewBox="([^"]+)"/)[1]}">${inner}</svg><span>${brand.name}</span></div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_HEADLESS || undefined });
const page = await browser.newPage({ viewport: { width: 2600, height: 800 } });
for (const [name, fg, bg, clear] of [["emera-logo.png", INK, "transparent", true], ["emera-logo-white.png", CREAM, "transparent", true], ["emera-logo-on-day.png", INK, DAY, false], ["emera-logo-on-night.png", CREAM, NIGHT, false]]) {
  await page.setContent(lockup(fg, bg), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const ok = await page.evaluate(() => document.fonts.check("600 40px Sora"));
  if (!ok) throw new Error("Sora did not load, logo PNGs would use a fallback font");
  await page.locator("#l").screenshot({ path: path.join(OUT, name), omitBackground: clear });
}
await browser.close();

const readme = `${brand.name} brand kit

Logo: emera-logo.png (dark ink, see-through), emera-logo-white.png (for dark backgrounds),
      emera-logo-on-day.png, emera-logo-on-night.png
Mark: emera-mark.svg (lit), emera-mark-white.svg (lit, for dark backgrounds), emera-mark-ink.svg, emera-mark-detailed-ink.svg
App icon: emera-icon.png, emera-icon-dark.png, emera-icon-square.png, emera-favicon.svg
Icons: icons/*.svg (24 px grid, 1.7 stroke, round caps)
Colors: emera-colors.css, emera-colors.json
Type: Sora (headings) and DM Sans (text), both free on Google Fonts

Name: ${brand.name}. Line: ${brand.line}. Tagline: ${brand.tagline}.
More: https://${brand.domain}/brand/
`;
write("README.txt", readme);
execFileSync("zip", ["-qr", "-X", "../emera-brand-kit.zip", "."], { cwd: OUT });
fs.renameSync(path.join(OUT, "../emera-brand-kit.zip"), path.join(OUT, "emera-brand-kit.zip"));
console.log(`brand kit: ${icons.length} icons, zip ${(fs.statSync(path.join(OUT, "emera-brand-kit.zip")).size / 1024).toFixed(0)} KB`);
