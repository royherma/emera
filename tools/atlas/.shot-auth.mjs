import { chromium } from 'playwright-core';
const [url, out, tok, dist] = process.argv.slice(2);
import fs from 'node:fs'; import path from 'node:path';
const b = await chromium.launch({ channel: 'chrome', headless: true });
for (const [name, vp] of [['desktop', { width: 1512, height: 860 }], ['laptop', { width: 1280, height: 720 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, extraHTTPHeaders: { 'X-TG-Tester': '1' } });
  await ctx.addInitScript((t) => localStorage.setItem('session.token', t), tok);
  if (dist) await ctx.route('https://app.emera.social/**', (r) => { const u = new URL(r.request().url()); let f = path.join(dist, u.pathname); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html'); const ct = f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : undefined; r.fulfill({ body: fs.readFileSync(f), contentType: ct }); });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${out}-${name}.png` });
  const info = await p.evaluate(() => [...document.querySelectorAll('video,img')].map(e => { const r = e.getBoundingClientRect(); return `${e.tagName} ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.x)},${Math.round(r.y)} ${(e.currentSrc||e.src||'').slice(-30)} fit=${getComputedStyle(e).objectFit}`; }));
  console.log(name, 'scrollH', await p.evaluate(() => document.documentElement.scrollHeight), '\n  ' + info.join('\n  '));
  await ctx.close();
}
await b.close();
