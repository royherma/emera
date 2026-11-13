import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Banner, Button, Field, IconButton, type PS } from "@/components/ui";
import { api } from "@/lib/api";
import { alpha, radius, space, type } from "@/lib/theme";
import { ApiError, type FlagReason } from "@/lib/types";
import { useTheme } from "@/state/theme";

const REASONS: { value: FlagReason; label: string; hint: string }[] = [
  { value: "spam", label: "Spam", hint: "Ads, repeated posts or fake engagement" },
  { value: "harassment", label: "Harassment or bullying", hint: "Targeting a person or group" },
  { value: "hate", label: "Hate", hint: "Attacks people for who they are" },
  { value: "violence", label: "Violence or threats", hint: "Graphic harm, or threats of it" },
  { value: "nudity", label: "Nudity or sexual content", hint: "Not suitable for a general audience" },
  { value: "self_harm", label: "Self-harm", hint: "Content that encourages hurting yourself" },
  { value: "impersonation", label: "Pretending to be someone", hint: "A person, brand or creator they are not" },
  { value: "scam", label: "Scam or fraud", hint: "Tries to take money or details" },
  { value: "other", label: "Something else", hint: "Tell us in a few words" },
];

export default function Flag() {
  const { type: targetType = "post", id = "", name = "" } = useLocalSearchParams<{ type: "post" | "user"; id: string; name?: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/feed"));
  const what = targetType === "user" ? (name ? `@${name}` : "this account") : "this post";

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await api.flag({ targetType, targetId: id, reason, note: note.trim() });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen maxWidth={560}>
      <View style={{ marginBottom: space[3] }}>
        <IconButton icon="back" label="Back" onPress={back} />
      </View>
      {done ? (
        <View style={{ gap: space[3], alignItems: "flex-start" }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: alpha(c.sun, 0.16), alignItems: "center", justifyContent: "center" }}>
            <Icon name="check" size={26} color={c.sunInk} strokeWidth={2.2} />
          </View>
          <Text style={[type.h1, { color: c.ink }]}>Thanks for telling us</Text>
          <Text style={[type.body, { color: c.ink2 }]}>A person on the Emera team will look at {what}. You can see the status of your reports in your account.</Text>
          <Button label="Done" onPress={back} style={{ marginTop: space[2] }} />
        </View>
      ) : (
        <View style={{ gap: space[4] }}>
          <View style={{ gap: space[2] }}>
            <Text style={[type.h1, { color: c.ink }]}>Report {what}</Text>
            <Text style={[type.body, { color: c.ink2 }]}>Pick what fits best. The person is not told who reported them.</Text>
          </View>
          <View style={{ gap: 2 }} accessibilityRole="radiogroup">
            {REASONS.map((r) => {
              const on = reason === r.value;
              return (
                <Pressable
                  key={r.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setReason(r.value)}
                  style={({ hovered }: PS) => ({ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 56, paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.field, backgroundColor: on ? alpha(c.sun, 0.14) : hovered ? c.sunk : "transparent" })}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? c.sun : c.ink3, alignItems: "center", justifyContent: "center" }}>
                    {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.sun }} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.name, { color: c.ink }]}>{r.label}</Text>
                    <Text style={[type.meta, { color: c.ink2 }]}>{r.hint}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Field label="Anything we should know" value={note} onChangeText={setNote} placeholder="Optional" maxLength={500} />
          {error && <Banner text={error} />}
          <Button label="Send report" size="lg" busy={busy} disabled={!reason} onPress={submit} />
        </View>
      )}
    </Screen>
  );
}
