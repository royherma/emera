import { useEffect } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Art } from "@/components/Art";
import { Icon, IconName } from "@/components/Icon";
import { Button, Wordmark } from "@/components/ui";
import brand from "@/lib/brand";
import { MOCK } from "@/lib/config";
import { colors, font, radius, space, type } from "@/lib/theme";
import { useLayout } from "@/lib/layout";
import { useAuth } from "@/state/auth";

const points: { icon: IconName; title: string; body: string }[] = [
  { icon: "shield", title: "Signed by you", body: "Every upload carries proof of who made it and when." },
  { icon: "user", title: "Real people only", body: "No bots, no bought reach. Your feed is in the order it was posted." },
  { icon: "sun", title: "Yours to keep", body: "Built to spot copies and protect the original." },
];

function Collage({ size }: { size: number }) {
  const tile = (seed: string, w: number, h: number, left: number, top: number, rot: number) => (
    <View key={seed} style={{ position: "absolute", left, top, width: w, height: h, borderRadius: radius.lg, overflow: "hidden", transform: [{ rotate: `${rot}deg` }], shadowColor: colors.ink, shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } }}>
      <Art seed={seed} />
    </View>
  );
  const u = size / 100;
  return (
    <View style={{ width: size, height: size * 1.05 }}>
      <View style={{ position: "absolute", right: u * 6, top: u * 2, width: u * 34, height: u * 34, borderRadius: 99, backgroundColor: colors.accent, opacity: 0.95 }} />
      {tile("mock:art/p_101", u * 46, u * 58, u * 4, u * 14, -4)}
      {tile("mock:art/p_100", u * 42, u * 52, u * 50, u * 4, 3)}
      {tile("mock:art/p_102", u * 40, u * 48, u * 52, u * 54, -2)}
      {tile("mock:art/p_104", u * 36, u * 36, u * 12, u * 70, 5)}
    </View>
  );
}

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wide, width } = useLayout();
  const { status } = useAuth();
  useEffect(() => {
    if (status === "needsHandle") router.replace("/handle");
  }, [status, router]);

  const copy = (
    <View style={{ gap: space[5], flex: wide ? 1 : undefined, maxWidth: 560 }}>
      <Text style={[type.hero, wide && { fontSize: 84, lineHeight: 82 }, { color: colors.ink }]}>
        {brand.tagline}
      </Text>
      <Text style={[type.body, { color: colors.muted, fontSize: wide ? 19 : 17, lineHeight: wide ? 28 : 25, maxWidth: 480 }]}>
        A home for photos, film, art, design and everything you make. Share it openly and know it is yours.
      </Text>
      <View style={{ flexDirection: wide ? "row" : "column", gap: space[3], marginTop: space[2] }}>
        <Button label="Get started" size="lg" onPress={() => router.push("/sign-in")} style={wide ? { minWidth: 200 } : undefined} />
        <Button label="I have an account" size="lg" kind="secondary" onPress={() => router.push("/sign-in")} style={wide ? { minWidth: 200 } : undefined} />
      </View>
    </View>
  );

  const points3 = (
    <View style={{ gap: space[4], marginTop: wide ? space[6] : space[2] }}>
      {points.map((p) => (
        <View key={p.title} style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
          <View style={{ width: 38, height: 38, borderRadius: 99, backgroundColor: colors.accent2Soft, alignItems: "center", justifyContent: "center" }}>
            <Icon name={p.icon} size={18} color={colors.accent2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 15, color: colors.ink }}>{p.title}</Text>
            <Text style={[type.small, { color: colors.muted }]}>{p.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1, alignItems: "center", paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[6] }}>
      <View style={{ width: "100%", maxWidth: 1180, paddingHorizontal: wide ? space[6] : space[4], flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 }}>
          <Wordmark size={wide ? 34 : 28} />
          {MOCK && (
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: colors.sunk }}>
              <Text style={{ fontFamily: font.medium, fontSize: 11, color: colors.muted }}>Preview mode</Text>
            </View>
          )}
        </View>
        {wide ? (
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[7], paddingVertical: space[6] }}>
            <View style={{ flex: 1, gap: space[2] }}>
              {copy}
              {points3}
            </View>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Collage size={Math.min(520, width * 0.38)} />
            </View>
          </View>
        ) : (
          <View style={{ gap: space[6], paddingTop: space[5] }}>
            <View style={{ alignItems: "center" }}>
              <Collage size={Math.min(330, width - 48)} />
            </View>
            {copy}
            {points3}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
