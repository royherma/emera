import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { WhoAvatar } from "@/components/ChatRoom";
import { UnreadDot } from "@/components/Engage";
import { Screen } from "@/components/Screen";
import { Chip, EmptyState, ErrorState, IconButton, Pulse, Segmented, type PS } from "@/components/ui";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useLayout } from "@/lib/layout";
import { font, radius, space, type } from "@/lib/theme";
import type { DmThread } from "@/lib/types";
import { useRefreshDmUnread, useDmUnread } from "@/state/dmUnread";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";

type Box = "inbox" | "requests";

function Row({ t, onPress }: { t: DmThread; onPress: () => void }) {
  const { c } = useTheme();
  const preview = !t.last ? "" : t.last.deleted ? "message deleted" : `${t.last.mine ? "You: " : ""}${t.last.body}`;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ hovered }: PS) => ({ flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[3], paddingHorizontal: space[3], borderRadius: radius.field, backgroundColor: hovered ? c.sunk : "transparent" })}>
      <WhoAvatar user={t.with} size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={[type.name, { color: c.ink }]}>{t.with.displayName || t.with.handle}</Text>
        <Text numberOfLines={1} style={[type.bodySm, { color: t.unread ? c.ink : c.ink3, fontFamily: t.unread ? font.body.semibold : font.body.regular }]}>
          {preview} · {timeAgo(t.lastAt)}
        </Text>
      </View>
      {t.unread && <UnreadDot />}
    </Pressable>
  );
}

export default function Messages() {
  const router = useRouter();
  const { c } = useTheme();
  const { wide } = useLayout();
  const [box, setBox] = useState<Box>("inbox");
  const unread = useDmUnread();
  useRefreshDmUnread(box);
  const { data, error, loading, reload, refreshing, retry } = useResource(() => api.threads(box), `threads:${box}`);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/feed"));

  return (
    <Screen maxWidth={640} onRefresh={reload} refreshing={refreshing}>
      <View style={{ gap: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          {!wide && <IconButton icon="back" label="Back" onPress={back} />}
          <Text style={[type.h2, { color: c.ink }]}>Messages</Text>
        </View>
        {!wide && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {["lobby", "feedback", "news"].map((id) => (
              <Chip key={id} label={`#${id}`} onPress={() => router.push({ pathname: "/chat", params: { c: id } })} />
            ))}
          </View>
        )}
        <Segmented
          value={box}
          onChange={setBox}
          options={[
            { value: "inbox", label: "Inbox" },
            { value: "requests", label: unread.requests ? `Requests (${unread.requests})` : "Requests" },
          ]}
        />
        {error && !data ? (
          <ErrorState message={error} onRetry={retry} />
        ) : loading || !data ? (
          <View style={{ gap: space[3] }}>
            <Pulse style={{ height: 64, borderRadius: radius.field }} />
            <Pulse style={{ height: 64, borderRadius: radius.field }} />
          </View>
        ) : data.length === 0 ? (
          box === "inbox" ? (
            <EmptyState icon="chat" title="No messages yet" body="Open anyone's profile and tap Message to start a conversation." />
          ) : (
            <EmptyState icon="shield" title="No requests" body="Messages from people you don't follow wait here until you accept them." />
          )
        ) : (
          <View>
            {data.map((t) => (
              <Row key={t.id} t={t} onPress={() => router.push({ pathname: "/messages/[id]", params: { id: t.id } })} />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}
