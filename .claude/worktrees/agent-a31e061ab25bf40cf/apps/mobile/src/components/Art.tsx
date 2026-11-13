import { useId } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

const palettes = [
  ["#fbe3c4", "#f08a4b", "#b5452f", "#3a1f3d", "#ffd27d"],
  ["#d9efe6", "#4fa588", "#1f6a5a", "#0f2f3a", "#f6d37a"],
  ["#ece3f8", "#9a7fe0", "#4b3a95", "#1a1440", "#ffa994"],
  ["#f3e6d6", "#d49a6a", "#85503a", "#2e1d17", "#f2c27a"],
  ["#e1eef9", "#69a3dc", "#2a5a98", "#102345", "#ffe0a6"],
  ["#eef0d6", "#a9bf6a", "#547443", "#1e2d20", "#f4ad62"],
  ["#fbe1e4", "#ee8296", "#b04058", "#3f1628", "#ffd9ad"],
  ["#ddd9d0", "#8a8478", "#38342d", "#141311", "#e2573a"],
];

function hash(s: string) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wave(r: () => number, y: number, amp: number) {
  const pts = 6;
  let d = `M-10 ${y}`;
  for (let i = 0; i <= pts; i++) {
    const x = -10 + (i * 120) / pts;
    d += ` Q${x - 10} ${y + (r() - 0.5) * amp * 2} ${x} ${y + (r() - 0.5) * amp}`;
  }
  return `${d} L110 130 L-10 130 Z`;
}

export function Art({ seed, style }: { seed: string; style?: ViewStyle }) {
  const uid = useId().replace(/:/g, "");
  const h = hash(seed);
  const r = rng(h);
  const p = palettes[h % palettes.length];
  const variant = Math.floor(h / 8) % 5;
  const g = (n: string) => `${n}${uid}`;
  const els: React.ReactNode[] = [];

  if (variant === 0) {
    const sx = 25 + r() * 50;
    const sy = 38 + r() * 24;
    els.push(<Circle key="halo" cx={sx} cy={sy} r={46} fill={`url(#${g("h")})`} />);
    els.push(<Circle key="sun" cx={sx} cy={sy} r={13 + r() * 6} fill={p[4]} />);
    els.push(<Path key="w1" d={wave(r, 78, 6)} fill={p[1]} opacity={0.9} />);
    els.push(<Path key="w2" d={wave(r, 90, 6)} fill={p[2]} />);
    els.push(<Path key="w3" d={wave(r, 104, 5)} fill={p[3]} />);
  } else if (variant === 1) {
    for (let i = 0; i < 4; i++) {
      els.push(<Circle key={i} cx={r() * 100} cy={r() * 125} r={38 + r() * 34} fill={`url(#${g("b" + (i % 3))})`} />);
    }
    els.push(<Circle key="dot" cx={30 + r() * 40} cy={30 + r() * 50} r={6} fill={p[4]} />);
  } else if (variant === 2) {
    const cx = 50;
    const base = 112;
    for (let i = 0; i < 6; i++) {
      const w = 92 - i * 14;
      const top = base - (w + 22);
      els.push(<Path key={i} d={`M${cx - w / 2} ${base} L${cx - w / 2} ${top + w / 2} A${w / 2} ${w / 2} 0 0 1 ${cx + w / 2} ${top + w / 2} L${cx + w / 2} ${base} Z`} fill={[p[3], p[2], p[1], p[0], p[4], p[1]][i]} opacity={i === 3 ? 0.9 : 1} />);
    }
  } else if (variant === 3) {
    els.push(<Circle key="o" cx={50 + (r() - 0.5) * 30} cy={52} r={34} fill={p[4]} opacity={0.95} />);
    for (let i = 0; i < 4; i++) els.push(<Circle key={"r" + i} cx={50} cy={62} r={24 + i * 15} fill="none" stroke={p[2 + (i % 2)]} strokeWidth={0.8} opacity={0.6} />);
    for (let i = 0; i < 7; i++) els.push(<Circle key={"d" + i} cx={r() * 100} cy={r() * 125} r={1 + r() * 2.2} fill={p[3]} opacity={0.7} />);
    els.push(<Path key="f" d={wave(r, 100, 5)} fill={p[3]} />);
  } else {
    els.push(<Rect key="sq" x={18} y={22} width={64} height={64} rx={r() > 0.5 ? 32 : 6} fill={p[1]} />);
    els.push(<Circle key="c" cx={62} cy={40} r={22} fill={p[4]} opacity={0.92} />);
    els.push(<Rect key="bar" x={0} y={92} width={100} height={40} fill={p[2]} />);
    els.push(<Rect key="bar2" x={0} y={108} width={100} height={30} fill={p[3]} />);
  }

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 100 125" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={g("bg")} x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor={p[0]} />
            <Stop offset="1" stopColor={variant === 2 || variant === 4 ? p[1] : p[0]} stopOpacity={variant === 2 || variant === 4 ? 0.55 : 1} />
          </LinearGradient>
          <RadialGradient id={g("h")}>
            <Stop offset="0" stopColor={p[4]} stopOpacity={0.55} />
            <Stop offset="1" stopColor={p[4]} stopOpacity={0} />
          </RadialGradient>
          {[0, 1, 2].map((i) => (
            <RadialGradient key={i} id={g("b" + i)}>
              <Stop offset="0" stopColor={p[(i + 1) % 5]} stopOpacity={0.95} />
              <Stop offset="1" stopColor={p[(i + 1) % 5]} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        <Rect width={100} height={125} fill={`url(#${g("bg")})`} />
        {els}
      </Svg>
    </View>
  );
}
