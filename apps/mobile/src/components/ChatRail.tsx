import { Text, View } from "react-native";
import { usePathname } from "expo-router";
import { ChannelsPanel } from "./ChannelsPanel";
import { CHAT_RAIL } from "@/lib/layout";
import { space, type } from "@/lib/theme";
import { useTheme } from "@/state/theme";

export function ChatRail() {
  const { c } = useTheme();
  const path = usePathname();
  if (path.startsWith("/messages") || path.startsWith("/chat")) return null;
  return (
    <View style={{ width: CHAT_RAIL, height: "100%", borderLeftWidth: 1, borderLeftColor: c.hair, backgroundColor: c.bg }}>
      <Text style={[type.title, { color: c.ink, paddingHorizontal: space[4], paddingTop: 28, paddingBottom: space[1] }]}>Channels</Text>
      <ChannelsPanel />
    </View>
  );
}
