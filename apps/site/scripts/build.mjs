import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { screens, sprite, usedWork } from "./screens.mjs";
import { guideLinks, writePages } from "./pages.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = JSON.parse(readFileSync(join(root, "../../packages/brand/brand.json"), "utf8"));
const sources = JSON.parse(readFileSync(join(root, "../../brand/content/sources.json"), "utf8"));
const GITHUB_URL = process.env.GITHUB_URL || "https://github.com/emera-social/emera";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const licenseName = (i) => (i.license === "BY" ? `CC BY ${i.license_version}` : i.license === "PDM" ? "Public domain" : `${i.license} ${i.license_version}`);
const credits = sources.openverse_items
  .filter((i) => usedWork.includes(i.file.replace(/\.jpg$/, "")))
  .map((i) => {
    const by = i.original_creator ? ` by ${esc(i.original_creator)}` : "";
    return `<li><a href="${esc(i.landing_url)}" rel="noopener">${esc(i.title.replace(/[_\s]{3,}/g, "").slice(0, 70))}</a>${by}, <a href="${esc(i.license_url)}" rel="noopener">${licenseName(i)}</a></li>`;
  })
  .join("");

const vars = {
  name: brand.name,
  tagline: brand.tagline,
  domain: brand.domain,
  github: GITHUB_URL,
  sprite,
  credits,
  guides: guideLinks(),
  ld: JSON.stringify([
    { "@context": "https://schema.org", "@type": "Organization", name: brand.name, url: `https://${brand.domain}/`, logo: `https://${brand.domain}/assets/og.png`, description: "Open-source, nonprofit social network for people who make things and people sharing what is happening, with proof of who posted on every post." },
    { "@context": "https://schema.org", "@type": "WebSite", name: brand.name, url: `https://${brand.domain}/` },
  ]).replace(/</g, "\\u003c"),
};

const html = readFileSync(join(root, "src/index.template.html"), "utf8")
  .replace(/\{\{screen:(\w+):(day|night)\}\}/g, (_, n, t) => {
    if (!screens[n]) throw new Error(`unknown screen ${n}`);
    return screens[n](t);
  })
  .replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`unknown template var ${k}`);
    return vars[k];
  });
writeFileSync(join(root, "public/index.html"), html);
console.log("built public/index.html", html.length, "bytes");
console.log("built", writePages(new Date().toISOString().slice(0, 10)), "sitemap urls");
