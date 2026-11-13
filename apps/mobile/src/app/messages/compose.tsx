import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WhoAvatar } from "@/components/ChatRoom";
import { Screen } from "@/components/Screen";
import { IconButton, type PS } from "@/components/ui";
import { api } from "@/lib/api";
import { radius, space, type } from "@/lib/theme";
import { ApiError, type ChatUser } from "@/lib/types";
import { useTheme } from "@/state/theme";
import { useToast } from "@/state/toast";

export default function Compose() {
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<ChatUser[]>([]);
  const [recent, setRecent] = useState<ChatUser[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/messages"));

  useEffect(() => {
    api.threads("inbox").then((ts) => setRecent(ts.map((t) => t.with)), () => {});
  }, []);

  useEffect(() => {
    const term = q.trim().replace(/^@/, "");
    if (!term) return setPeople([]);
    let alive = true;
    const t = setTimeout(() => {
      api.search(term, "people").then((r) => alive && setPeople(r.users.map((u) => ({ id: u.id, handle: u.handle, displayName: u.displayName, avatarUrl: u.avatarUrl }))), () => {});
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const pick = async (u: ChatUser) => {
    if (!u.handle || busy) return;
    setBusy(u.id);
    try {
      const w = await api.dmWith(u.handle);
      if (!w.canMessage) {
        toast(w.reason ?? "You can't message this account.");
        return;
      }
      if (postId) {
        const thread = w.thread ? (await api.sendMessage({ kind: "dm", id: w.thread.id }, "", postId), w.thread) : (await api.startThread(u.handle, "", postId)).thread;
        toast(`Sent to @${u.handle}`);
        router.replace({ pathname: "/messages/[id]", params: { id: thread.id } });
      } else if (w.thread) router.replace({ pathname: "/messages/[id]", params: { id: w.thread.id } });
      else router.replace({ pathname: "/messages/[id]", params: { id: "new", handle: u.handle } });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const list = q.trim() ? people : recent;
  return (
    <Screen maxWidth={640}>
      <View style={{ gap: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <IconButton icon="back" label="Back" onPress={back} />
          <Text style={[type.h2, { color: c.ink }]}>{postId ? "Send to" : "New message"}</Text>
        </View>
        <TextInput
          autoFocus
          value={q}
          onChangeText={setQ}
          placeholder="Search people"
          placeholderTextColor={c.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search people"
          style={[type.body, { height: 44, paddingHorizontal: 14, borderRadius: radius.field, backgroundColor: c.sunk, color: c.ink, outlineStyle: "none" } as object]}
        />
        {!q.trim() && recent.length > 0 && <Text style={[type.meta, { color: c.ink3 }]}>Recent</Text>}
        <View>
          {list.map((u) => (
            <Pressable
              key={u.id}
              accessibilityRole="button"
              accessibilityLabel={`${postId ? "Send to" : "Message"} @${u.handle}`}
              onPress={() => pick(u)}
              style={({ hovered }: PS) => ({ flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2], paddingHorizontal: space[3], borderRadius: radius.field, backgroundColor: hovered ? c.sunk : "transparent" })}
            >
              <WhoAvatar user={u} size={44} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[type.name, { color: c.ink }]}>{u.displayName || u.handle}</Text>
                <Text numberOfLines={1} style={[type.meta, { color: c.ink3 }]}>@{u.handle}</Text>
              </View>
              {busy === u.id && <ActivityIndicator color={c.ink3} />}
            </Pressable>
          ))}
          {q.trim() !== "" && people.length === 0 && <Text style={[type.bodySm, { color: c.ink3, padding: space[3] }]}>No one found</Text>}
        </View>
      </View>
    </Screen>
  );
}
