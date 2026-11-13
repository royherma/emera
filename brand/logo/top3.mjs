import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { COL, marks, iconSvg, lockup, faviconSvg } from './lib.mjs'
import { concepts } from './concepts.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')
const HERE = import.meta.dirname
const ART = path.join(import.meta.dirname, '../../.claude/artifacts/brand')

const top = concepts.filter((c) => c.top3)
const mk = (c, size, color, bg, u) => `<svg viewBox="0 0 100 100" width="${size}" height="${size}" color="${color}" style="--bg:${bg};flex:none">${marks[c.mark](u)}</svg>`
const icon = (c, mode, size, u) => iconSvg(c.mark, mode, c.icon).replace('width="1024" height="1024"', `width="${size}" height="${size}"`).replace(/id="sq"/, `id="sq${u}"`).replace('url(#sq)', `url(#sq${u})`).replace(/id="(\w)(i\w+)"/g, `id="$1$2${u}"`).replace(/url\(#(\w)(i\w+)\)/g, `url(#$1$2${u})`)

const glyphs = [
  '<circle cx="12" cy="12" r="5" fill="#fff"/>',
  '<rect x="5" y="8" width="14" height="9" rx="2" fill="#fff"/><circle cx="12" cy="12.5" r="2.5" fill="currentColor"/>',
  '<path d="M9 6v9a2.5 2.5 0 1 1-2-2.4V8l9-2v7a2.5 2.5 0 1 1-2-2.4V6Z" fill="#fff"/>',
  '<path d="M12 4a5 5 0 0 1 5 5c0 4-5 10-5 10S7 13 7 9a5 5 0 0 1 5-5Z" fill="#fff"/>',
  '<path d="M5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6l-4 3v-3a2 2 0 0 1-2-2Z" fill="#fff"/>',
  '<rect x="5" y="6" width="14" height="13" rx="2" fill="#fff"/><rect x="5" y="6" width="14" height="4" fill="#fff" opacity=".6"/>',
  '<circle cx="12" cy="12" r="7" fill="none" stroke="#fff" stroke-width="2.2"/><path d="M12 8v4l3 2" stroke="#fff" stroke-width="2" fill="none"/>',
]
const bgs = ['#3a86ff', '#34c759', '#ff375f', '#5e5ce6', '#00c7be', '#ff9f0a', '#8e8e93']
const names = ['Photos', 'Camera', 'Music', 'Maps', 'Messages', 'Calendar', 'Clock']
const apps = (n) => glyphs.slice(0, n).map((g, i) => `<div class="app"><div class="sq" style="background:${bgs[i]};color:${bgs[i]}"><svg viewBox="0 0 24 24" width="30" height="30">${g}</svg></div><span>${names[i]}</span></div>`).join('')

const col = (c, i) => {
  const u = 't' + i
  return `
  <section>
    <h2><b>${c.id}</b> ${c.name}<em>${c.idea}</em></h2>
    <div class="blk">
      <div class="lab">iOS home screen, light / dark / tinted</div>
      <div class="phone">
        <div class="grid">
          <div class="app"><div class="sq real">${icon(c, 'light', 62, u + 'a')}</div><span>Emera</span></div>${apps(7)}
        </div>
        <div class="trio">
          <div>${icon(c, 'light', 54, u + 'b')}<small>light</small></div>
          <div>${icon(c, 'dark', 54, u + 'c')}<small>dark</small></div>
          <div>${icon(c, 'tinted', 54, u + 'd')}<small>tinted</small></div>
        </div>
      </div>
    </div>
    <div class="blk">
      <div class="lab">App header</div>
      <div class="hdr">${lockup(c, COL.ink, COL.cream, u + 'h').replace('<svg', '<svg height="30"')}<div class="sp"></div><div class="plus">+</div><div class="av"></div></div>
    </div>
    <div class="blk">
      <div class="lab">Browser tab and emera.social nav</div>
      <div class="br">
        <div class="tabs"><div class="tab">${faviconSvg(c.mark, 16).replace(/id="(\w)(f\d+)"/g, `id="$1$2${u}"`)}<span>Emera. Where humanity comes together</span></div><div class="tab ghost"><i></i><span>Inbox</span></div></div>
        <div class="url"><span>emera.social</span></div>
        <div class="nav">${lockup(c, COL.ink, COL.cream, u + 'n').replace('<svg', '<svg height="26"')}<div class="sp"></div><a>Discover</a><a>Protection</a><a>About</a><a class="join">Join</a></div>
      </div>
    </div>
    <div class="blk">
      <div class="lab">Profile, a signed post</div>
      <div class="post">
        <div class="art a${i}"></div>
        <div class="meta">
          <div class="seal">${mk(c, 30, COL.ink, COL.cream, u + 's')}</div>
          <div><b>Signed by Mara Lindqvist</b><small>@mara.emera / made 12 Nov 2026, 9:41 AM</small></div>
        </div>
      </div>
    </div>
  </section>`
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Emera logo top 3 in context</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Sora:wght@600&display=swap">
<style>
:root{--cream:${COL.cream};--ink:${COL.ink};--black:${COL.black};--sun:${COL.sun}}
*{box-sizing:border-box;margin:0}
body{background:#ece7dc;font-family:'DM Sans',system-ui,sans-serif;color:var(--ink);padding:10px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;min-height:100vh}
section{background:#fbf9f4;border:1px solid #ddd6c7;border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
h2{font-family:Sora,system-ui,sans-serif;font-weight:600;font-size:16px;display:flex;flex-wrap:wrap;align-items:baseline;gap:8px}
h2 b{opacity:.4}h2 em{font-style:normal;font-family:'DM Sans';font-weight:400;font-size:12px;opacity:.7;flex-basis:100%}
.lab{font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.5;margin-bottom:4px}
.phone{background:linear-gradient(160deg,#2b2140,#5a2a3a 55%,#c4623a);border-radius:20px;padding:14px 14px 10px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 6px}
.app{display:flex;flex-direction:column;align-items:center;gap:3px}
.app span{font-size:9px;color:#fff}
.sq{width:62px;height:62px;border-radius:14px;display:flex;align-items:center;justify-content:center}
.sq.real{background:none;border-radius:0;overflow:visible}
.sq.real svg{display:block}
.trio{display:flex;justify-content:center;gap:26px;margin-top:10px;padding-top:8px;border-top:1px solid #fff3}
.trio div{display:flex;flex-direction:column;align-items:center;gap:2px}.trio small{font-size:9px;color:#fffc}
.hdr{background:var(--cream);border:1px solid #e3dccd;border-radius:12px;height:56px;display:flex;align-items:center;gap:10px;padding:0 14px}
.sp{flex:1}.plus{width:30px;height:30px;border-radius:15px;background:var(--ink);color:var(--cream);display:flex;align-items:center;justify-content:center;font-size:18px}
.av{width:30px;height:30px;border-radius:15px;background:linear-gradient(135deg,#ff4f8b,#ff8a2b)}
.br{border:1px solid #cfc8b8;border-radius:10px;overflow:hidden;background:var(--cream)}
.tabs{background:#dcd5c5;display:flex;gap:4px;padding:6px 8px 0;height:30px}
.tab{background:var(--cream);border-radius:8px 8px 0 0;padding:5px 10px;display:flex;align-items:center;gap:6px;font-size:11px;width:215px}
.tab span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tab.ghost{background:none;width:90px;opacity:.6}.tab i{width:14px;height:14px;border-radius:3px;background:#999}
.url{padding:6px 10px;border-bottom:1px solid #e3dccd}.url span{display:block;background:#ece7dc;border-radius:12px;padding:3px 12px;font-size:11px;opacity:.8}
.nav{display:flex;align-items:center;gap:16px;padding:12px 16px;font-size:12px}
.nav .join{background:var(--ink);color:var(--cream);padding:6px 14px;border-radius:16px}
.post{border:1px solid #e3dccd;border-radius:12px;overflow:hidden;background:var(--cream)}
.art{height:104px}
.a0{background:radial-gradient(circle at 70% 120%,#ff8a2b 0 30%,transparent 31%),linear-gradient(180deg,#1b2a4a,#51589b 60%,#d65156)}
.a1{background:radial-gradient(circle at 30% 40%,#ffd61c 0 18%,transparent 19%),linear-gradient(120deg,#51d6d2,#5180d6)}
.a2{background:conic-gradient(from 40deg at 60% 60%,#ff4f8b,#ffc24a,#51d6d2,#5180d6,#ff4f8b)}
.meta{display:flex;gap:10px;align-items:center;padding:8px 12px}
.meta b{font-size:13px;display:block}.meta small{font-size:10px;opacity:.65}
.seal{width:44px;height:44px;border-radius:50%;border:1.5px solid var(--ink);display:flex;align-items:center;justify-content:center;background:#fff;flex:none}
</style></head><body>${top.map(col).join('')}</body></html>`
fs.writeFileSync(HERE + '/top3.html', html)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1512, height: 860 } })
await page.goto('file://' + HERE + '/top3.html')
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(500)
console.log('scrollHeight', await page.evaluate(() => document.documentElement.scrollHeight))
await page.screenshot({ path: ART + '/logo-top3.png' })
await browser.close()
