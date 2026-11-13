import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEMO } from "@/lib/config";
import { font, sun } from "@/lib/theme";

function exitDemo() {
  const url = new URL(window.location.href);
  url.searchParams.set("demo", "0");
  window.location.replace(url.toString());
}

export function DemoBadge() {
  const insets = useSafeAreaInsets();
  if (!DEMO) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 6, left: 0, right: 0, alignItems: "center", zIndex: 1000 }}>
      <Pressable
        onPress={exitDemo}
        accessibilityRole="button"
        accessibilityLabel="Demo data. Tap to leave demo"
        style={{ flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: sun.sun, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}
      >
        <Text style={{ fontFamily: font.body.semibold, fontSize: 11, color: sun.onSun }}>Demo data</Text>
        <Text style={{ fontFamily: font.body.regular, fontSize: 11, color: sun.onSun, opacity: 0.75 }}>Leave</Text>
      </Pressable>
    </View>
  );
}
