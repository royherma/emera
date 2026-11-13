import { useWindowDimensions } from "react-native";
import { useChannelsHidden } from "@/state/chatSettings";

export const SIDEBAR = 240;
export const CHAT_RAIL = 340;

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const hidden = useChannelsHidden();
  const rail = width >= 1280 && !hidden;
  const content = Math.min(width - (wide ? SIDEBAR : 0) - (rail ? CHAT_RAIL : 0), 1180);
  const pad = wide ? 32 : 16;
  const inner = content - pad * 2;
  const column = wide ? 560 : inner;
  return { width, height, wide, rail, content, pad, inner, column };
}
