import { Pressable, View } from "react-native";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { useRefreshUnread } from "@/state/unread";
import { sunGradient, type PS } from "@/components/ui";
import { elevation, radius, size, space, sun, type } from "@/lib/theme";
import { useLayout } from "@/lib/layout";
import { useAuth } from "@/state/auth";
import { useTheme } from "@/state/theme";

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { wide } = useLayout();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { c, scheme } = useTheme();
  const activeName = state.routes[state.index]?.name;
  useRefreshUnread(activeName);
  const go = (name: string) => {
    const r = state.routes.find((x) => x.name === name);
    if (r) navigateToTab(r.key);
  };

  if (wide) return null;

  const tab = (name: string, icon: IconName, label: string) => {
    const active = activeName === name;
    return (
      <Pressable key={name} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={() => go(name)} style={{ width: 56, height: 50, alignItems: "center", justifyContent: "center" }}>
        {name === "me" && user ? <Avatar user={user} size={28} /> : <Icon name={icon} size={25} color={active ? c.ink : c.ink3} strokeWidth={active ? 2 : 1.7} />}
        {active && <View style={{ position: "absolute", bottom: 1, width: 5, height: 5, borderRadius: 3, backgroundColor: sun.sun }} />}
      </Pressable>
    );
  };

  return (
    <View
      style={[
        { position: "absolute", left: 14, right: 14, bottom: Math.max(insets.bottom, 10) + 6, height: size.tabBar, borderRadius: radius.tab, backgroundColor: c.tab, borderWidth: 1, borderColor: c.hair, flexDirection: "row", alignItems: "center", paddingHorizontal: 6 },
        { boxShadow: scheme === "day" ? elevation.tab.day : elevation.tab.night } as object,
      ]}
    >
      <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-around" }}>
        {tab("feed", "home", "Home")}
        {tab("explore", "compass", "Explore")}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Post" onPress={() => go("upload")} style={({ pressed }: PS) => ({ transform: [{ scale: pressed ? 0.95 : 1 }], marginHorizontal: 6 })}>
        <LinearGradient colors={sunGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" }, { boxShadow: elevation.sun } as object]}>
          <Icon name="plus" size={24} color={c.onSun} strokeWidth={2.4} />
        </LinearGradient>
      </Pressable>
      <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-around" }}>
        {tab("watch", "play", "Watch")}
        {tab("me", "user", "Profile")}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { wide } = useLayout();
  const { c } = useTheme();
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, tabBarPosition: wide ? "left" : "bottom", sceneStyle: { backgroundColor: c.bg } }}>
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="upload" />
      <Tabs.Screen name="watch" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
