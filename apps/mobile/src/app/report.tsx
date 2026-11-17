import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { MediaImage } from "@/components/Media";
import { Screen } from "@/components/Screen";
import { Banner, Button, Field, IconButton } from "@/components/ui";
import { api } from "@/lib/api";
import { alpha, radius, space, type } from "@/lib/theme";
import { ApiError, Post } from "@/lib/types";
import { useAuth } from "@/state/auth";
import { useTheme } from "@/state/theme";

export default function Report() {
  const { id = "", url: prefill = "" } = useLocalSearchParams<{ id?: string; url?: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const { user } = useAuth();
  const [url, setUrl] = useState(prefill);
  const [picked, setPicked] = useState(id);
  const [mine, setMine] = useState<Post[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.handle) return;
    let live = true;
    api.profile(user.handle).then((r) => live && setMine(r.posts), () => live && setMine([]));
    return () => {
      live = false;
    };
  }, [user?.handle]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/feed"));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.report({ postId: picked, url: url.trim(), note: "" });
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
          <Text style={[type.h1, { color: c.ink }]}>Report sent</Text>
          <Text style={[type.body, { color: c.ink2 }]}>We will file the takedown and show every step in My reports.</Text>
          <View style={{ flexDirection: "row", gap: space[3], marginTop: space[2] }}>
            <Button label="My reports" onPress={() => router.replace("/reports")} />
            <Button label="Done" kind="secondary" onPress={back} />
          </View>
        </View>
      ) : (
        <View style={{ gap: space[5] }}>
          <Text style={[type.h1, { color: c.ink }]}>I found a copy of what I made</Text>
          <Field label="Link to the copy" value={url} onChangeText={setUrl} placeholder="https://" autoCapitalize="none" autoCorrect={false} keyboardType="url" autoFocus={!prefill} />
          <View style={{ gap: 6 }}>
            <Text style={[type.label, { color: c.ink2, textTransform: "uppercase", letterSpacing: 0.8 }]}>Which of your posts is it</Text>
            {mine && mine.length === 0 ? (
              <Text style={[type.body, { color: c.ink2 }]}>Post what you made first, then report the copy.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], paddingVertical: 4 }}>
                {(mine ?? []).map((p) => {
                  const on = p.id === picked;
                  return (
                    <Pressable key={p.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Pick post: ${p.caption.slice(0, 40)}`} onPress={() => setPicked(p.id)}>
                      <View style={{ width: 92, height: 122, borderRadius: radius.tile, overflow: "hidden", borderWidth: 3, borderColor: on ? c.sun : "transparent" }}>
                        <MediaImage media={p.media[0]} style={{ flex: 1 }} playSize={0} />
                        {on && (
                          <View style={{ position: "absolute", right: 5, bottom: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: c.sun, alignItems: "center", justifyContent: "center" }}>
                            <Icon name="check" size={14} color={c.onSun} strokeWidth={2.6} />
                          </View>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
          {error && <Banner text={error} />}
          <Button label="Send report" size="lg" busy={busy} disabled={!url.trim() || !picked} onPress={submit} />
        </View>
      )}
    </Screen>
  );
}
