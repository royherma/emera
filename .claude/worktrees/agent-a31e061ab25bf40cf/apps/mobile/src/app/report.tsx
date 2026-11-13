import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Banner, Button, Field, IconButton } from "@/components/ui";
import { api } from "@/lib/api";
import { alpha, space, type } from "@/lib/theme";
import { ApiError } from "@/lib/types";
import { useTheme } from "@/state/theme";

export default function Report() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/feed"));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.report({ postId: id, url: url.trim(), note: note.trim() });
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
          <Text style={[type.h1, { color: c.ink }]}>Report received</Text>
          <Text style={[type.body, { color: c.ink2 }]}>We will look at the copy and help you file the takedown. You will hear from us by email.</Text>
          <Button label="Done" onPress={back} style={{ marginTop: space[2] }} />
        </View>
      ) : (
        <View style={{ gap: space[4] }}>
          <View style={{ gap: space[2] }}>
            <Text style={[type.h1, { color: c.ink }]}>Report a copy</Text>
            <Text style={[type.body, { color: c.ink2 }]}>Found this work somewhere else without your name on it? Paste the link and we will help you file the takedown.</Text>
          </View>
          <Field label="Where the copy lives" value={url} onChangeText={setUrl} placeholder="https://" autoCapitalize="none" autoCorrect={false} keyboardType="url" autoFocus />
          <Field label="Anything we should know" value={note} onChangeText={setNote} placeholder="Optional" maxLength={500} />
          {error && <Banner text={error} />}
          <Button label="Send report" size="lg" busy={busy} disabled={!url.trim()} onPress={submit} />
        </View>
      )}
    </Screen>
  );
}
