import { useWindowDimensions } from "react-native";

export const SIDEBAR = 240;

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const content = Math.min(width - (wide ? SIDEBAR : 0), 1180);
  const pad = wide ? 32 : 16;
  const inner = content - pad * 2;
  const cols = inner < 520 ? 2 : inner < 800 ? 3 : inner < 1050 ? 4 : 5;
  const gap = wide ? 16 : 10;
  return { width, height, wide, content, pad, inner, cols, gap };
}
