import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { PeopleRail, PostRow, RowSkeleton } from "@/components/Grid";
import { NotificationBell } from "@/components/Engage";
import { Icon } from "@/components/Icon";
import { Button, EmptyState, ErrorState, Wordmark } from "@/components/ui";
import { api } from "@/lib/api";
import { useLayout } from "@/lib/layout";
import { space } from "@/lib/theme";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";
import type { Post } from "@/lib/types";

export default function Feed() {
  const router = useRouter();
  const { c } = useTheme();
  const { wide, column } = useLayout();
  const { data, error, loading, refreshing, reload, retry, setData } = useResource(() => api.feed(), "feed");
  const [more, setMore] = useState(false);

  const loadMore = useCallback(async () => {
    if (!data?.cursor) return;
    setMore(true);
    try {
      const next = await api.feed(data.cursor);
      const seen = new Set(data.posts.map((p) => p.id));
      setData({ posts: [...data.posts, ...next.posts.filter((p: Post) => !seen.has(p.id))], cursor: next.cursor });
    } finally {
      setMore(false);
    }
  }, [data, setData]);

  const dropPost = (id: string) => data && setData({ ...data, posts: data.posts.filter((p) => p.id !== id) });

  return (
    <Screen tabs onRefresh={reload} refreshing={refreshing} maxWidth={wide ? column + 64 : undefined}>
      <View style={{ width: column, alignSelf: "center", gap: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
          {wide ? <View /> : <Wordmark size={22} />}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {!wide && <NotificationBell />}
            <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={() => router.push("/explore")} hitSlop={8} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Icon name="search" size={22} color={c.ink} />
            </Pressable>
          </View>
        </View>
        {error && !data ? (
          <ErrorState message={error} onRetry={retry} />
        ) : loading || !data ? (
          <View style={{ gap: space[5] }}>
            <RowSkeleton width={column} />
            <RowSkeleton width={column} />
          </View>
        ) : data.posts.length === 0 ? (
          <EmptyState icon="image" title="Your feed starts with you" body="Share the first piece. It appears here the moment you post it." action={<Button label="Post something" icon="plus" onPress={() => router.push("/upload")} />} />
        ) : (
          <>
            <PeopleRail posts={data.posts} />
            <View style={{ gap: space[5] }}>
              {data.posts.map((p) => (
                <PostRow key={p.id} post={p} width={column} onDeleted={dropPost} />
              ))}
            </View>
            {data.cursor && (
              <View style={{ alignItems: "center" }}>
                <Button label="Show more" kind="secondary" busy={more} onPress={loadMore} />
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}
