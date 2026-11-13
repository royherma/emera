import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AuthShell } from "@/components/AuthShell";
import { Banner, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { colors, font, radius, space, type } from "@/lib/theme";
import { ApiError } from "@/lib/types";
import { useAuth } from "@/state/auth";

export default function Code() {
  const { email = "" } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();
  const { signIn } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const input = useRef<any>(null);

  const verify = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.authVerify(email, value);
      await signIn(r.token, r.user, r.isNew);
      if (r.isNew || !r.user.handle) router.replace("/handle");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (code.length === 6 && !busy) void verify(code);
  }, [code]);

  const resend = async () => {
    try {
      await api.authStart(email);
      setResent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't resend. Try again.");
    }
  };

  return (
    <AuthShell title="Check your email" lead={`We sent a 6-digit code to ${email}.`}>
      <Pressable onPress={() => input.current?.focus()} style={{ flexDirection: "row", gap: space[2], justifyContent: "space-between" }}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 64, borderRadius: radius.md, borderWidth: 1.5, borderColor: error ? colors.danger : i === code.length ? colors.ink : colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>{code[i] ?? ""}</Text>
          </View>
        ))}
        <TextInput
          ref={input}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          caretHidden
          style={{ position: "absolute", inset: 0, opacity: 0.01, outlineStyle: "none" } as object}
        />
      </Pressable>
      {error && <Banner text={error} />}
      <Button label={busy ? "Checking" : "Continue"} size="lg" busy={busy} disabled={code.length < 6} onPress={() => verify(code)} />
      <View style={{ alignItems: "center", gap: space[2] }}>
        <Pressable onPress={resend}>
          <Text style={[type.small, { color: colors.ink, fontFamily: font.semibold, textDecorationLine: "underline" }]}>{resent ? "Sent again" : "Send a new code"}</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}
