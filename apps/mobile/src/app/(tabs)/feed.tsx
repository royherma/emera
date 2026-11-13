import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { GridSkeleton, Masonry } from "@/components/Grid";
import { Button, EmptyState, ErrorState, Wordmark } from "@/components/ui";
import { api } from "@/lib/api";
import { useLayout } from "@/lib/layout";
import { colors, space, type } from "@/lib/theme";
import { useResource } from "@/state/resource";
import type { Post } from "@/lib/types";

export default function Feed() {
  const router = useRouter();
  const { inner, cols, gap, wide } = useLayout();
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

  return (
    <Screen tabs onRefresh={reload} refreshing={refreshing}>
      <View style={{ paddingTop: wide ? space[2] : space[1], paddingBottom: space[5], gap: 6 }}>
        {!wide && <Wordmark size={30} />}
        <Text style={[type.h2, { color: colors.ink, marginTop: wide ? 0 : space[3] }]}>Fresh from everyone</Text>
        <Text style={[type.small, { color: colors.muted }]}>Newest first. Every post is signed by the person who made it.</Text>
      </View>
      {error && !data ? (
        <ErrorState message={error} onRetry={retry} />
      ) : loading || !data ? (
        <GridSkeleton cols={cols} gap={gap} width={inner} />
      ) : data.posts.length === 0 ? (
        <EmptyState icon="image" title="It's early, and that's the fun part" body="Be the first to share something. Your work goes here the moment you post it." action={<Button label="Post something" icon="plus" onPress={() => router.push("/upload")} />} />
      ) : (
        <>
          <Masonry posts={data.posts} cols={cols} gap={gap} width={inner} />
          {data.cursor && (
            <View style={{ alignItems: "center", marginTop: space[5] }}>
              <Button label="Show more" kind="secondary" busy={more} onPress={loadMore} />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
