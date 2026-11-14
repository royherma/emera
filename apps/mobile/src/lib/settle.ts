export const EDGE = 12;
const FLICK = 60;

export function centerTop(itemTop: number, itemHeight: number, viewHeight: number) {
  return itemHeight <= viewHeight - EDGE * 2 ? itemTop - (viewHeight - itemHeight) / 2 : itemTop - EDGE;
}

export function pickStop(stops: number[], start: number, now: number): number {
  if (!stops.length) return now;
  const nearest = (y: number) => stops.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
  const from = nearest(start);
  const to = nearest(now);
  const moved = now - start;
  if (to !== from || Math.abs(moved) < FLICK) return to;
  const ahead = moved > 0 ? stops.filter((y) => y > from).sort((a, b) => a - b)[0] : stops.filter((y) => y < from).sort((a, b) => b - a)[0];
  return ahead ?? to;
}

export function settleOnStop(el: HTMLElement) {
  let start = el.scrollTop;
  let timer = 0;
  let touching = false;
  let target: number | null = null;
  const stops = () => {
    const box = el.getBoundingClientRect();
    const max = el.scrollHeight - el.clientHeight;
    const posts = [...el.querySelectorAll<HTMLElement>("[data-settle]")].map((n) => {
      const r = n.getBoundingClientRect();
      return Math.round(Math.min(max, Math.max(0, centerTop(r.top - box.top + el.scrollTop, r.height, el.clientHeight))));
    });
    return [0, ...posts, max];
  };
  const settle = () => {
    if (touching) return;
    const to = pickStop(stops(), start, el.scrollTop);
    start = to;
    if (Math.abs(to - el.scrollTop) < 2) return;
    target = to;
    el.scroll({ top: to, behavior: "smooth" }); // react-native-web overrides el.scrollTo with its own {x, y} version
  };
  const onScroll = () => {
    if (target != null) {
      if (Math.abs(el.scrollTop - target) < 2) target = null;
      return;
    }
    clearTimeout(timer);
    timer = window.setTimeout(settle, 160);
  };
  const takeOver = () => {
    if (target == null) return;
    target = null;
    start = el.scrollTop;
  };
  const down = () => {
    touching = true;
    takeOver();
  };
  const up = () => {
    touching = false;
    clearTimeout(timer);
    timer = window.setTimeout(settle, 160);
  };
  el.addEventListener("scroll", onScroll, { passive: true });
  el.addEventListener("wheel", takeOver, { passive: true });
  el.addEventListener("touchstart", down, { passive: true });
  el.addEventListener("touchend", up, { passive: true });
  return () => {
    clearTimeout(timer);
    el.removeEventListener("scroll", onScroll);
    el.removeEventListener("wheel", takeOver);
    el.removeEventListener("touchstart", down);
    el.removeEventListener("touchend", up);
  };
}
