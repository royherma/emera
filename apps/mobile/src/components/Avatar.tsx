import { Text, View } from "react-native";
import { Image } from "expo-image";
import { Art } from "./Art";
import { font } from "@/lib/theme";
import type { User } from "@/lib/types";

export function Avatar({ user, size = 40 }: { user: Pick<User, "handle" | "displayName" | "avatarUrl">; size?: number }) {
  const initial = (user.displayName || user.handle || "?").trim().charAt(0).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#ddd" }}>
      {user.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={{ width: size, height: size }} /> : <Art seed={`avatar:${user.handle}`} />}
      {!user.avatarUrl && <Text style={{ fontFamily: font.display, fontSize: size * 0.5, color: "#fff", textShadowColor: "rgba(0,0,0,0.25)", textShadowRadius: 4 }}>{initial}</Text>}
    </View>
  );
}
