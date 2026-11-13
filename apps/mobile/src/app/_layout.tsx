import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Sora_400Regular, Sora_600SemiBold, Sora_700Bold } from "@expo-google-fonts/sora";
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/state/auth";
import { SheetProvider } from "@/state/sheet";
import { ThemeProvider, useTheme } from "@/state/theme";
import { ToastProvider } from "@/state/toast";
import { alpha, sun } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function useWebChrome() {
  const { c, scheme } = useTheme();
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const id = "emera-chrome";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = `html,body{background:${c.bg};color-scheme:${scheme === "day" ? "light" : "dark"}}::selection{background:${sun.sun};color:${sun.onSun}}:focus-visible{outline:2px solid ${sun.sun};outline-offset:2px}*{scrollbar-width:thin;scrollbar-color:${alpha(c.ink, 0.25)} transparent}`;
  }, [c, scheme]);
}

function Routes() {
  const { status } = useAuth();
  const { c, scheme } = useTheme();
  useWebChrome();
  useEffect(() => {
    if (status !== "loading") SplashScreen.hideAsync().catch(() => {});
  }, [status]);
  if (status === "loading") return null;
  return (
    <>
      <StatusBar style={scheme === "day" ? "dark" : "light"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: "fade" }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={status !== "in"}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={status === "in"}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="p/[id]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="u/[handle]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="report" options={{ animation: "slide_from_right" }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function Root() {
  const [loaded] = useFonts({ Sora_400Regular, Sora_600SemiBold, Sora_700Bold, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold });
  if (!loaded) return null;
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <ToastProvider>
            <SheetProvider>
              <Routes />
            </SheetProvider>
          </ToastProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
