import { Text } from "react-native";
import { font, sun } from "@/lib/theme";
import type { Role } from "@/lib/types";
import { useTheme } from "@/state/theme";

const LABEL: Record<Role, string> = { admin: "Admin", mod: "Mod", creator: "Creator" };

export function RoleBadge({ role }: { role?: Role | null }) {
  const { c } = useTheme();
  if (!role || !LABEL[role]) return null;
  const look = role === "admin" ? { backgroundColor: sun.sun, color: sun.onSun } : role === "mod" ? { backgroundColor: c.ink, color: c.bg } : { backgroundColor: c.sunk, color: c.sunInk };
  return (
    <Text accessibilityLabel={LABEL[role]} style={[{ fontFamily: font.body.semibold, fontSize: 10, lineHeight: 16, letterSpacing: 0.2, borderRadius: 999, paddingHorizontal: 6, overflow: "hidden" }, look]}>
      {LABEL[role]}
    </Text>
  );
}
