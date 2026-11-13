import fs from 'node:fs'
import path from 'node:path'
import { COL, squirclePath } from '../lib.mjs'

const { chromium } = await import(process.env.PLAYWRIGHT_CORE_MJS || 'playwright-core')
const HERE = import.meta.dirname
const full = fs.readFileSync(path.join(HERE, 'mark-lit-symbol.svg'), 'utf8')
const small = full
const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
const vb = (svg) => svg.match(/viewBox="([^"]+)"/)[1]

const icon = (mode, mark, rounded = true) => {
  const bg = mode === 'dark' ? COL.ink : COL.cream
  const fg = mode === 'dark' ? COL.cream : COL.ink
  const shape = rounded ? `<path d="${squirclePath(1024)}" fill="${bg}"/>` : `<rect width="1024" height="1024" fill="${bg}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${shape}<svg x="62" y="92" width="900" height="900" viewBox="${vb(mark)}" color="${fg}">${inner(mark)}</svg></svg>`
}
const favicon = (mode) => {
  const bg = mode === 'dark' ? COL.ink : COL.cream
  const fg = mode === 'dark' ? COL.cream : COL.ink
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${bg}"/><svg x="2" y="3" width="60" height="60" viewBox="${vb(small)}" color="${fg}">${inner(small)}</svg></svg>`
}

fs.writeFileSync(path.join(HERE, 'favicon.svg'), favicon('light'))
const jobs = [
  ['icon-1024.png', icon('light', full), 1024],
  ['icon-dark-1024.png', icon('dark', full), 1024],
  ['app-icon-1024.png', icon('light', full, false), 1024],
  ['icon-512.png', icon('light', full), 512],
  ['apple-touch-icon.png', icon('light', small, false), 180],
  ['favicon-32.png', favicon('light'), 32],
  ['favicon-16.png', favicon('light'), 16],
  ['pwa-192.png', icon('light', full, false), 192],
  ['pwa-512.png', icon('light', full, false), 512],
  ['pwa-maskable-512.png', icon('light', full, false).replace('x="62" y="92" width="900" height="900"', 'x="222" y="232" width="580" height="580"'), 512],
]
const browser = await chromium.launch({ executablePath: process.env.CHROME_HEADLESS || undefined })
const page = await browser.newPage()
for (const [name, svg, size] of jobs) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`)
  await page.screenshot({ path: path.join(HERE, name), omitBackground: true })
}
await browser.close()
console.log('built', jobs.map((j) => j[0]).join(', '))
