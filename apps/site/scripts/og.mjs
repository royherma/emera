import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.argv[2] || "http://localhost:5038/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, colorScheme: "light" });
await page.goto(url, { waitUntil: "networkidle" });
await page.addStyleTag({
  content: `body{overflow:hidden}.nav,.signup,.note,.lead,.eyebrow{display:none!important}
.hero{height:630px}.hero-grid{padding:0!important;height:630px;align-items:center}
.hero .wrap{padding-left:72px}
h1{font-size:10.6rem!important;margin-top:0!important}.tagline{font-size:2.6rem!important;margin-top:18px!important}
.stage{--k:.74!important;height:auto!important;align-self:start;margin-top:30px}
.stage .ph.a{left:calc(50% - 150px)}.stage .ph.b{left:calc(50% + 130px);top:80px}`,
});
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
await page.screenshot({ path: join(root, "public/assets/og.png"), clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log("wrote public/assets/og.png");
