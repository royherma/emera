import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AuthShell } from "@/components/AuthShell";
import { Banner, Button, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { MOCK } from "@/lib/config";
import { MOCK_INVITE_CODE } from "@/lib/mock";
import { space, type } from "@/lib/theme";
import { useTheme } from "@/state/theme";
import { ApiError } from "@/lib/types";

export default function SignIn() {
  const { invite: linkInvite = "", email: linkEmail = "" } = useLocalSearchParams<{ invite?: string; email?: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const [email, setEmail] = useState(linkEmail);
  const [invite, setInvite] = useState(linkInvite);
  const [needsInvite, setNeedsInvite] = useState(!!linkInvite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const clean = email.trim().toLowerCase();
    setBusy(true);
    setError(null);
    try {
      const code = invite.trim();
      await api.authStart(clean, code || undefined);
      router.push({ pathname: "/code", params: code ? { email: clean, invite: code } : { email: clean } });
    } catch (e) {
      if (e instanceof ApiError && /^invite_/.test(e.code)) setNeedsInvite(true);
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome in" lead="Enter your email and we'll send you a 6-digit code. No password to remember.">
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" autoFocus onSubmitEditing={submit} error={needsInvite ? null : error} />
      {needsInvite && (
        <View style={{ gap: space[2] }}>
          <Field label="Invite code" value={invite} onChangeText={(t) => setInvite(t.trim())} placeholder="Paste your code" autoCapitalize="none" autoCorrect={false} error={error} onSubmitEditing={submit} />
          {MOCK && <Text style={[type.meta, { color: c.ink3 }]}>Preview mode: use {MOCK_INVITE_CODE}</Text>}
        </View>
      )}
      <Button label="Send my code" size="lg" busy={busy} disabled={!email.includes("@")} onPress={submit} />
      {MOCK && <Text style={[type.meta, { color: c.ink3, textAlign: "center" }]}>Preview mode: no email is sent. Any 6 digits will work.</Text>}
    </AuthShell>
  );
}
