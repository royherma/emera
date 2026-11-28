import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AuthShell } from "@/components/AuthShell";
import { Banner, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/types";
import { safeNext } from "@/lib/next";
import { pendingSignup } from "@/lib/signup";
import { space, type } from "@/lib/theme";
import { useAuth } from "@/state/auth";
import { useTheme } from "@/state/theme";

export default function ProtectStep() {
  const { finishHandle } = useAuth();
  const router = useRouter();
  const { c } = useTheme();
  const next = safeNext(useLocalSearchParams<{ next?: string }>().next);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    const user = pendingSignup.user;
    pendingSignup.user = null;
    if (user) finishHandle(user);
    router.replace((next ?? "/feed") as never);
  };

  const turnOn = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.protectOptIn();
      done();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Protect what you make" lead="We check your 10 newest posts every month and take copies down for you. Free. Turn it off any time." back={false}>
      {error && <Banner text={error} />}
      <Button label="Turn on free protection" size="lg" busy={busy} onPress={turnOn} />
      <Pressable accessibilityRole="button" onPress={done} disabled={busy} style={{ alignSelf: "center", paddingVertical: space[2] }}>
        <Text style={[type.bodySm, { color: c.ink2 }]}>Not now</Text>
      </Pressable>
    </AuthShell>
  );
}
