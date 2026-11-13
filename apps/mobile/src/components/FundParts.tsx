import { ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "./Icon";
import { EmptyState, IconButton, Pulse, type PS } from "./ui";
import { DEMO } from "@/lib/config";
import { useLayout } from "@/lib/layout";
import { space, type } from "@/lib/theme";
import { useTheme } from "@/state/theme";

export const tabular = { fontVariant: ["tabular-nums"] } as const;
export const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, SFMono-Regular, Menlo, monospace" });

export function Header({ title, fallback }: { title: string; fallback: string }) {
  const router = useRouter();
  const { c } = useTheme();
  const { wide } = useLayout();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[5], marginTop: DEMO && !wide ? space[5] : 0 }}>
      <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))} />
      <Text numberOfLines={1} style={[type.h1, { flex: 1, color: c.ink }]}>{title}</Text>
    </View>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space[1] }}>
      <Text style={[type.section, { color: c.ink, marginBottom: space[1] }]}>{title}</Text>
      {children}
    </View>
  );
}

const Chevron = () => {
  const { c } = useTheme();
  return (
    <View style={{ transform: [{ rotate: "180deg" }] }}>
      <Icon name="back" size={16} color={c.ink3} />
    </View>
  );
};

export function Row({ label, sub, value, onPress, left }: { label: string; sub?: string; value: string; onPress?: () => void; left?: ReactNode }) {
  const { c } = useTheme();
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 56, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.hair }}>
      {left}
      <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[type.name, { color: c.ink }]}>{label}</Text>
        {sub ? <Text numberOfLines={1} style={[type.meta, { color: c.ink2 }]}>{sub}</Text> : null}
      </View>
      <Text style={[type.name, tabular, { color: c.ink }]}>{value}</Text>
      {onPress ? <Chevron /> : null}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ hovered }: PS) => [hovered && { opacity: 0.8 }]}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ hovered }: PS) => [{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52 }, hovered && { opacity: 0.8 }]}>
      <Text style={[type.name, { color: c.ink }]}>{label}</Text>
      <Chevron />
    </Pressable>
  );
}

export function FundSkeleton() {
  return (
    <View style={{ gap: space[3] }}>
      <Pulse style={{ height: 16, width: 120 }} />
      <Pulse style={{ height: 48, width: 200 }} />
      <Pulse style={{ height: 18, width: "85%" }} />
      <Pulse style={{ height: 160, marginTop: space[5] }} />
    </View>
  );
}

export function NotHere() {
  return <EmptyState icon="sun" title="This page isn't here" body="The link may be old. Head back and carry on." />;
}
