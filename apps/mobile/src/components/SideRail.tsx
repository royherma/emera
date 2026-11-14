import { Pressable, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Icon, type IconName } from "./Icon";
import { Avatar } from "./Avatar";
import { UnreadDot } from "./Engage";
import { Segmented, Wordmark, sunGradient, type PS } from "./ui";
import { radius, space, type } from "@/lib/theme";
import { SIDEBAR } from "@/lib/layout";
import { useAuth } from "@/state/auth";
import { useTheme } from "@/state/theme";
import { useRefreshUnread, useUnread } from "@/state/unread";
import { useDmUnread, useRefreshDmUnread } from "@/state/dmUnread";

const items: { name: string; label: string; icon: IconName }[] = [
  { name: "feed", label: "Home", icon: "home" },
  { name: "explore", label: "Explore", icon: "compass" },
  { name: "watch", label: "Watch", icon: "play" },
  { name: "upload", label: "Post", icon: "plus" },
  { name: "me", label: "Profile", icon: "user" },
];

export function SideRail() {
  const router = useRouter();
  const path = usePathname();
  const { user } = useAuth();
  const { c, mode, setMode } = useTheme();
  const active = path.split("/")[1] ?? "";
  const unread = useUnread();
  useRefreshUnread(active);
  const dm = useDmUnread();
  useRefreshDmUnread(active);
  const dmCount = dm.inbox + dm.requests;
  return (
    <View
      style={{
        width: SIDEBAR,
        height: "100%",
        backgroundColor: c.bg,
        borderRightWidth: 1,
        borderRightColor: c.hair,
        paddingHorizontal: 16,
        paddingTop: 28,
        paddingBottom: 20,
        gap: 4,
      }}
    >
      <View style={{ paddingHorizontal: 12, paddingBottom: 24 }}>
        <Wordmark size={26} />
      </View>
      {items.map((it) => {
        const on = active === it.name;
        const isPost = it.name === "upload";
        return (
          <Pressable
            key={it.name}
            accessibilityRole="button"
            onPress={() => router.navigate(`/${it.name}` as never)}
            style={({ hovered }: PS) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              height: 48,
              paddingHorizontal: 12,
              borderRadius: radius.field,
              backgroundColor: on || hovered ? c.sunk : "transparent",
            })}
          >
            {isPost ? (
              <LinearGradient
                colors={sunGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="plus" size={16} color={c.onSun} strokeWidth={2.6} />
              </LinearGradient>
            ) : it.name === "me" && user ? (
              <Avatar user={user} size={26} />
            ) : (
              <Icon
                name={it.icon}
                size={24}
                color={on ? c.ink : c.ink2}
                strokeWidth={on ? 2 : 1.7}
              />
            )}
            <Text
              style={[type.title, { fontSize: 15, color: on ? c.ink : c.ink2 }]}
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          unread ? `Notifications, ${unread} unread` : "Notifications"
        }
        onPress={() => router.push("/notifications")}
        style={({ hovered }: PS) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          height: 48,
          paddingHorizontal: 12,
          borderRadius: radius.field,
          backgroundColor: hovered ? c.sunk : "transparent",
        })}
      >
        <View>
          <Icon name="bell" size={24} color={c.ink2} />
          {unread > 0 && (
            <View style={{ position: "absolute", top: -2, right: -3 }}>
              <UnreadDot />
            </View>
          )}
        </View>
        <Text style={[type.title, { fontSize: 15, color: c.ink2 }]}>
          Notifications
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dmCount ? `Messages, ${dmCount} unread` : "Messages"}
        onPress={() => router.push("/messages")}
        style={({ hovered }: PS) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          height: 48,
          paddingHorizontal: 12,
          borderRadius: radius.field,
          backgroundColor: active === "messages" || hovered ? c.sunk : "transparent",
        })}
      >
        <View>
          <Icon name="chat" size={24} color={active === "messages" ? c.ink : c.ink2} strokeWidth={active === "messages" ? 2 : 1.7} />
          {dmCount > 0 && (
            <View style={{ position: "absolute", top: -2, right: -3 }}>
              <UnreadDot />
            </View>
          )}
        </View>
        <Text style={[type.title, { fontSize: 15, color: active === "messages" ? c.ink : c.ink2 }]}>
          Messages
        </Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/settings")}
        style={({ hovered }: PS) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          height: 44,
          paddingHorizontal: 12,
          borderRadius: radius.field,
          backgroundColor: hovered ? c.sunk : "transparent",
          marginBottom: space[2],
        })}
      >
        <Icon name="sliders" size={22} color={c.ink2} />
        <Text style={[type.title, { fontSize: 15, color: c.ink2 }]}>
          Settings
        </Text>
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
