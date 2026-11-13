import { type ComponentRef, createContext, type ReactNode, type RefObject, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { Platform, type StyleProp, View, type ViewStyle } from "react-native";

const web = Platform.OS === "web";
const GAP = 12;

type Host = { inner: RefObject<ComponentRef<typeof View> | null>; set: (key: string, y: number | null) => void };
const SnapContext = createContext<Host | null>(null);
export const SnapProvider = SnapContext.Provider;

export function useSnapHost(contentTop: number) {
  const inner = useRef<ComponentRef<typeof View>>(null);
  const ys = useRef(new Map<string, number>());
  const [offsets, setOffsets] = useState<number[]>([]);
  const set = useCallback(
    (key: string, y: number | null) => {
      if (y == null) ys.current.delete(key);
      else ys.current.set(key, y);
      setOffsets([...ys.current.values()].map((v) => Math.max(0, Math.round(v + contentTop - GAP))).sort((a, b) => a - b));
    },
    [contentTop],
  );
  const host = useMemo(() => ({ inner, set }), [set]);
  return { inner, offsets, host };
}

export const snapContainer = web ? ({ scrollSnapType: "y mandatory" } as object) : null;

export function SnapItem({ children, style, align = "start", top = false }: { children?: ReactNode; style?: StyleProp<ViewStyle>; align?: "start" | "end"; top?: boolean }) {
  const host = useContext(SnapContext);
  const ref = useRef<ComponentRef<typeof View>>(null);
  const key = useId();
  useEffect(() => () => host?.set(key, null), [host, key]);
  const onLayout = () => {
    if (web || !host?.inner.current || !ref.current || align === "end") return;
    ref.current.measureLayout(host.inner.current as never, (_x, y) => host.set(key, top ? -1e6 : y), () => {});
  };
  const data = web && host ? ({ dataSet: { snap: top ? "top" : align } } as object) : null;
  const css = web && host ? ({ scrollSnapAlign: align, scrollSnapStop: "always", scrollMarginTop: top ? 400 : GAP, scrollMarginBottom: GAP } as object) : null;
  return (
    <View ref={ref} onLayout={onLayout} style={[css, style]} {...data}>
      {children}
    </View>
  );
}

function glide(el: HTMLElement, to: number, ms = 420) {
  const from = el.scrollTop;
  const start = performance.now();
  el.style.scrollSnapType = "none";
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    el.scrollTop = from + (to - from) * (1 - Math.pow(1 - t, 3));
    if (t < 1) requestAnimationFrame(step);
    else el.style.scrollSnapType = "";
  };
  requestAnimationFrame(step);
}

export function pageByWheel(el: HTMLElement) {
  let lockUntil = 0;
  let acc = 0;
  let lastAt = 0;
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const now = performance.now();
    const box = el.getBoundingClientRect();
    const top = el.scrollTop;
    const nodes = [...el.querySelectorAll<HTMLElement>('[data-snap="top"], [data-snap="start"]')];
    const stops = nodes.map((n) => (n.dataset.snap === "top" ? 0 : Math.max(0, Math.round(n.getBoundingClientRect().top - box.top + top - GAP))));
    const down = e.deltaY > 0;
    const at = stops.filter((y) => y <= top + 2).length - 1;
    const here = nodes[at + 1] ? nodes[at + 1].getBoundingClientRect().top - GAP : el.scrollHeight - top + box.top;
    if (down && here > box.bottom + 4) return;
    if (!down && at >= 0 && top > stops[at] + 4 && now >= lockUntil) return;
    e.preventDefault();
    if (now < lockUntil) {
      lockUntil = Math.max(lockUntil, now + 160);
      return;
    }
    if (now - lastAt > 250) acc = 0;
    acc += e.deltaY;
    lastAt = now;
    if (Math.abs(acc) < 30) return;
    acc = 0;
    const target = down ? stops.find((y) => y > top + 2) ?? el.scrollHeight : [...stops].reverse().find((y) => y < top - 2) ?? 0;
    glide(el, Math.min(target, el.scrollHeight - el.clientHeight));
    lockUntil = now + 520;
  };
  el.addEventListener("wheel", onWheel, { passive: false });
  return () => el.removeEventListener("wheel", onWheel);
}
