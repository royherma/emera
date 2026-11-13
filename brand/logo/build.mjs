import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { COL, markSvg, iconSvg, faviconSvg, lockup } from './lib.mjs'
import { concepts } from './concepts.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')

const HERE = import.meta.dirname
const ART = path.join(import.meta.dirname, '../../.claude/artifacts/brand')
fs.mkdirSync(ART, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } })

async function shot(svg, out, size, bgTransparent = true) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)
  await page.screenshot({ path: out, omitBackground: bgTransparent, clip: { x: 0, y: 0, width: size, height: size } })
}

const only = process.argv[2]
const manifest = []
for (const c of concepts) {
  if (only && c.id !== only) continue
  const dir = path.join(HERE, 'concepts', `${c.id}-${c.slug}`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'mark.svg'), markSvg(c.mark, c.id))
  fs.writeFileSync(path.join(dir, 'wordmark.svg'), lockup(c, COL.ink, COL.cream, c.id))
  fs.writeFileSync(path.join(dir, 'wordmark-dark.svg'), lockup(c, COL.cream, COL.black, c.id + 'd'))
  for (const mode of ['light', 'dark', 'tinted']) {
    const name = mode === 'light' ? 'icon-1024.png' : `icon-${mode}-1024.png`
    await shot(iconSvg(c.mark, mode, c.icon), path.join(dir, name), 1024)
  }
  await shot(faviconSvg(c.mark, 32), path.join(dir, 'favicon-32.png'), 32)
  await shot(faviconSvg(c.mark, 16), path.join(dir, 'favicon-16.png'), 16)
  manifest.push({ id: c.id, name: c.name, idea: c.idea, dir, icon: path.join(dir, 'icon-1024.png'), top3: !!c.top3 })
  console.log('built', c.id, c.slug)
}
if (!only) fs.writeFileSync(path.join(HERE, 'concepts.json'), JSON.stringify(manifest, null, 2))
await browser.close()
