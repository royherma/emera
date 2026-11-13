import { Text, View } from "react-native";
import { IconButton } from "./ui";
import { usePathname } from "expo-router";
import { ChannelsPanel } from "./ChannelsPanel";
import { CHAT_RAIL } from "@/lib/layout";
import { space, type } from "@/lib/theme";
import { saveChatSettings, useChatSettings } from "@/state/chatSettings";
import { useTheme } from "@/state/theme";
import { useToast } from "@/state/toast";

export function ChatRail() {
  const { c } = useTheme();
  const path = usePathname();
  const toast = useToast();
  const { channelsHidden } = useChatSettings();
  if (channelsHidden || path.startsWith("/messages") || path.startsWith("/chat")) return null;
  const hide = () =>
    saveChatSettings({ channelsHidden: true }).then(
      () => toast("Channels hidden. Turn them back on in Settings."),
      () => toast("Couldn't hide channels. Try again."),
    );
  return (
    <View style={{ width: CHAT_RAIL, height: "100%", borderLeftWidth: 1, borderLeftColor: c.hair, backgroundColor: c.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: space[4], paddingRight: space[2], paddingTop: 18 }}>
        <Text style={[type.title, { color: c.ink }]}>Channels</Text>
        <IconButton icon="x" label="Hide channels" onPress={hide} />
      </View>
      <ChannelsPanel />
    </View>
  );
}
