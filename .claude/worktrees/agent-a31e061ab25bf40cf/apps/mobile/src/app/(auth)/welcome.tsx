import { useEffect } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Art } from "@/components/Art";
import { Icon, IconName } from "@/components/Icon";
import { Button, Wordmark, sunGradient } from "@/components/ui";
import brand from "@/lib/brand";
import { MOCK } from "@/lib/config";
import { alpha, radius, space, type } from "@/lib/theme";
import { useLayout } from "@/lib/layout";
import { useAuth } from "@/state/auth";
import { useTheme } from "@/state/theme";

const points: { icon: IconName; title: string; body: string }[] = [
  { icon: "shield", title: "Signed by you", body: "Every upload carries proof of who made it and when." },
  { icon: "flag", title: "Protected when copied", body: "Found your work somewhere else? Report the copy and we help file the takedown." },
];

function Collage({ size }: { size: number }) {
  const { c } = useTheme();
  const u = size / 100;
  const tile = (seed: string, w: number, h: number, left: number, top: number, rot: number) => (
    <View key={seed} style={[{ position: "absolute", left, top, width: w, height: h, borderRadius: radius.media, overflow: "hidden", transform: [{ rotate: `${rot}deg` }], borderWidth: 3, borderColor: c.bg }, { boxShadow: "0px 18px 30px -16px rgba(40,20,0,0.5)" } as object]}>
      <Art seed={seed} />
    </View>
  );
  return (
    <View style={{ width: size, height: size * 1.05 }}>
      <LinearGradient colors={sunGradient} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ position: "absolute", right: u * 2, top: u * -2, width: u * 44, height: u * 44, borderRadius: 999 }} />
      {tile("mock:art/p_101", u * 46, u * 58, u * 4, u * 14, -4)}
      {tile("mock:art/p_100", u * 42, u * 52, u * 50, u * 8, 3)}
      {tile("mock:art/p_102", u * 40, u * 48, u * 52, u * 56, -2)}
      {tile("mock:art/p_104", u * 36, u * 36, u * 12, u * 70, 5)}
    </View>
  );
}

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { wide, width } = useLayout();
  const { status } = useAuth();
  useEffect(() => {
    if (status === "needsHandle") router.replace("/handle");
  }, [status, router]);

  const copy = (
    <View style={{ gap: space[5], maxWidth: 560 }}>
      <Text style={[type.hero, wide && { fontSize: 76, lineHeight: 76, letterSpacing: -3.4 }, { color: c.ink }]}>{brand.tagline}</Text>
      <Text style={[type.body, { color: c.ink2, fontSize: wide ? 18 : 16, lineHeight: wide ? 27 : 24, maxWidth: 460 }]}>
        A home for photos, film, art, design and everything you make. Share it openly and know it is yours.
      </Text>
      <View style={{ flexDirection: wide ? "row" : "column", gap: space[3] }}>
        <Button label="Get started" size="lg" onPress={() => router.push("/sign-in")} style={wide ? { minWidth: 190 } : undefined} />
        <Button label="I have an account" size="lg" kind="secondary" onPress={() => router.push("/sign-in")} style={wide ? { minWidth: 190 } : undefined} />
      </View>
    </View>
  );

  const list = (
    <View style={{ gap: space[4] }}>
      {points.map((p) => (
        <View key={p.title} style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: alpha(c.sun, 0.16), alignItems: "center", justifyContent: "center" }}>
            <Icon name={p.icon} size={18} color={c.sunInk} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.name, { fontSize: 15, color: c.ink }]}>{p.title}</Text>
            <Text style={[type.bodySm, { color: c.ink2 }]}>{p.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ flexGrow: 1, alignItems: "center", paddingTop: insets.top + space[3], paddingBottom: insets.bottom + space[6] }}>
      <View style={{ width: "100%", maxWidth: 1180, paddingHorizontal: wide ? space[6] : space[4], flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 }}>
          <Wordmark size={wide ? 26 : 22} />
          {MOCK && (
            <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: c.sunk, justifyContent: "center" }}>
              <Text style={[type.label, { color: c.ink2 }]}>Preview mode</Text>
            </View>
          )}
        </View>
        {wide ? (
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[7], paddingVertical: space[6] }}>
            <View style={{ flex: 1, gap: space[6] }}>
              {copy}
              {list}
            </View>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Collage size={Math.min(500, width * 0.36)} />
            </View>
          </View>
        ) : (
          <View style={{ gap: space[6], paddingTop: space[4] }}>
            <View style={{ alignItems: "center" }}>
              <Collage size={Math.min(310, width - 64)} />
            </View>
            {copy}
            {list}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
