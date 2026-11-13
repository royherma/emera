import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { COL, squirclePath, marks } from '../lib.mjs'
import { variants } from './variants.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')
const HERE = import.meta.dirname
const ART = path.join(import.meta.dirname, '../../../.claude/artifacts/brand')
const BG = 'var(--bg,#f6f3ec)'
const rad = (d) => (d * Math.PI) / 180
const f = (n) => +n.toFixed(2)
const norm = ([x, y]) => { const l = Math.hypot(x, y); return [x / l, y / l] }

function eStroke(v, cx, full, tailLen) {
  const rx = v.rx, ry = v.ry, cy = 50
  const b = rad(v.beta), tm = rad(v.term)
  const L = [cx - rx * Math.cos(b), cy + ry * Math.sin(b)]
  const R = [cx + rx * Math.cos(b), cy - ry * Math.sin(b)]
  const T = [cx + rx * Math.cos(tm), cy + ry * Math.sin(tm)]
  const dir = norm([R[0] - L[0], R[1] - L[1]])
  let d = ''
  if (full && v.lead > 0) {
    const S = [L[0] - v.lead, L[1] + v.lead * 0.5]
    d += `M${f(S[0])} ${f(S[1])}C${f(S[0] + v.lead * 0.3)} ${f(S[1] + v.lead * 0.02)} ${f(L[0] - dir[0] * v.lead * 0.45)} ${f(L[1] - dir[1] * v.lead * 0.45)} ${f(L[0])} ${f(L[1])}`
  } else d += `M${f(L[0])} ${f(L[1])}`
  d += `L${f(R[0])} ${f(R[1])}A${rx} ${ry} 0 1 0 ${f(T[0])} ${f(T[1])}`
  let E = T, u = [1, 0]
  const len = full ? tailLen : 0
  if (len > 0) {
    const tan = norm([rx * Math.sin(tm), -ry * Math.cos(tm)])
    u = [Math.cos(rad(v.phi)), Math.sin(rad(v.phi))]
    E = [T[0] + u[0] * len, T[1] + u[1] * len]
    d += `C${f(T[0] + tan[0] * len * 0.5)} ${f(T[1] + tan[1] * len * 0.5)} ${f(E[0] - u[0] * len * 0.4)} ${f(E[1] - u[1] * len * 0.4)} ${f(E[0])} ${f(E[1])}`
  }
  return { d, E, u, L, R }
}

function sunOf(v, e, cx, sunScale = 1) {
  const r = v.sunR * sunScale
  if (v.sun === 'end') return { kind: 'dot', cx: e.E[0] + e.u[0] * (r + v.sw / 2 + 3), cy: e.E[1] + e.u[1] * (r + v.sw / 2 + 3), r }
  if (v.sun === 'cap') return { kind: 'dot', cx: e.E[0] + e.u[0] * (r - v.sw * 0.28), cy: e.E[1] + e.u[1] * (r - v.sw * 0.28), r }
  const yb = (e.L[1] + e.R[1]) / 2 - v.sw / 2
  return { kind: 'half', cx, yb, r }
}

const sunSvg = (s) => s.kind === 'dot'
  ? `<circle cx="${f(s.cx)}" cy="${f(s.cy)}" r="${f(s.r)}" fill="${COL.sun}"/>`
  : `<path d="M${f(s.cx - s.r)} ${f(s.yb)}A${f(s.r)} ${f(s.r)} 0 0 1 ${f(s.cx + s.r)} ${f(s.yb)}Z" fill="${COL.sun}"/>`

async function sample(page, ds, step = 1.1) {
  return page.evaluate(({ ds, step }) => {
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    document.body.appendChild(svg)
    const out = ds.map((d) => {
      const p = document.createElementNS(ns, 'path')
      p.setAttribute('d', d)
      svg.appendChild(p)
      const L = p.getTotalLength()
      const pts = []
      for (let s = 0; s <= L; s += step) { const q = p.getPointAtLength(s); pts.push([q.x, q.y]) }
      const q = p.getPointAtLength(L)
      pts.push([q.x, q.y])
      return pts
    })
    svg.remove()
    return out
  }, { ds, step })
}

function inkSvg(v, ds, samples) {
  if (!v.cal) return `<path d="${ds.join('')}" fill="none" stroke="currentColor" stroke-width="${v.sw}" stroke-linecap="round" stroke-linejoin="round"/>`
  const { wx, wy, nib } = v.cal
  let s = ''
  for (const pts of samples) for (const [x, y] of pts) s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${wx / 2}" ry="${wy / 2}" transform="rotate(${nib} ${f(x)} ${f(y)})"/>`
  return `<g fill="currentColor">${s}</g>`
}

function bbox(pts, extra = []) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  for (const [x, y, r] of extra) { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r) }
  return [x0, y0, x1, y1]
}
const rot = (pts, deg) => { const a = rad(deg), c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [50 + (x - 50) * c - (y - 50) * s, 50 + (x - 50) * s + (y - 50) * c]) }

async function buildMark(page, v) {
  const e = eStroke(v, 50, true, v.tail)
  const ds = [e.d]
  const sm = await sample(page, ds)
  const sun = sunOf(v, e, 50)
  const rr = v.rot ?? 0
  const pad = v.cal ? Math.max(v.cal.wx, v.cal.wy) / 2 : v.sw / 2
  const pts = rot(sm.flat(), rr)
  const [sx, sy] = rot([[sun.cx ?? 50, sun.cy ?? sun.yb]], rr)[0]
  const [x0, y0, x1, y1] = bbox(pts.map(([x, y]) => [x, y]), [[sx, sy, sun.r]])
  const w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2
  const S = Math.max(w, h) * 1.03
  const vb = [f((x0 + x1) / 2 - S / 2), f((y0 + y1) / 2 - S / 2), f(S), f(S)]
  const body = `<g transform="rotate(${rr} 50 50)">${v.sun === 'bar' ? sunSvg(sun) : ''}${inkSvg(v, ds, sm)}${v.sun === 'bar' ? '' : sunSvg(sun)}</g>`
  return { body, vb }
}

async function buildWord(page, v, dotOn) {
  const sw = v.sw
  const gap = 11
  const tail1 = Math.min(v.tail, 22)
  const e1 = eStroke(v, 50, true, tail1)
  const sm1 = await sample(page, [e1.d])
  const sun = sunOf(v.sun === 'end' ? { ...v, sun: 'cap' } : v, e1, 50)
  const rr = v.rot ?? 0
  const e1pts = rot(sm1.flat(), rr)
  const [sx, sy] = rot([[sun.cx ?? 50, sun.cy ?? sun.yb]], rr)[0]
  let edge = Math.max(...e1pts.map((p) => p[0])) + sw / 2
  if (sun.kind === 'dot') edge = Math.max(edge, sx + sun.r)
  const xm = edge + gap + sw / 2
  const mD = `M${f(xm)} 0V100M${f(xm)} 24A24 24 0 0 1 ${f(xm + 48)} 24V100M${f(xm + 48)} 24A24 24 0 0 1 ${f(xm + 96)} 24V100`
  const cx2 = xm + 96 + sw + gap + 50
  const e2 = eStroke(v, cx2, false, 0)
  const xr = cx2 + v.rx + sw + gap
  const rD = `M${f(xr)} 0V100M${f(xr)} 28A28 28 0 0 1 ${f(xr + 28)} 0H${f(xr + 42)}`
  const xa = xr + 42 + sw + gap
  const aD = `M${f(xa + 100)} 50A50 50 0 0 0 ${f(xa)} 50A50 50 0 0 0 ${f(xa + 100)} 50M${f(xa + 100)} 0V82Q${f(xa + 100)} 100 ${f(xa + 124)} 100`
  const rest = [mD, e2.d, rD, aD]
  const smRest = await sample(page, rest)
  const endX = xa + 124 + sw / 2
  const dotR = Math.max(8, sw * 0.5)
  const dotC = [endX + gap * 0.8 + dotR, 100 + sw / 2 - dotR]
  const ink = inkSvg(v, [e1.d], sm1)
  const inkRest = inkSvg(v, rest, smRest)
  const first = `<g transform="rotate(${rr} 50 50)">${v.sun === 'bar' ? sunSvg(sun) : ''}${ink}${v.sun === 'bar' ? '' : sunSvg(sun)}</g>`
  const dot = dotOn ? `<circle cx="${f(dotC[0])}" cy="${f(dotC[1])}" r="${f(dotR)}" fill="${COL.sun}"/>` : ''
  const allPts = [...e1pts, ...smRest.flat()]
  const [x0, y0, x1, y1] = bbox(allPts, [[sx, sy, sun.r], ...(dotOn ? [[dotC[0], dotC[1], dotR]] : [])])
  const pad = 12 + sw / 2
  const vb = [f(x0 - pad), f(y0 - pad), f(x1 - x0 + pad * 2), f(y1 - y0 + pad * 2)]
  return { body: first + inkRest + dot, vb }
}

const svgWrap = (body, vb, color, bg, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" color="${color}" style="--bg:${bg}" ${extra}>${body}</svg>`

function iconSvg(v, mode, uid, scale = 700) {
  const bg = mode === 'light' ? COL.cream : mode === 'dark' ? COL.black : '#000'
  const ink = mode === 'light' ? COL.ink : COL.cream
  const filter = mode === 'tinted' ? 'style="filter:grayscale(1) brightness(1.35) contrast(1.15)"' : ''
  const o = (1024 - scale) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" style="--bg:${bg}"><defs><clipPath id="sq${uid}"><path d="${squirclePath()}"/></clipPath></defs><g clip-path="url(#sq${uid})"><rect width="1024" height="1024" fill="${bg}"/><g ${filter} color="${ink}"><svg x="${o}" y="${o}" width="${scale}" height="${scale}" viewBox="${v.mark.vb.join(' ')}">${v.mark.body}</svg></g></g></svg>`
}
function faviconSvg(v, size) {
  const s = 0.86 * 100, o = 7
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" style="--bg:${COL.cream}"><rect width="100" height="100" rx="22" fill="${COL.cream}"/><g color="${COL.ink}"><svg x="${o}" y="${o}" width="${s}" height="${s}" viewBox="${v.mark.vb.join(' ')}">${v.mark.body}</svg></g></svg>`
}
const markInline = (v, size, color, bg) => svgWrap(v.mark.body, v.mark.vb, color, bg, `width="${size}" height="${size}"`)
const wordInline = (v, dot, color, bg, h) => { const w = dot ? v.wordDot : v.wordNo; return svgWrap(w.body, w.vb, color, bg, h ? `height="${h}"` : '') }
const uniq = (s, u) => s.replace(/id="sq([^"]*)"/g, `id="sq$1${u}"`).replace(/url\(#sq([^)]*)\)/g, `url(#sq$1${u})`)
const iconInline = (v, mode, size, u) => uniq(iconSvg(v, mode, u), u).replace('width="1024" height="1024"', `width="${size}" height="${size}"`)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } })
await page.setContent('<html><body></body></html>')

for (const v of variants) {
  v.mark = await buildMark(page, v)
  v.wordDot = await buildWord(page, v, true)
  v.wordNo = await buildWord(page, v, false)
}

async function shot(svg, out, size) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
}

const manifest = []
for (const v of variants) {
  const dir = path.join(HERE, `${v.id}-${v.slug}`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'mark.svg'), svgWrap(v.mark.body, v.mark.vb, COL.ink, COL.cream))
  fs.writeFileSync(path.join(dir, 'wordmark.svg'), svgWrap(v.wordDot.body, v.wordDot.vb, COL.ink, COL.cream))
  fs.writeFileSync(path.join(dir, 'wordmark-nodot.svg'), svgWrap(v.wordNo.body, v.wordNo.vb, COL.ink, COL.cream))
  fs.writeFileSync(path.join(dir, 'wordmark-dark.svg'), svgWrap(v.wordNo.body, v.wordNo.vb, COL.cream, COL.black))
  for (const mode of ['light', 'dark', 'tinted']) await shot(iconSvg(v, mode, 'x'), path.join(dir, mode === 'light' ? 'icon-1024.png' : `icon-${mode}-1024.png`), 1024)
  await shot(faviconSvg(v, 32), path.join(dir, 'favicon-32.png'), 32)
  await shot(faviconSvg(v, 16), path.join(dir, 'favicon-16.png'), 16)
  manifest.push({ id: v.id, name: v.name, idea: v.note, dir, icon: path.join(dir, 'icon-1024.png'), top3: !!v.top3 })
}

const cj = path.join(HERE, '..', 'concepts.json')
let base = JSON.parse(fs.readFileSync(cj, 'utf8'))
if (Array.isArray(base)) base = { concepts: base }
base.signature = manifest
fs.writeFileSync(cj, JSON.stringify(base, null, 2))

const cells = variants.map((v) => `
<div class="cell${v.top3 ? ' top' : ''}">
  <div class="hd"><b>${v.id}</b> ${v.name}${v.top3 ? '<i>top 3</i>' : ''}<small>weight ${v.sw}</small></div>
  <div class="row">
    <div class="ic">${iconInline(v, 'light', 88, 'b' + v.id)}</div>
    <div class="mk cream">${markInline(v, 48, COL.ink, COL.cream)}${markInline(v, 16, COL.ink, COL.cream)}</div>
    <div class="mk black">${markInline(v, 48, COL.cream, COL.black)}${markInline(v, 16, COL.cream, COL.black)}</div>
  </div>
  <div class="lk cream">${wordInline(v, true, COL.ink, COL.cream)}</div>
  <div class="lk black">${wordInline(v, false, COL.cream, COL.black)}</div>
  <p>${v.note}</p>
</div>`).join('')

const oldWmSrc = fs.readFileSync(path.join(HERE, '..', 'concepts', '02-signature', 'wordmark.svg'), 'utf8')
const oldWm = (color, bg) => oldWmSrc.replace(/color="[^"]*"/, `color="${color}"`).replace(/--bg:[^"]*"/, `--bg:${bg}"`)
const curMk = (size, color, bg) => `<svg viewBox="0 0 100 100" width="${size}" height="${size}" color="${color}" style="--bg:${bg}">${marks.signature()}</svg>`
const curCell = `<div class="cell ref"><div class="hd"><b>00</b> Current<small>reference</small></div><div class="row"><div class="ic"><div style="width:88px;height:88px;border-radius:20px;background:${COL.cream};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px #0003">${curMk(62, COL.ink, COL.cream)}</div></div><div class="mk cream">${curMk(48, COL.ink, COL.cream)}${curMk(16, COL.ink, COL.cream)}</div><div class="mk black">${curMk(48, COL.cream, COL.black)}${curMk(16, COL.cream, COL.black)}</div></div><div class="lk cream">${oldWm(COL.ink, COL.cream)}</div><div class="lk black">${oldWm(COL.cream, COL.black)}</div><p style="margin-top:auto">What the founder saw: curve too strong, reads as a loop.</p></div>`
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Sora:wght@600&display=swap">'
const board = `<!doctype html><html><head><meta charset="utf-8"><title>Emera signature refinements</title>${fonts}
<style>
:root{--cream:${COL.cream};--ink:${COL.ink};--black:${COL.black};--sun:${COL.sun}}
*{box-sizing:border-box;margin:0}
html,body{height:100%}
body{background:#ece7dc;font-family:'DM Sans',system-ui,sans-serif;color:var(--ink);display:flex;flex-direction:column;overflow:auto}
header{height:36px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 16px;font-family:Sora,system-ui,sans-serif;font-weight:600;font-size:13px}
header span{font-family:'DM Sans';font-weight:400;font-size:12px;opacity:.65}
.grid{flex:1;min-height:0;display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:repeat(2,minmax(380px,1fr));gap:8px;padding:0 10px 10px}
.cell{background:#fbf9f4;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:7px;border:1px solid #ddd6c7;min-height:0}
.cell.top{border:2px solid var(--sun)}
.hd{font-family:Sora,system-ui,sans-serif;font-weight:600;font-size:13px;display:flex;gap:6px;align-items:baseline}
.hd b{opacity:.45}.hd i{font-style:normal;font-size:10px;background:var(--sun);color:#fff;padding:1px 7px;border-radius:9px}.hd small{margin-left:auto;font-family:'DM Sans';font-weight:400;font-size:10px;opacity:.55}
.row{display:flex;gap:6px;align-items:center}
.ic svg{display:block;filter:drop-shadow(0 2px 4px #0003)}
.mk{flex:1;height:88px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
.cream{background:var(--cream);border:1px solid #e3dccd}.black{background:var(--black)}
.lk{flex:1;min-height:70px;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:8px 10px}
.lk svg{width:100%;max-height:78px;height:auto}
p{font-size:12px;opacity:.8}
</style></head><body>
<header>Emera Signature, 8 refinements<span>icon / mark 48 + 16 on cream and black / lockup on cream with dot, on black without dot</span></header>
<div class="grid">${cells}${curCell}</div></body></html>`
fs.writeFileSync(path.join(HERE, 'board.html'), board)

await page.setViewportSize({ width: 1512, height: 860 })
await page.goto('file://' + HERE + '/board.html')
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(500)
console.log('board scrollHeight', await page.evaluate(() => document.documentElement.scrollHeight))
await page.screenshot({ path: ART + '/logo-signature.png' })

export { variants, iconInline, markInline, wordInline, faviconSvg, page, browser, HERE, ART, fonts }
if (!process.argv.includes('--keep')) await browser.close()
