import { useWindowDimensions } from "react-native";

export const SIDEBAR = 240;

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const content = Math.min(width - (wide ? SIDEBAR : 0), 1180);
  const pad = wide ? 32 : 16;
  const inner = content - pad * 2;
  const column = wide ? 600 : inner;
  return { width, height, wide, content, pad, inner, column };
}
