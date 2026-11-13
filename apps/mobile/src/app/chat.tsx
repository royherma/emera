import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChannelsPanel } from "@/components/ChannelsPanel";
import { IconButton } from "@/components/ui";
import { space, type } from "@/lib/theme";
import { useTheme } from "@/state/theme";

export default function Chat() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { c: initial } = useLocalSearchParams<{ c?: string }>();
  const back = () => (router.canGoBack() ? router.back() : router.replace("/feed"));
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[3], height: 52 }}>
        <IconButton icon="back" label="Back" onPress={back} />
        <Text style={[type.title, { color: c.ink }]}>Channels</Text>
      </View>
      <ChannelsPanel initial={initial} />
    </View>
  );
}
