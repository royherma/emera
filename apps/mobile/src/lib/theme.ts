import brand from "./brand";

const toRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgba = (h: string, a: number) => `rgba(${toRgb(h).join(",")},${a})`;
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [toRgb(a), toRgb(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
};

const { bg, ink, accent, accent2 } = brand.colors;

export const colors = {
  bg,
  ink,
  accent,
  accent2,
  surface: mix(bg, "#ffffff", 0.6),
  sunk: mix(bg, ink, 0.05),
  line: rgba(ink, 0.11),
  lineStrong: rgba(ink, 0.22),
  muted: rgba(ink, 0.64),
  faint: rgba(ink, 0.42),
  onInk: bg,
  accentSoft: rgba(accent, 0.12),
  accent2Soft: rgba(accent2, 0.13),
  scrim: rgba(ink, 0.55),
  white: "#ffffff",
  danger: "#b3261e",
};

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64 } as const;
export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const font = {
  display: "InstrumentSerif_400Regular",
  displayItalic: "InstrumentSerif_400Regular_Italic",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
} as const;

export const type = {
  hero: { fontFamily: font.display, fontSize: 56, lineHeight: 56, letterSpacing: -1 },
  h1: { fontFamily: font.display, fontSize: 38, lineHeight: 40, letterSpacing: -0.5 },
  h2: { fontFamily: font.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.3 },
  title: { fontFamily: font.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: "uppercase" as const },
} as const;
