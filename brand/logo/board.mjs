import fs from 'node:fs'
import { createRequire } from 'node:module'
import { COL, marks, iconSvg, lockup } from './lib.mjs'
import { concepts } from './concepts.mjs'

const require = createRequire('~/Desktop/Development/techguyver-side-projects/creators-of-today/package.json')
const { chromium } = require('playwright-core')
const HERE = '~/Desktop/Development/techguyver-side-projects/agora/brand/logo'
const ART = '~/Desktop/Development/techguyver-side-projects/agora/.claude/artifacts/brand'

const mk = (c, size, color, bg, u) => `<svg viewBox="0 0 100 100" width="${size}" height="${size}" color="${color}" style="--bg:${bg}">${marks[c.mark](u)}</svg>`
const icon = (c, u) => iconSvg(c.mark, 'light', c.icon).replace('width="1024" height="1024"', 'width="92" height="92"').replace(/id="sq"/, `id="sq${u}"`).replace('url(#sq)', `url(#sq${u})`).replace(/id="(\w)(i\w+)"/g, `id="$1$2${u}"`).replace(/url\(#(\w)(i\w+)\)/g, `url(#$1$2${u})`)

const cells = concepts.map((c) => `
  <div class="cell${c.top3 ? ' top' : ''}">
    <div class="hd"><b>${c.id}</b> ${c.name}${c.top3 ? '<i>top 3</i>' : ''}</div>
    <div class="row">
      <div class="ic">${icon(c, 'b' + c.id)}</div>
      <div class="mk cream">${mk(c, 48, COL.ink, COL.cream, 'm' + c.id)}${mk(c, 16, COL.ink, COL.cream, 'n' + c.id)}</div>
      <div class="mk black">${mk(c, 48, COL.cream, COL.black, 'p' + c.id)}${mk(c, 16, COL.cream, COL.black, 'q' + c.id)}</div>
    </div>
    <div class="lk"><div class="cream">${lockup(c, COL.ink, COL.cream, 'l' + c.id)}</div><div class="black">${lockup(c, COL.cream, COL.black, 'k' + c.id)}</div></div>
    <p>${c.idea}</p>
  </div>`).join('')

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Emera logo board</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Sora:wght@600&display=swap">
<style>
:root{--cream:${COL.cream};--ink:${COL.ink};--black:${COL.black};--sun:${COL.sun}}
*{box-sizing:border-box;margin:0}
html,body{height:100%}
body{background:#ece7dc;font-family:'DM Sans',system-ui,sans-serif;color:var(--ink);display:flex;flex-direction:column;overflow:auto}
header{height:38px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-family:Sora,system-ui,sans-serif;font-weight:600;font-size:13px}
header span{font-family:'DM Sans';font-weight:400;font-size:12px;opacity:.65}
.grid{flex:1;min-height:0;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,minmax(250px,1fr));gap:8px;padding:0 10px 10px}
.cell{background:#fbf9f4;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:7px;border:1px solid #ddd6c7;min-height:0}
.cell.top{border:2px solid var(--sun)}
.hd{font-family:Sora,system-ui,sans-serif;font-weight:600;font-size:13px;display:flex;gap:6px;align-items:baseline}
.hd b{opacity:.45}.hd i{margin-left:auto;font-style:normal;font-size:10px;background:var(--sun);color:#fff;padding:1px 7px;border-radius:9px}
.row{display:flex;gap:8px;align-items:center}
.ic svg{display:block;filter:drop-shadow(0 2px 4px #0003)}
.mk{flex:1;height:92px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
.cream{background:var(--cream);border:1px solid #e3dccd}.black{background:var(--black)}
.lk{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:1;min-height:0}
.lk>div{border-radius:10px;display:flex;align-items:center;justify-content:center;padding:6px;min-height:52px}
.lk svg{width:100%;height:100%;max-height:62px}
p{font-size:12px;line-height:1.3;opacity:.8}
</style></head><body>
<header>Emera logo concepts<span>icon (light) / mark 48 + 16 on cream and black / lockup on cream and black</span></header>
<div class="grid">${cells}</div></body></html>`
fs.writeFileSync(HERE + '/board.html', html)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1512, height: 860 } })
await page.goto('file://' + HERE + '/board.html')
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(500)
console.log('scrollHeight', await page.evaluate(() => document.documentElement.scrollHeight))
await page.screenshot({ path: ART + '/logo-board.png' })
await browser.close()
