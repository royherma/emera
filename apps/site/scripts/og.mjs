import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "~/Desktop/Development/techguyver-side-projects/creators-of-today/node_modules/playwright-core"
);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.argv[2] || "http://localhost:5038/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.addStyleTag({ content: "body{overflow:hidden}.nav,.hero form,.hero .scrollcue{display:none!important}.hero{min-height:630px!important;height:630px!important}.hero-inner{padding-top:96px!important}" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);
await page.screenshot({ path: join(root, "public/assets/og.png"), clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log("wrote public/assets/og.png");
