import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = JSON.parse(readFileSync(join(root, "../../packages/brand/brand.json"), "utf8"));
const GITHUB_URL = process.env.GITHUB_URL || "https://github.com/emera-social/emera";

const vars = {
  name: brand.name,
  tagline: brand.tagline,
  domain: brand.domain,
  meaning: brand.meaning,
  bg: brand.colors.bg,
  ink: brand.colors.ink,
  accent: brand.colors.accent,
  accent2: brand.colors.accent2,
  github: GITHUB_URL,
};

const html = readFileSync(join(root, "src/index.template.html"), "utf8").replace(
  /\{\{(\w+)\}\}/g,
  (_, k) => {
    if (!(k in vars)) throw new Error(`unknown template var ${k}`);
    return vars[k];
  }
);
writeFileSync(join(root, "public/index.html"), html);
console.log("built public/index.html");
