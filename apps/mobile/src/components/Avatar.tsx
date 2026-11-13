import { Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Art } from "./Art";
import { creatorColors, font } from "@/lib/theme";
import { useTheme } from "@/state/theme";
import type { User } from "@/lib/types";

type Who = Pick<User, "handle" | "displayName" | "avatarUrl">;

export function Avatar({ user, size = 40, ring = true }: { user: Who; size?: number; ring?: boolean }) {
  const { c } = useTheme();
  const { from, to } = creatorColors(user.handle);
  const initial = (user.displayName || user.handle || "?").trim().charAt(0).toUpperCase();
  const pad = ring ? (size >= 60 ? 3 : size >= 30 ? 2.2 : 1.6) : 0;
  const gap = ring ? (size >= 60 ? 3 : 2) : 0;
  const inner = size - pad * 2 - gap * 2;
  const face = (
    <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: c.sunk }}>
      {user.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={{ width: inner, height: inner }} /> : <Art seed={`avatar:${user.handle}`} />}
      {!user.avatarUrl && <Text style={{ fontFamily: font.display.semibold, fontSize: inner * 0.46, color: "#fff", textShadowColor: "rgba(0,0,0,0.3)", textShadowRadius: 4 }}>{initial}</Text>}
    </View>
  );
  if (!ring) return face;
  return (
    <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, padding: pad }}>
      <View style={{ flex: 1, borderRadius: size / 2, backgroundColor: c.bg, padding: gap, alignItems: "center", justifyContent: "center" }}>{face}</View>
    </LinearGradient>
  );
}
