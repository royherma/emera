import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const require = createRequire(path.join(root, 'tools/atlas/package.json'));
const { chromium } = require('playwright-core');

const shots = path.join(root, 'data/atlas-shots');
const dataUri = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const mark = readFileSync(path.join(root, 'brand/logo/final/mark.svg'), 'utf8');

const themes = {
  light: { night: false, screens: ['explore/phone-day', 'feed/phone-day', 'u-handle/phone-day'] },
  dark: { night: true, screens: ['explore/phone-night', 'feed/phone-night', 'u-handle/phone-night'] },
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 560 }, deviceScaleFactor: 2 });
await page.goto('file://' + path.join(here, 'banner.html'));
await page.evaluate(() => document.fonts.ready);

for (const [name, t] of Object.entries(themes)) {
  await page.evaluate(({ night, srcs, mark }) => {
    document.body.classList.toggle('night', night);
    document.getElementById('mark').innerHTML = mark;
    srcs.forEach((s, i) => { document.getElementById('s' + (i + 1)).src = s; });
  }, { night: t.night, srcs: t.screens.map((s) => dataUri(path.join(shots, s + '.png'))), mark });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth));
  const png = path.join(os.tmpdir(), `emera-banner-${name}.png`);
  const webp = path.join(here, `banner-${name}.webp`);
  await page.screenshot({ path: png });
  execFileSync('cwebp', ['-quiet', '-q', '88', png, '-o', webp]);
  console.log(name, statSync(webp).size, 'bytes');
}
// GitHub social preview + app share card: 1280x640 is GitHub's recommended size.
await page.setViewportSize({ width: 1280, height: 640 });
await page.evaluate(({ srcs }) => {
  document.documentElement.classList.add('og');
  document.body.classList.remove('night');
  document.body.classList.add('og');
  document.querySelector('.tag').textContent = "AI broke the internet, let's fix it";
  srcs.forEach((s, i) => { document.getElementById('s' + (i + 1)).src = s; });
}, { srcs: themes.light.screens.map((s) => dataUri(path.join(shots, s + '.png'))) });
await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth));
const ogPng = path.join(os.tmpdir(), 'emera-og.png');
const og = path.join(here, 'og.jpg');
await page.screenshot({ path: ogPng });
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '88', ogPng, '--out', og], { stdio: 'ignore' });
console.log('og', statSync(og).size, 'bytes');
await browser.close();
