import { Pressable, Text, View } from "react-native";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { Wordmark } from "@/components/ui";
import { colors, font, radius } from "@/lib/theme";
import { SIDEBAR, useLayout } from "@/lib/layout";
import type { PS } from "@/components/ui";
import { useAuth } from "@/state/auth";

const items: { name: string; label: string; icon: IconName }[] = [
  { name: "feed", label: "Feed", icon: "grid" },
  { name: "upload", label: "Post", icon: "plus" },
  { name: "me", label: "Profile", icon: "user" },
];

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { wide } = useLayout();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const go = (_name: string, i: number) => {
    navigateToTab(state.routes[i].key);
  };

  if (wide) {
    return (
      <View style={{ width: SIDEBAR, height: "100%", backgroundColor: colors.bg, borderRightWidth: 1, borderRightColor: colors.line, paddingHorizontal: 20, paddingTop: 32, paddingBottom: 24, gap: 6 }}>
        <View style={{ paddingHorizontal: 12, paddingBottom: 28 }}>
          <Wordmark size={34} />
        </View>
        {items.map((it, i) => {
          const active = state.index === i;
          const isPost = it.name === "upload";
          return (
            <Pressable
              key={it.name}
              onPress={() => go(it.name, i)}
              style={({ hovered }: PS) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: active ? colors.sunk : hovered ? colors.sunk : "transparent" })}
            >
              {isPost ? (
                <View style={{ width: 24, height: 24, borderRadius: 99, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="plus" size={16} color="#fff" strokeWidth={2.6} />
                </View>
              ) : it.name === "me" && user ? (
                <Avatar user={user} size={24} />
              ) : (
                <Icon name={it.icon} size={24} color={colors.ink} strokeWidth={active ? 2.2 : 1.7} />
              )}
              <Text style={{ fontFamily: active ? font.semibold : font.medium, fontSize: 16, color: colors.ink }}>{it.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 10), paddingTop: 10, backgroundColor: "rgba(246,243,236,0.96)", borderTopWidth: 1, borderTopColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "space-around" }}>
      {items.map((it, i) => {
        const active = state.index === i;
        const isPost = it.name === "upload";
        return (
          <Pressable key={it.name} accessibilityRole="button" accessibilityLabel={it.label} onPress={() => go(it.name, i)} style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}>
            {isPost ? (
              <View style={{ width: 52, height: 40, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
                <Icon name="plus" size={24} color="#fff" strokeWidth={2.6} />
              </View>
            ) : it.name === "me" && user ? (
              <View style={{ borderWidth: 2, borderColor: active ? colors.ink : "transparent", borderRadius: 99, padding: 1 }}>
                <Avatar user={user} size={28} />
              </View>
            ) : (
              <Icon name={it.icon} size={26} color={active ? colors.ink : colors.faint} strokeWidth={active ? 2.2 : 1.7} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { wide } = useLayout();
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, tabBarPosition: wide ? "left" : "bottom", sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="upload" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
