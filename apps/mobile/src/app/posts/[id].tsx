import { type ComponentRef, useCallback, useEffect, useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "@/components/Screen";
import { PostRow, RowSkeleton } from "@/components/Grid";
import { ErrorState, IconButton } from "@/components/ui";
import { api } from "@/lib/api";
import { useLayout } from "@/lib/layout";
import { recallList, type ListSource } from "@/lib/postList";
import { space, type } from "@/lib/theme";
import { useTheme } from "@/state/theme";
import { ApiError, type Post } from "@/lib/types";

type List = { posts: Post[]; cursor: string | null };

async function fetchList(from: ListSource, id: string): Promise<List> {
  if (from.startsWith("@")) return api.profile(from.slice(1));
  const feed = await api.feed(null, "all");
  if (feed.posts.some((p) => p.id === id)) return feed;
  const first = await api.post(id);
  return { posts: [first, ...feed.posts.filter((p) => p.id !== id)], cursor: feed.cursor };
}

export default function PostScroll() {
  const { id, from: fromParam } = useLocalSearchParams<{ id: string; from?: string }>();
  const from = (fromParam || "explore") as ListSource;
  const router = useRouter();
  const { c } = useTheme();
  const { wide, column } = useLayout();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<List | null>(() => recallList(from, id));
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const tops = useRef<number[]>([]);
  const scrollY = useRef(0);
  const landed = useRef(false);
  const top = wide ? 24 : insets.top + 6;

  const load = useCallback(() => {
    setError(null);
    fetchList(from, id).then(setList, (e) => setError(e instanceof ApiError ? e.message : "Something went wrong. Try again."));
  }, [from, id]);

  useEffect(() => {
    if (!list) load();
  }, []);

  const loadMore = useCallback(async () => {
    if (!list?.cursor || more) return;
    setMore(true);
    try {
      const next = from.startsWith("@") ? await api.profile(from.slice(1), list.cursor) : await api.feed(list.cursor, "all");
      const seen = new Set(list.posts.map((p) => p.id));
      setList({ posts: [...list.posts, ...next.posts.filter((p) => !seen.has(p.id))], cursor: next.cursor });
    } finally {
      setMore(false);
    }
  }, [list, more, from]);

  const goTo = (i: number) => {
    const y = tops.current[i];
    if (y != null) scroll.current?.scrollTo({ y: Math.max(0, top + y - space[2]), animated: true });
  };

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, [contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const down = e.key === "ArrowDown" || e.key === "j";
      const up = e.key === "ArrowUp" || e.key === "k";
      if (e.key === "Escape") return back();
      if (!down && !up) return;
      e.preventDefault();
      const at = Math.max(0, tops.current.findLastIndex((y) => y != null && top + y <= scrollY.current + 60));
      const pastTop = scrollY.current - (top + tops.current[at]) > 20;
      goTo(Math.max(0, down ? at + 1 : pastTop ? at : at - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    scrollY.current = contentOffset.y;
    if (contentSize.height - contentOffset.y - layoutMeasurement.height < 1400) void loadMore();
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace("/explore"));
  const drop = (gone: string) => list && setList({ ...list, posts: list.posts.filter((p) => p.id !== gone) });
  const profile = from.startsWith("@");

  return (
    <Screen scrollRef={scroll} onScroll={onScroll} maxWidth={wide ? column + 64 : undefined}>
      <View style={{ width: column, alignSelf: "center", gap: space[5] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 44 }}>
          <IconButton icon="back" label="Back" onPress={back} />
          <View style={{ flex: 1 }}>
            <Text style={[type.name, { fontSize: 16, color: c.ink }]}>{profile ? "Posts" : from === "search" ? "Results" : "Explore"}</Text>
            {profile ? <Text style={[type.meta, { color: c.ink3 }]}>{from}</Text> : null}
          </View>
        </View>
        {error && !list ? (
          <ErrorState message={error} onRetry={load} />
        ) : !list ? (
          <>
            <RowSkeleton width={column} />
            <RowSkeleton width={column} />
          </>
        ) : (
          list.posts.map((p, i) => (
            <View
              key={p.id}
              onLayout={(e) => {
                tops.current[i] = e.nativeEvent.layout.y;
                if (p.id === id && !landed.current) {
                  landed.current = true;
                  const y = e.nativeEvent.layout.y;
                  requestAnimationFrame(() => scroll.current?.scrollTo({ y: i === 0 ? 0 : top + y - space[2], animated: false }));
                }
              }}
            >
              <PostRow post={p} width={column} onDeleted={drop} />
            </View>
          ))
        )}
        {more ? <RowSkeleton width={column} /> : null}
      </View>
    </Screen>
  );
}
