import tokens from "./tokens.json";

export type Scheme = "day" | "night";
export type Mode = "day" | "night" | "auto";

const flat = (s: Scheme) => {
  const c = tokens.colors[s];
  return {
    bg: c.bg.hex,
    surface: c.surface.hex,
    sunk: c.sunk.hex,
    ink: c.ink.hex,
    ink2: c.ink2.hex,
    ink3: c.ink3.hex,
    sunInk: c.sunInk.hex,
    tab: c.tab.hex,
    scrim: c.scrim.hex,
    hair: c.hair.rgba,
    danger: c.danger.hex,
  };
};

export type Palette = ReturnType<typeof flat> & typeof sun;

export const sun = {
  sun: tokens.colors.sun.sun.hex,
  sunHigh: tokens.colors.sun.sunHigh.hex,
  onSun: tokens.colors.sun.onSun.hex,
};

export const palettes: Record<Scheme, Palette> = { day: { ...flat("day"), ...sun }, night: { ...flat("night"), ...sun } };

export const font = {
  display: tokens.font.display.weights,
  body: tokens.font.body.weights,
};

const pick = (path: string) => {
  const [group, weight] = path.split(".") as ["display" | "body", string];
  return (font[group] as Record<string, string>)[weight];
};

export const type = Object.fromEntries(
  Object.entries(tokens.type).map(([k, v]) => {
    const { font: f, size, lineHeight, ...rest } = v as { font: string; size: number; lineHeight: number; letterSpacing?: number };
    return [k, { fontFamily: pick(f), fontSize: size, lineHeight, ...rest }];
  }),
) as Record<keyof typeof tokens.type, { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing?: number }>;

export const space = tokens.space as { 1: number; 2: number; 3: number; 4: number; 5: number; 6: number; 7: number; 8: number };
export const radius = tokens.radius;
export const size = tokens.size;
export const motion = tokens.motion;
export const elevation = tokens.elevation;

export const creatorPairs = tokens.colors.creator.map((p) => [p.from.hex, p.to.hex] as const);

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function creatorColors(seed: string): { from: string; to: string } {
  const [from, to] = creatorPairs[hashString(seed) % creatorPairs.length];
  return { from, to };
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

export { tokens };
