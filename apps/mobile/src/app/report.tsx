import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Banner, Button, Field, IconButton } from "@/components/ui";
import { api } from "@/lib/api";
import { alpha, radius, space, type } from "@/lib/theme";
import { ApiError, TakedownPreview } from "@/lib/types";
import { useTheme } from "@/state/theme";

function Confirm({ reportId, onDone, onSkip }: { reportId: string; onDone: () => void; onSkip: () => void }) {
  const { c } = useTheme();
  const [preview, setPreview] = useState<TakedownPreview | null>(null);
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.takedownPreview(reportId).then(setPreview, (e) => setError(e instanceof ApiError ? e.message : "Couldn't load this. Try again."));
  }, [reportId]);

  const need = preview?.authorization.required ?? false;
  const ready = !!preview && (!need || (agree && name.trim().includes(" ")));

  const send = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await api.confirmTakedown(reportId, need ? { name: name.trim(), agree: true, version: preview.authorization.version } : undefined);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space[4] }}>
      <View style={{ gap: space[2] }}>
        <Text style={[type.h1, { color: c.ink }]}>Send this takedown</Text>
        <Text style={[type.body, { color: c.ink2 }]}>
          {preview ? `We file a copyright notice with ${preview.recipient.site}${preview.recipient.method === "email" ? " by email" : " through their report form"}. A person at Emera checks it first.` : "Getting your notice ready"}
        </Text>
      </View>
      {preview && (
        <>
          <Pressable accessibilityRole="button" onPress={() => setShowNotice((v) => !v)}>
            <Text style={[type.bodySm, { color: c.sunInk }]}>{showNotice ? "Hide the notice" : "Read the notice"}</Text>
          </Pressable>
          {showNotice && (
            <View style={{ backgroundColor: c.sunk, borderRadius: radius.card, padding: space[3] }}>
              <Text selectable style={[type.meta, { color: c.ink2 }]}>{preview.notice}</Text>
            </View>
          )}
          {need && (
            <View style={{ gap: space[3] }}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agree }} onPress={() => setAgree((v) => !v)} style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
                <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: agree ? c.sun : c.ink3, backgroundColor: agree ? c.sun : "transparent", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                  {agree && <Icon name="check" size={16} color={c.bg} strokeWidth={2.4} />}
                </View>
                <View style={{ flex: 1, gap: space[1] }}>
                  {preview.authorization.text.split("\n").map((line) => (
                    <Text key={line} style={[type.bodySm, { color: c.ink }]}>{line}</Text>
                  ))}
                </View>
              </Pressable>
              <Field label="Sign with your full name" value={name} onChangeText={setName} placeholder="First and last name" autoCapitalize="words" autoCorrect={false} />
            </View>
          )}
        </>
      )}
      {error && <Banner text={error} />}
      <Button label="Send for review" size="lg" busy={busy} disabled={!ready} onPress={send} />
      <Button label="Not now" kind="secondary" onPress={onSkip} />
    </View>
  );
}

export default function Report() {
  const { id = "", reportId: startAt = "" } = useLocalSearchParams<{ id: string; reportId?: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [reportId, setReportId] = useState(startAt);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/feed"));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.report({ postId: id, url: url.trim(), note: note.trim() });
      setReportId(r.id);
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
          <Text style={[type.h1, { color: c.ink }]}>Takedown queued</Text>
          <Text style={[type.body, { color: c.ink2 }]}>We check the notice, send it, and keep looking at the page until it is gone. Follow it in Protect.</Text>
          <Button label="Done" onPress={back} style={{ marginTop: space[2] }} />
        </View>
      ) : reportId ? (
        <Confirm reportId={reportId} onDone={() => setDone(true)} onSkip={back} />
      ) : (
        <View style={{ gap: space[4] }}>
          <View style={{ gap: space[2] }}>
            <Text style={[type.h1, { color: c.ink }]}>Report a copy</Text>
            <Text style={[type.body, { color: c.ink2 }]}>Found this work somewhere else without your name on it? Paste the link and we will help you file the takedown.</Text>
          </View>
          <Field label="Where the copy lives" value={url} onChangeText={setUrl} placeholder="https://" autoCapitalize="none" autoCorrect={false} keyboardType="url" autoFocus />
          <Field label="Anything we should know" value={note} onChangeText={setNote} placeholder="Optional" maxLength={500} />
          {error && <Banner text={error} />}
          <Button label="Continue" size="lg" busy={busy} disabled={!url.trim()} onPress={submit} />
        </View>
      )}
    </Screen>
  );
}
