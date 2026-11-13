import { useState } from "react";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import { AuthShell } from "@/components/AuthShell";
import { Banner, Button, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { MOCK } from "@/lib/config";
import { colors, type } from "@/lib/theme";
import { ApiError } from "@/lib/types";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const clean = email.trim().toLowerCase();
    setBusy(true);
    setError(null);
    try {
      await api.authStart(clean);
      router.push({ pathname: "/code", params: { email: clean } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome in" lead="Enter your email and we'll send you a 6-digit code. No password to remember.">
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" autoFocus onSubmitEditing={submit} error={error} />
      <Button label="Send my code" size="lg" busy={busy} disabled={!email.includes("@")} onPress={submit} />
      {MOCK && <Text style={[type.small, { color: colors.faint, textAlign: "center" }]}>Preview mode: no email is sent. Any 6 digits will work.</Text>}
    </AuthShell>
  );
}
