import { Stack } from "expo-router";
import { useTheme } from "@/state/theme";

export const unstable_settings = { anchor: "welcome" };

export default function AuthLayout() {
  const { c } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: "slide_from_right" }} />;
}
