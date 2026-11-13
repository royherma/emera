import { Linking, Pressable, Text, View } from "react-native";
import { font, radius, space, type } from "@/lib/theme";
import { useTheme } from "@/state/theme";
import type { Sponsor } from "@/lib/types";

export function pickSponsor(list: Sponsor[], seed: number): Sponsor | null {
  return list.length ? list[Math.floor(seed) % list.length] : null;
}

export function SponsorLine({ sponsor, card }: { sponsor: Sponsor; card?: boolean }) {
  const { c } = useTheme();
  const open = sponsor.url ? () => void Linking.openURL(sponsor.url!) : undefined;
  return (
    <Pressable
      accessibilityRole={open ? "link" : "text"}
      accessibilityLabel={`Sponsor: ${sponsor.name}${sponsor.line ? `. ${sponsor.line}` : ""}`}
      disabled={!open}
      onPress={open}
      style={[
        { flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 32 },
        card && { backgroundColor: c.sunk, borderRadius: radius.card, paddingHorizontal: space[4], paddingVertical: space[4], minHeight: 64 },
      ]}
    >
      <Text style={[type.label, { color: c.ink3 }]}>SPONSOR</Text>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={card ? 2 : 1} style={[type.bodySm, { color: c.ink2 }]}>
          <Text style={{ fontFamily: font.body.semibold, color: c.ink }}>{sponsor.name}</Text>
          {sponsor.line ? `  ${sponsor.line}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}
