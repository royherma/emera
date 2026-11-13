import fs from 'node:fs'
import path from 'node:path'
import { COL, squirclePath } from '../lib.mjs'

const PW = process.env.PLAYWRIGHT_CORE_MJS || '~/Desktop/Development/tg-openstudio/openscreen-fork/node_modules/playwright-core/index.mjs'
const EXE = process.env.CHROME_HEADLESS || '~/Library/Caches/ms-playwright/chromium_headless_shell-1252/chrome-headless-shell-mac-arm64/chrome-headless-shell'
const HERE = import.meta.dirname
const f = (n) => +n.toFixed(2)

// Roy's sketch, traced in its own pixel space (2026-11-13 screenshot), in drawing order.
const ROY = [[170, 249], [186, 244], [200, 235], [207, 221], [208, 204], [203, 192], [191, 186], [177, 184], [161, 188], [146, 197], [135, 211], [125, 230], [116, 250], [114, 262], [120, 272], [134, 282], [155, 289], [185, 293], [214, 294], [233, 292], [244, 284], [251, 269], [257, 249], [262, 228], [265, 211]]
const ENTRY = [[72, 268], [100, 262], [135, 255]]

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }

function spline(pts, per = 18) {
  const out = []
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))]
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)]
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)))
    }
  }
  out.push(pts.at(-1))
  return out
}

function stroke(pts, { sw, press, wobble = 0, seed = 1 }) {
  const r = rng(seed)
  const jit = pts.map(([x, y], i) => (i === 0 || i === pts.length - 1 ? [x, y] : [x + (r() - 0.5) * wobble, y + (r() - 0.5) * wobble]))
  const s = spline(jit)
  const len = [0]
  for (let i = 1; i < s.length; i++) len.push(len[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]))
  const L = len.at(-1)
  const ph = r() * 6
  const segs = []
  for (let i = 1; i < s.length; i++) {
    const t = len[i] / L
    const w = sw * press(t) * (1 + 0.02 * Math.sin(t * 11 + ph))
    segs.push(`<path d="M${f(s[i - 1][0])} ${f(s[i - 1][1])}L${f(s[i][0])} ${f(s[i][1])}" stroke-width="${f(w)}"/>`)
  }
  return { body: segs.join(''), pts: s, start: s[0], end: s.at(-1), dir: [s.at(-1)[0] - s.at(-4)[0], s.at(-1)[1] - s.at(-4)[1]] }
}

const fit = (pts, x0, y0, h) => {
  const ys = pts.map((p) => p[1]), xs = pts.map((p) => p[0])
  const minY = Math.min(...ys), maxY = Math.max(...ys), minX = Math.min(...xs)
  const k = h / (maxY - minY)
  return pts.map(([x, y]) => [x0 + (x - minX) * k, y0 + (y - minY) * k])
}

const gentle = (t) => (t < 0.04 ? 0.85 + t * 3 : 0.92 + 0.14 * Math.sin(Math.PI * Math.min(1, t * 1.05)))
const brush = (t) => (t < 0.1 ? 0.45 + (t / 0.1) * 0.5 : t > 0.68 ? 0.95 - ((t - 0.68) / 0.32) * 0.6 : 0.95 + 0.3 * Math.sin(Math.PI * ((t - 0.1) / 0.58)))
const withEntry = (t) => (t < 0.12 ? 0.45 + (t / 0.12) * 0.45 : gentle(t))

const VERSIONS = [
  { id: '01', slug: '01-your-sketch', name: 'Your sketch', note: 'Your stroke, cleaned only enough to read at app-icon size', trace: ROY, press: gentle, wobble: 0.7, sw: 12.5, seed: 7 },
  { id: '02', slug: '02-sketch-sun', name: 'Sketch + sun', note: 'Your stroke, with the sun where the pen lifts off', trace: ROY, press: gentle, wobble: 0.7, sw: 12.5, seed: 7, sun: 'eye' },
  { id: '03', slug: '03-brush', name: 'Brush', note: 'Faster and looser, thin where the pen lands and lifts', trace: ROY, press: brush, wobble: 1.4, sw: 13.5, seed: 21 },
  { id: '04', slug: '04-signed', name: 'Signed', note: 'Your stroke with the lead-in from the first Signature', trace: [...ENTRY, ...ROY.slice(0)], press: withEntry, wobble: 0.7, sw: 12, seed: 7 },
]

const eyeSun = (st, sw, scale = 1) => `<circle cx="${f(st.start[0])}" cy="${f(st.start[1])}" r="${f(sw * 0.6 * scale)}" fill="${COL.sun}"/>`
function sunAt(st, sw, scale = 1) {
  const [dx, dy] = st.dir, l = Math.hypot(dx, dy)
  const r = 8.5 * scale
  const gap = sw * 0.45 + r + 2.5 * scale
  return `<circle cx="${f(st.end[0] + (dx / l) * gap)}" cy="${f(st.end[1] + (dy / l) * gap)}" r="${f(r)}" fill="${COL.sun}"/>`
}

const G = (inner) => `<g fill="none" stroke="currentColor" stroke-linecap="round">${inner}</g>`

function mark(v) {
  const pts = fit(v.trace, 0, 0, 56)
  const st = stroke(pts, v)
  let body = G(st.body) + (v.sun ? eyeSun(st, v.sw) : '')
  const extra = 0
  const xs = st.pts.map((p) => p[0]), ys = st.pts.map((p) => p[1])
  const pad = v.sw / 2 + 3
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad - extra, maxY = Math.max(...ys) + pad
  const side = Math.max(maxX - minX, maxY - minY)
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2 + extra * 0.25
  const vb = [f(cx - side / 2), f(cy - side / 2), f(side), f(side)]
  return { body, vb }
}

const LETTERS = {
  m: [[[0, 6], [0.4, 34], [0, 60]], [[0, 24], [5, 7], [15, 0], [24, 5], [27, 20], [27, 40], [27.5, 60]], [[27, 22], [33, 6], [43, 0], [52, 6], [55, 22], [55, 42], [56, 60]]],
  r: [[[0, 6], [0.5, 34], [0, 60]], [[0, 28], [6, 10], [16, 2], [29, 1]]],
  a: [[[41, 15], [33, 3], [19, 0], [7, 8], [1, 28], [4, 48], [16, 59], [30, 57], [40, 43]], [[43, 1], [42, 30], [43.5, 60]]],
}
const ADV = { m: 56, r: 29, a: 44 }

function wordmark(v) {
  const H = 60, sw = v.sw * 0.74
  const parts = []
  let x = 0
  const eHand = (trace, press, seed, entry) => {
    const pts = fit(trace, x, 0, H)
    const st = stroke(pts, { ...v, sw, press, seed })
    parts.push(st.body)
    x = Math.max(...pts.map((p) => p[0])) + sw + 7
    return st
  }
  const first = eHand(v.trace, v.press, v.seed)
  for (const [ch, seed] of [['m', 3], ['e', 5], ['r', 9], ['a', 11]]) {
    if (ch === 'e') { eHand(ROY, v.press === brush ? brush : gentle, v.seed + seed); continue }
    for (const [i, s] of LETTERS[ch].entries()) parts.push(stroke(s.map(([a, b]) => [x + a, b]), { ...v, sw, press: v.press === brush ? brush : gentle, wobble: v.wobble * 0.6, seed: seed * 10 + i }).body)
    x += ADV[ch] + sw + 7
  }
  const sun = v.sun ? eyeSun(first, sw) : ''
  const pad = sw / 2 + 4
  const minX = Math.min(...first.pts.map((p) => p[0])) - pad
  const top = -pad
  return { body: G(parts.join('')) + sun, vb: [f(minX), f(top), f(x - 7 - minX + pad), f(H + pad - top)] }
}

const svg = (body, vb, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" color="${COL.ink}" ${extra}>${body}</svg>`
function iconSvg(m, mode, scale = 700) {
  const bg = mode === 'dark' ? COL.black : COL.cream
  const ink = mode === 'dark' ? COL.cream : COL.ink
  const o = (1024 - scale) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs><clipPath id="sq"><path d="${squirclePath()}"/></clipPath></defs><g clip-path="url(#sq)"><rect width="1024" height="1024" fill="${bg}"/><g color="${ink}"><svg x="${o}" y="${o}" width="${scale}" height="${scale}" viewBox="${m.vb.join(' ')}">${m.body}</svg></g></g></svg>`
}
const faviconSvg = (m, size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"><rect width="100" height="100" rx="22" fill="${COL.cream}"/><g color="${COL.ink}"><svg x="6" y="6" width="88" height="88" viewBox="${m.vb.join(' ')}">${m.body}</svg></g></svg>`

const { chromium } = await import(PW)
const browser = await chromium.launch({ executablePath: EXE })
const page = await browser.newPage()
async function shot(markup, file, w, h = w) {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`)
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } })
}

const manifest = []
for (const v of VERSIONS) {
  const dir = path.join(HERE, v.slug)
  fs.mkdirSync(dir, { recursive: true })
  const m = mark(v)
  const w = wordmark(v)
  fs.writeFileSync(path.join(dir, 'mark.svg'), svg(m.body, m.vb))
  fs.writeFileSync(path.join(dir, 'wordmark.svg'), svg(w.body, w.vb))
  fs.writeFileSync(path.join(dir, 'wordmark-dark.svg'), svg(w.body, w.vb).replace(`color="${COL.ink}"`, `color="${COL.cream}"`))
  await shot(iconSvg(m, 'light'), path.join(dir, 'icon-1024.png'), 1024)
  await shot(iconSvg(m, 'dark'), path.join(dir, 'icon-dark-1024.png'), 1024)
  await shot(faviconSvg(m, 32), path.join(dir, 'favicon-32.png'), 32)
  await shot(faviconSvg(m, 16), path.join(dir, 'favicon-16.png'), 16)
  manifest.push({ id: v.id, name: v.name, note: v.note, dir: `brand/logo/handdrawn/${v.slug}` })
}

const card = (v) => {
  const d = `brand/logo/handdrawn/${v.slug}`
  return `<div class="c"><img class="i" src="/file/${d}/icon-1024.png"><div class="f"><img src="/file/${d}/favicon-32.png" width="32"><img src="/file/${d}/favicon-16.png" width="16"><img src="/file/${d}/icon-dark-1024.png" width="64"></div><img class="w" src="/file/${d}/wordmark.svg"><b>${v.id} ${v.name}</b><span>${v.note}</span></div>`
}
fs.writeFileSync(path.join(HERE, 'board.html'), `<!doctype html><meta charset="utf-8"><title>Hand-drawn e</title><style>body{margin:0;padding:24px;background:#f6f3ec;font:14px Inter,system-ui,sans-serif;color:#1c1a17}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.c{background:#fff;border:1px solid #e4ded3;border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px}.i{width:100%}.w{height:44px;align-self:flex-start}.f{display:flex;gap:12px;align-items:center}span{color:#7a746b;font-size:12.5px}</style><div class="g">${VERSIONS.map(card).join('')}</div>`)
await shot(`<div style="display:flex;gap:24px;padding:24px;background:#f6f3ec;width:1500px">${VERSIONS.map((v) => {
  const d = path.join(HERE, v.slug)
  const icon = fs.readFileSync(path.join(d, 'icon-1024.png')).toString('base64')
  const fav = fs.readFileSync(path.join(d, 'favicon-32.png')).toString('base64')
  const word = fs.readFileSync(path.join(d, 'wordmark.svg'), 'utf8').replace('<svg ', '<svg height="56" ')
  return `<div style="width:350px;display:flex;flex-direction:column;gap:12px"><img src="data:image/png;base64,${icon}" width="350"><div style="display:flex;gap:12px;align-items:center"><img src="data:image/png;base64,${fav}" width="32"><img src="data:image/png;base64,${fav}" width="64" style="image-rendering:pixelated"></div>${word}<b style="font:600 16px system-ui">${v.id} ${v.name}</b></div>`
}).join('')}</div>`, path.join(HERE, 'preview.png'), 1548, 640)
fs.writeFileSync(path.join(HERE, 'versions.json'), `${JSON.stringify(manifest, null, 2)}\n`)
await browser.close()
console.log(manifest.map((m) => m.dir).join('\n'))
