import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Art } from "@/components/Art";
import { Avatar } from "@/components/Avatar";
import { UnreadDot } from "@/components/Engage";
import { Screen } from "@/components/Screen";
import { Button, EmptyState, ErrorState, IconButton, Pulse, type PS } from "@/components/ui";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { alpha, radius, space, type } from "@/lib/theme";
import type { Notification } from "@/lib/types";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";
import { setUnread } from "@/state/unread";

type Page = { notifications: Notification[]; cursor: string | null; unread: number };

function sentence(n: Notification) {
  const who = n.actor.displayName || n.actor.handle;
  const others = n.count - 1;
  const names = others > 0 ? `${who} and ${others} ${others === 1 ? "other" : "others"}` : who;
  if (n.kind === "like") return { names, rest: "liked your post" };
  if (n.kind === "comment") return { names, rest: "commented on your post" };
  if (n.kind === "reply") return { names, rest: "replied to your comment" };
  return { names, rest: "started following you" };
}

function Thumb({ url }: { url: string }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 48, height: 48, borderRadius: radius.tile - 6, overflow: "hidden", backgroundColor: c.sunk }}>
      {url.startsWith("mock:") ? <Art seed={url} /> : <Image source={{ uri: url }} style={{ width: 48, height: 48 }} contentFit="cover" />}
    </View>
  );
}

export default function Notifications() {
  const router = useRouter();
  const { c } = useTheme();
  const { data, error, loading, refreshing, reload, retry, setData } = useResource<Page>(() => api.notifications(), "notifications");
  const [more, setMore] = useState(false);
  const marked = useRef(false);

  useEffect(() => {
    if (!data || marked.current) return;
    marked.current = true;
    if (data.unread > 0) api.markNotificationsRead().then(setUnread).catch(() => {});
  }, [data]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/feed"));

  const open = (n: Notification) => {
    if (n.kind === "follow") return router.push({ pathname: "/u/[handle]", params: { handle: n.actor.handle } });
    if (!n.postId) return;
    if (n.kind === "like") return router.push({ pathname: "/p/[id]", params: { id: n.postId } });
    router.push({ pathname: "/comments/[id]", params: { id: n.postId } });
  };

  const loadMore = async () => {
    if (!data?.cursor) return;
    setMore(true);
    try {
      const next = await api.notifications(data.cursor);
      const seen = new Set(data.notifications.map((x) => x.id));
      setData({ ...next, notifications: [...data.notifications, ...next.notifications.filter((x) => !seen.has(x.id))] });
    } finally {
      setMore(false);
    }
  };

  return (
    <Screen maxWidth={680} onRefresh={reload} refreshing={refreshing}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginBottom: space[3] }}>
        <IconButton icon="back" label="Back" onPress={back} />
        <Text style={[type.h2, { color: c.ink, flex: 1 }]}>Notifications</Text>
      </View>
      {error && !data ? (
        <ErrorState message={error} onRetry={retry} />
      ) : loading || !data ? (
        <View style={{ gap: space[4] }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Pulse style={{ width: 44, height: 44, borderRadius: 22 }} />
              <Pulse style={{ flex: 1, height: 14, borderRadius: 7 }} />
              <Pulse style={{ width: 48, height: 48 }} />
            </View>
          ))}
        </View>
      ) : data.notifications.length === 0 ? (
        <EmptyState icon="bell" title="Nothing yet" body="Likes, comments and new followers show up here, grouped so it stays calm." />
      ) : (
        <View style={{ gap: 2 }}>
          {data.notifications.map((n) => {
            const s = sentence(n);
            return (
              <Pressable
                key={n.id}
                accessibilityRole="link"
                accessibilityLabel={`${s.names} ${s.rest}`}
                onPress={() => open(n)}
                style={({ pressed, hovered }: PS) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: space[3], borderRadius: radius.field, backgroundColor: pressed || hovered ? c.sunk : !n.read ? alpha(c.sun, 0.1) : "transparent" })}
              >
                <View>
                  <Avatar user={n.actor} size={44} />
                  {!n.read && (
                    <View style={{ position: "absolute", top: -2, right: -2 }}>
                      <UnreadDot size={12} />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.bodySm, { color: c.ink }]}>
                    <Text style={[type.name, { color: c.ink }]}>{s.names}</Text> {s.rest}
                  </Text>
                  {n.preview ? (
                    <Text numberOfLines={2} style={[type.meta, { color: c.ink2 }]}>
                      {n.preview}
                    </Text>
                  ) : null}
                  <Text style={[type.meta, { color: c.ink3 }]}>{timeAgo(n.createdAt)}</Text>
                </View>
                {n.thumbUrl ? <Thumb url={n.thumbUrl} /> : null}
              </Pressable>
            );
          })}
          {data.cursor && (
            <View style={{ alignItems: "center", paddingTop: space[3] }}>
              <Button label="Show more" kind="secondary" busy={more} onPress={loadMore} />
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}
