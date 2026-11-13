import { Pressable, Text, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { UnreadDot } from "@/components/Engage";
import { useRefreshUnread, useUnread } from "@/state/unread";
import { Segmented, Wordmark, sunGradient, type PS } from "@/components/ui";
import { elevation, radius, size, space, sun, type } from "@/lib/theme";
import { SIDEBAR, useLayout } from "@/lib/layout";
import { useAuth } from "@/state/auth";
import { useTheme } from "@/state/theme";

const items: { name: string; label: string; icon: IconName }[] = [
  { name: "feed", label: "Home", icon: "home" },
  { name: "explore", label: "Explore", icon: "compass" },
  { name: "upload", label: "Post", icon: "plus" },
  { name: "me", label: "Profile", icon: "user" },
];

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { wide } = useLayout();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { c, scheme, mode, setMode } = useTheme();
  const activeName = state.routes[state.index]?.name;
  const unread = useUnread();
  useRefreshUnread(activeName);
  const go = (name: string) => {
    const r = state.routes.find((x) => x.name === name);
    if (r) navigateToTab(r.key);
  };

  if (wide) {
    return (
      <View style={{ width: SIDEBAR, height: "100%", backgroundColor: c.bg, borderRightWidth: 1, borderRightColor: c.hair, paddingHorizontal: 16, paddingTop: 28, paddingBottom: 20, gap: 4 }}>
        <View style={{ paddingHorizontal: 12, paddingBottom: 24 }}>
          <Wordmark size={26} />
        </View>
        {items.map((it) => {
          const active = activeName === it.name;
          const isPost = it.name === "upload";
          return (
            <Pressable
              key={it.name}
              accessibilityRole="button"
              onPress={() => go(it.name)}
              style={({ hovered }: PS) => ({ flexDirection: "row", alignItems: "center", gap: 14, height: 48, paddingHorizontal: 12, borderRadius: radius.field, backgroundColor: active || hovered ? c.sunk : "transparent" })}
            >
              {isPost ? (
                <LinearGradient colors={sunGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="plus" size={16} color={c.onSun} strokeWidth={2.6} />
                </LinearGradient>
              ) : it.name === "me" && user ? (
                <Avatar user={user} size={26} />
              ) : (
                <Icon name={it.icon} size={24} color={active ? c.ink : c.ink2} strokeWidth={active ? 2 : 1.7} />
              )}
              <Text style={[type.title, { fontSize: 15, color: active ? c.ink : c.ink2 }]}>{it.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
          onPress={() => router.push("/notifications")}
          style={({ hovered }: PS) => ({ flexDirection: "row", alignItems: "center", gap: 14, height: 48, paddingHorizontal: 12, borderRadius: radius.field, backgroundColor: hovered ? c.sunk : "transparent" })}
        >
          <View>
            <Icon name="bell" size={24} color={c.ink2} />
            {unread > 0 && (
              <View style={{ position: "absolute", top: -2, right: -3 }}>
                <UnreadDot />
              </View>
            )}
          </View>
          <Text style={[type.title, { fontSize: 15, color: c.ink2 }]}>Notifications</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" onPress={() => router.push("/settings")} style={({ hovered }: PS) => ({ flexDirection: "row", alignItems: "center", gap: 14, height: 44, paddingHorizontal: 12, borderRadius: radius.field, backgroundColor: hovered ? c.sunk : "transparent", marginBottom: space[2] })}>
          <Icon name="sliders" size={22} color={c.ink2} />
          <Text style={[type.title, { fontSize: 15, color: c.ink2 }]}>Settings</Text>
        </Pressable>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "day", label: "Day", icon: "sun" },
            { value: "night", label: "Night", icon: "moon" },
            { value: "auto", label: "Auto", icon: "auto" },
          ]}
        />
      </View>
    );
  }

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
      <View style={{ flex: 1, alignItems: "center" }}>{tab("me", "user", "Profile")}</View>
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
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
