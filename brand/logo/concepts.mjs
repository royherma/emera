import { COL } from './lib.mjs'

export const concepts = [
  { id: '01', slug: 'rise', name: 'Rise', mark: 'rise', idea: 'The e is a horizon: a sun comes up through the bar.', wm: { sw: 12, tr: 6, tilt: 0, bar1: COL.sun } },
  { id: '02', top3: true, slug: 'signature', name: 'Signature', mark: 'signature', idea: 'One unbroken stroke, an e signed by hand, closed with a sun.', wm: { sw: 9, tr: 10, dot: COL.sun, dotR: 8 } },
  { id: '03', slug: 'aperture', name: 'Aperture', mark: 'aperture', idea: 'Six blades open on a sun; each colour is someone’s work.', wm: { sw: 13, tr: 2, tilt: 8 } },
  { id: '04', slug: 'dusk', name: 'Dusk', mark: 'overlap', idea: 'Day and night overlap, and the overlap is dusk.', wm: { sw: 11, tr: 8, bar1: COL.sun, bar2: COL.pink } },
  { id: '05', slug: 'gathering', name: 'Gathering', mark: 'gathering', idea: 'Four colours close around one sun, like hands around the day.', wm: { sw: 14, tr: 0, bar1: COL.pink, bar2: COL.blue } },
  { id: '06', top3: true, slug: 'epsilon', name: 'Epsilon', mark: 'epsilon', idea: 'Greek epsilon as two bowls: day above, night below.', wm: { sw: 14, tr: 4, term: 20 } },
  { id: '07', slug: 'people', name: 'People', mark: 'dots', idea: 'An e made of people, every dot a different colour, one sun.', wm: { sw: 10, tr: 12, cap: 'round', bar1: COL.pink, bar2: COL.blue } },
  { id: '08', slug: 'window', name: 'Window', mark: 'arch', idea: 'An arched window onto sunrise: your work, out in the open.', wm: { sw: 12, tr: 6, tilt: 6 } },
  { id: '09', slug: 'crowd', name: 'Crowd', mark: 'crowd', idea: 'Three arches, three heights, the sun in the middle.', wm: { sw: 12, tr: 4, tilt: 7, bar1: COL.pink, bar2: COL.blue } },
  { id: '10', slug: 'switch', name: 'Switch', mark: 'slide', idea: 'The day and night switch, caught mid slide.', wm: { sw: 11, tr: 6, bar1: COL.sun } },
  { id: '11', top3: true, slug: 'twin', name: 'Twin tone', mark: 'twin', idea: 'One bold e, sun above the bar, night below.', wm: { sw: 16, tr: 0, cap: 'butt', bar1: COL.sun } },
  { id: '12', slug: 'eclipse', name: 'Eclipse', mark: 'eclipse', idea: 'Night in front, sun behind: the e is the light that gets through.', wm: { sw: 12, tr: 6, tilt: 10, bar1: COL.sun } },
]
