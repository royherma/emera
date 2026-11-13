import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { ProfileView } from "@/components/ProfileView";
import type { PS } from "@/components/ui";
import { api } from "@/lib/api";
import { money, monthName, useFundOn } from "@/lib/fund";
import { radius, space, type } from "@/lib/theme";
import { useAuth } from "@/state/auth";
import { useTheme } from "@/state/theme";

export default function Me() {
  const { user } = useAuth();
  const router = useRouter();
  return <ProfileView handle={user?.handle ?? ""} own tabs onInvite={() => router.push("/invites")} below={<EarningsLine />} />;
}

function EarningsLine() {
  const router = useRouter();
  const { c } = useTheme();
  const on = useFundOn();
  const [line, setLine] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!on) return;
      let live = true;
      api.earnings().then((e) => live && setLine(`${money(e.thisMonth.estimateCents, true)} so far in ${monthName(e.thisMonth.month, false)}`), () => {});
      return () => void (live = false);
    }, [on]),
  );
  useEffect(() => {
    if (!on) setLine(null);
  }, [on]);
  if (!on || !line) return null;
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push("/earnings")}
      style={({ hovered, pressed }: PS) => [
        { flexDirection: "row", alignItems: "center", gap: space[3], marginTop: space[3], paddingVertical: 10, paddingHorizontal: space[3], borderRadius: radius.tile, backgroundColor: c.sunk },
        hovered && { opacity: 0.9 },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[type.name, { color: c.ink }]}>Earnings</Text>
        <Text style={[type.meta, { color: c.ink2, fontVariant: ["tabular-nums"] }]}>{line}</Text>
      </View>
      <View style={{ transform: [{ rotate: "180deg" }] }}>
        <Icon name="back" size={16} color={c.ink3} />
      </View>
    </Pressable>
  );
}
