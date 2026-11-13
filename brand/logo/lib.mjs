export const COL = {
  cream: '#f6f3ec',
  ink: '#1c1a17',
  black: '#0c0a09',
  sun: '#ff8a2b',
  sun2: '#ffc24a',
  pink: '#ff4f8b',
  yellow: '#ffd61c',
  teal: '#51d6d2',
  blue: '#5180d6',
  red: '#ff283c',
  dusk: '#d8634f',
}

const rad = (d) => (d * Math.PI) / 180
const f = (n) => +n.toFixed(2)
const P = (cx, cy, r, deg) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))]
const BG = 'var(--bg,#f6f3ec)'

export function ePath(cx, cy, r, k = 0, term = 38) {
  const dx = Math.sqrt(r * r - k * k)
  const [tx, ty] = P(cx, cy, r, term)
  return `M${f(cx - dx)} ${f(cy + k)}L${f(cx + dx)} ${f(cy - k)}A${r} ${r} 0 1 0 ${f(tx)} ${f(ty)}`
}

export const marks = {
  rise: () => `
    <path d="M26 44A24 24 0 0 1 74 44Z" fill="${COL.sun}"/>
    <path d="${ePath(50, 50, 38, 0, 34)}" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 50H88" stroke="currentColor" stroke-width="12" stroke-linecap="round" opacity="0"/>
  `,
  signature: () => `
    <path d="M14 66C34 70 74 60 76 42C78 24 54 18 38 36C22 54 28 84 52 82C68 80 76 70 84 58" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="89" cy="47" r="10" fill="${COL.sun}"/>
  `,
  aperture: (u) => {
    const cols = [COL.pink, COL.sun2, COL.teal, COL.blue, COL.yellow, COL.red]
    const R = 47
    let s = ""
    for (let k = 0; k < 6; k++) {
      const a = k * 60 - 90
      const [x1, y1] = P(50, 50, R, a)
      const [x2, y2] = P(50, 50, R, a + 60)
      const [qx, qy] = P(50, 50, 24, a + 60 + 95)
      s += `<path d="M${f(x1)} ${f(y1)}A${R} ${R} 0 0 1 ${f(x2)} ${f(y2)}L${f(qx)} ${f(qy)}Z" fill="${cols[k]}" stroke="${BG}" stroke-width="2.4" stroke-linejoin="round"/>`
    }
    return s + `<circle cx="50" cy="50" r="17" fill="${COL.sun}" stroke="${BG}" stroke-width="3"/>`
  },
  overlap: (u) => `
    <defs><clipPath id="o${u}"><circle cx="62" cy="62" r="33"/></clipPath></defs>
    <circle cx="38" cy="38" r="33" fill="${COL.sun}"/>
    <circle cx="62" cy="62" r="33" fill="currentColor"/>
    <circle cx="38" cy="38" r="33" fill="${COL.pink}" clip-path="url(#o${u})"/>
  `,
  gathering: (u) => {
    const cols = [COL.pink, COL.blue, COL.teal, COL.yellow]
    const pieces = [
      ['M8 8H50A42 42 0 0 1 8 50Z', 0],
      ['M92 8V50A42 42 0 0 1 50 8Z', 1],
      ['M92 92H50A42 42 0 0 1 92 50Z', 2],
      ['M8 92V50A42 42 0 0 1 50 92Z', 3],
    ]
    return `
    <defs><clipPath id="g${u}"><rect x="6" y="6" width="88" height="88" rx="26"/></clipPath></defs>
    <g clip-path="url(#g${u})">
      ${pieces.map(([d, i]) => `<path d="${d}" fill="${cols[i]}" transform="translate(${i === 0 || i === 3 ? -2 : 2} ${i < 2 ? -2 : 2})" stroke="${BG}" stroke-width="0"/>`).join('')}
    </g>
    <circle cx="50" cy="50" r="26" fill="${COL.sun}"/>`
  },
  epsilon: () => `
    <path d="M76 14H50A19 19 0 0 0 50 52" fill="none" stroke="${COL.sun}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M50 52A19 19 0 0 0 50 90H76" fill="none" stroke="currentColor" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
  `,
  dots: () => {
    const cols = [COL.pink, COL.yellow, COL.teal, COL.blue, COL.red, COL.sun2, COL.pink, COL.teal, COL.blue, COL.yellow]
    let s = ''
    const n = 8
    for (let i = 0; i < n; i++) {
      const a = -(i * (324 / (n - 1)))
      const [x, y] = P(50, 50, 36, a)
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="10.5" fill="${cols[i]}"/>`
    }
    s += ``
    s += `<circle cx="50" cy="50" r="14" fill="${COL.sun}"/>`
    return s
  },
  arch: () => `
    <path d="M16 92V46A34 34 0 0 1 84 46V92Z" fill="currentColor"/>
    <path d="M28 92A22 22 0 0 1 72 92Z" fill="${COL.sun}"/>
  `,
  crowd: () => `
    <path d="M6 88V52A19 19 0 0 1 44 52V88Z" fill="${COL.pink}"/>
    <path d="M56 88V52A19 19 0 0 1 94 52V88Z" fill="${COL.blue}"/>
    <path d="M30 88V34A20 20 0 0 1 70 34V88Z" fill="${COL.sun}" stroke="${BG}" stroke-width="3.2" stroke-linejoin="round"/>
  `,
  slide: () => `
    <path d="M6 48A38 38 0 0 1 82 48Z" fill="${COL.sun}"/>
    <path d="M18 54A38 38 0 0 0 94 54Z" fill="currentColor"/>
  `,
  twin: (u) => `
    <defs><clipPath id="t${u}"><rect x="-10" y="-10" width="120" height="60"/></clipPath><clipPath id="u${u}"><rect x="-10" y="50" width="120" height="70"/></clipPath></defs>
    <path d="${ePath(50, 50, 36, 0, 36)}" fill="none" stroke="${COL.sun}" stroke-width="24" clip-path="url(#t${u})"/>
    <path d="${ePath(50, 50, 36, 0, 36)}" fill="none" stroke="currentColor" stroke-width="24" clip-path="url(#u${u})"/>
  `,
  eclipse: (u) => `
    <defs><mask id="e${u}"><rect width="100" height="100" fill="#fff"/><path d="M4 50H96" stroke="#000" stroke-width="9"/><path d="M52 50L96 50L96 74Z" fill="#000" transform="translate(2 0)"/></mask></defs>
    <circle cx="42" cy="40" r="40" fill="${COL.sun}"/>
    <circle cx="54" cy="54" r="38" fill="currentColor" mask="url(#e${u})"/>
  `,
}

export function glyphs(sw, tr, o = {}) {
  const k = o.tilt ?? 0
  const term = o.term ?? 38
  const items = []
  let x = 0
  const adv = (w) => { x += w + sw * 0.9 + tr }
  const E = (barColor) => {
    const cx = x + 50
    const dx = Math.sqrt(2500 - k * k)
    const full = ePath(cx, 50, 50, k, term)
    const arcOnly = full.slice(full.indexOf('A'))
    const start = `M${f(cx + dx)} ${f(50 - k)}`
    items.push(`<path d="${start}${arcOnly}" fill="none" stroke="currentColor"/>`)
    items.push(`<path d="M${f(cx - dx)} ${f(50 + k)}L${f(cx + dx)} ${f(50 - k)}" fill="none" stroke="${barColor || 'currentColor'}"/>`)
    adv(100)
  }
  E(o.bar1)
  items.push(`<path d="M${x} 0V100M${x} 24A24 24 0 0 1 ${x + 48} 24V100M${x + 48} 24A24 24 0 0 1 ${x + 96} 24V100" fill="none" stroke="currentColor"/>`)
  adv(96)
  E(o.bar2)
  items.push(`<path d="M${x} 0V100M${x} 28A28 28 0 0 1 ${x + 28} 0H${x + 44}" fill="none" stroke="currentColor"/>`)
  adv(44)
  items.push(`<circle cx="${x + 50}" cy="50" r="50" fill="none" stroke="currentColor"/><path d="M${x + 100} 0V100" fill="none" stroke="${o.aStem || 'currentColor'}"/>`)
  const aw = 100
  const width = x + aw
  let extra = ''
  if (o.dot) extra = `<circle cx="${width + sw * 0.9 + tr + 4 + (o.dotR || 9)}" cy="100" r="${o.dotR || 9}" fill="${o.dot}"/>`
  const end = width + (o.dot ? sw * 0.9 + tr + 8 + (o.dotR || 9) * 2 : 0)
  return { body: items.join('') + extra, width: end }
}

export function wordmarkSvg(o, uid) {
  const sw = o.sw
  const g = glyphs(sw, o.tr ?? 6, o)
  const cap = o.cap || 'round'
  const markSize = 1.22
  const markW = 100 * markSize
  const gap = o.gap ?? 40
  const tx = markW + gap
  const padX = 14
  const W = tx + g.width + sw / 2 + padX
  const top = Math.min(-sw / 2 - 4, 50 - 50 * markSize - 4)
  const bottom = Math.max(100 + sw / 2 + 4, 50 + 50 * markSize + 4)
  const H = bottom - top
  const vb = `${-padX + 8} ${f(top)} ${f(W + 8)} ${f(H)}`
  return { vb, W: W + 8, H, inner: (markInner) => `
    <g transform="translate(0 ${f(50 - 50 * markSize)}) scale(${markSize})">${markInner}</g>
    <g transform="translate(${f(tx)} 0)" stroke-width="${sw}" stroke-linecap="${cap}" stroke-linejoin="round">${g.body}</g>
  ` }
}

export const cap = (inner, vb, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${extra}>${inner}</svg>`

export function markSvg(name, uid = '', color = COL.ink) {
  return cap(marks[name](uid), '0 0 100 100', `color="${color}"`)
}

export function squirclePath(size = 1024, n = 5) {
  const r = size / 2
  const pts = []
  const steps = 360
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    const x = r + r * Math.sign(c) * Math.pow(Math.abs(c), 2 / n)
    const y = r + r * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)
    pts.push(`${f(x)} ${f(y)}`)
  }
  return `M${pts.join('L')}Z`
}

export function iconSvg(name, mode, o = {}) {
  const dark = mode !== 'light'
  const bg = mode === 'light' ? COL.cream : mode === 'dark' ? COL.black : '#000'
  const ink = dark ? COL.cream : COL.ink
  const scale = o.scale ?? 6.0
  const tx = 512 - 50 * scale
  const filter = mode === 'tinted' ? 'style="filter:grayscale(1) brightness(1.35) contrast(1.15)"' : ''
  const clip = squirclePath()
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" style="--bg:${bg}">
    <defs><clipPath id="sq"><path d="${clip}"/></clipPath></defs>
    <g clip-path="url(#sq)"><rect width="1024" height="1024" fill="${bg}"/>
    <g ${filter} color="${ink}" transform="translate(${tx + (o.dx ?? 0) * scale} ${tx + (o.dy ?? 0) * scale}) scale(${scale})">${marks[name]('i' + mode)}</g></g></svg>`
}

export function faviconSvg(name, size) {
  const s = 0.7
  const t = 50 - 50 * s
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" style="--bg:${COL.cream}"><rect width="100" height="100" rx="22" fill="${COL.cream}"/><g color="${COL.ink}" transform="translate(${t * 1 + 0} ${t}) scale(${s})">${marks[name]('f' + size)}</g></svg>`
}

export function lockup(c, color, bg, uid) {
  const w = wordmarkSvg(c.wm, uid)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${w.vb}" color="${color}" style="--bg:${bg}">${w.inner(marks[c.mark](uid))}</svg>`
}

