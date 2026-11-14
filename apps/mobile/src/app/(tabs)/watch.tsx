import { type ComponentRef, useCallback, useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { LikeButton, ViewCount, count } from "@/components/Engage";
import { InlineVideo } from "@/components/Media";
import { Thread } from "@/components/Thread";
import { usePostMenu } from "@/components/postMenu";
import { EmptyState, ErrorState, IconButton, Pulse, type PS } from "@/components/ui";
import { api } from "@/lib/api";
import { useLayout } from "@/lib/layout";
import { FULL, aspect, fitBox } from "@/lib/mediaBox";
import { radius, size, space, type } from "@/lib/theme";
import type { Post } from "@/lib/types";
import { useTheme } from "@/state/theme";
import { watched } from "@/state/views";

const web = Platform.OS === "web";
const PANEL = 360;
const ACTIONS = 64;

const isVideo = (p: Post) => p.media[0]?.kind === "video";

// One swipe or wheel click moves one video; the rest of that swipe's momentum is ignored.
function onePerSwipe(el: HTMLElement, step: (dir: 1 | -1) => void) {
  let acc = 0;
  let quietAt = 0;
  let locked = false;
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    const now = performance.now();
    if (locked && now - quietAt < 180) {
      quietAt = now;
      return;
    }
    if (now - quietAt > 180) acc = 0;
    locked = false;
    quietAt = now;
    acc += e.deltaY;
    if (Math.abs(acc) < 24) return;
    step(acc > 0 ? 1 : -1);
    acc = 0;
    locked = true;
  };
  el.addEventListener("wheel", onWheel, { passive: false });
  return () => el.removeEventListener("wheel", onWheel);
}

function useVideos() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const load = useCallback(async (from: string | null, have: Post[]) => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      let next = from;
      let found: Post[] = [];
      do {
        const page = await api.feed(next, "all");
        found = [...found, ...page.posts.filter(isVideo)];
        next = page.cursor ?? null;
      } while (next && found.length < 4);
      const seen = new Set(have.map((p) => p.id));
      setPosts([...have, ...found.filter((p) => !seen.has(p.id))]);
      setCursor(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Videos didn't load.");
    } finally {
      busy.current = false;
    }
  }, []);
  useEffect(() => {
    void load(null, []);
  }, [load]);
  return { posts, cursor, error, more: () => posts && cursor && load(cursor, posts), retry: () => load(null, []), setPosts };
}

function Action({ icon, label, n, onPress, light }: { icon: "chat" | "dots"; label: string; n?: number; onPress: () => void; light: boolean }) {
  const { c } = useTheme();
  const ink = light ? "#fff" : c.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={({ pressed, hovered }: PS) => ({ alignItems: "center", gap: 2, minHeight: 44, justifyContent: "center", opacity: hovered ? 0.8 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      <Icon name={icon} size={26} color={ink} />
      {n !== undefined && <Text style={[type.name, { color: light ? "#fff" : c.ink2 }]}>{count(n)}</Text>}
    </Pressable>
  );
}

function Item({ post, height, room, wide, onComments, onDeleted }: { post: Post; height: number; room: number; wide: boolean; onComments: () => void; onDeleted: (id: string) => void }) {
  const router = useRouter();
  const menu = usePostMenu(onDeleted);
  const insets = useSafeAreaInsets();
  const { width } = useLayout();
  const m = post.media[0];
  const ratio = aspect(m, FULL);
  const box = wide ? fitBox(ratio, { width: room, height: height - space[4] * 2 }) : { width, height };
  const fit = wide || ratio < 0.7 ? "cover" : "contain";
  const bottom = wide ? space[4] : size.tabBar + insets.bottom + 28;
  const actions = (
    <View style={{ gap: space[2], alignItems: "center" }}>
      <LikeButton post={post} stacked light={!wide} />
      <Action icon="chat" label={`Comments, ${post.commentCount}`} n={post.commentCount} onPress={onComments} light={!wide} />
      <ViewCount post={post} stacked light={!wide} />
      <Action icon="dots" label="More" onPress={() => menu(post)} light={!wide} />
    </View>
  );
  return (
    <View style={[{ height, flexDirection: "row", alignItems: "center", justifyContent: "center" }, web ? ({ scrollSnapAlign: "start", scrollSnapStop: "always" } as object) : null]}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[3] }}>
      <View style={{ width: box.width, height: box.height, borderRadius: wide ? radius.media : 0, overflow: "hidden", backgroundColor: "#000" }}>
        <InlineVideo media={m} style={{ width: box.width, height: box.height, backgroundColor: "#000" }} fit={fit} tapToPause onWatched={() => watched(post.id)} />
        <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.55)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 160 }} />
        <View pointerEvents="box-none" style={{ position: "absolute", left: space[4], right: wide ? 96 : 76, bottom }}>
          <Pressable accessibilityRole="link" accessibilityLabel={`${post.author.displayName}'s profile`} onPress={() => router.push({ pathname: "/u/[handle]", params: { handle: post.author.handle } })} style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
            <Avatar user={post.author} size={32} />
            <Text numberOfLines={1} style={[type.name, { color: "#fff" }]}>{post.author.handle}</Text>
          </Pressable>
          {!!post.caption && (
            <Text numberOfLines={2} style={[type.bodySm, { color: "#fff", marginTop: 6 }]}>
              {post.caption}
            </Text>
          )}
        </View>
        {!wide && <View style={{ position: "absolute", right: 8, bottom }}>{actions}</View>}
      </View>
      {wide && <View style={{ width: ACTIONS }}>{actions}</View>}
      </View>
    </View>
  );
}

function CommentsPanel({ post, height, onClose }: { post: Post; height: number; onClose: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ width: PANEL, height: height - space[4] * 2, alignSelf: "center", borderRadius: radius.media, borderWidth: 1, borderColor: c.hair, backgroundColor: c.bg, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: space[2], paddingVertical: space[2], borderBottomWidth: 1, borderBottomColor: c.hair }}>
        <IconButton icon="x" label="Close comments" filled={false} onPress={onClose} />
        <Text style={[type.name, { color: c.ink, flex: 1, textAlign: "center", marginRight: 44 }]}>Comments</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: space[4] }} keyboardShouldPersistTaps="handled">
        <Thread key={post.id} postId={post.id} />
      </ScrollView>
    </View>
  );
}

export default function Watch() {
  const router = useRouter();
  const { c } = useTheme();
  const { wide } = useLayout();
  const { posts, cursor, error, more, retry, setPosts } = useVideos();
  const [height, setHeight] = useState(0);
  const [room, setRoom] = useState(0);
  const [index, setIndex] = useState(0);
  const [comments, setComments] = useState(false);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    setHeight(Math.round(e.nativeEvent.layout.height));
    setRoom(Math.round(e.nativeEvent.layout.width) - ACTIONS - space[3] - 2 * (44 + space[4] * 2));
  };
  const go = useCallback((i: number) => scroller.current?.scrollTo({ y: i * height, animated: true }), [height]);
  const count = posts?.length ?? 0;

  useEffect(() => {
    if (count && index >= count - 2 && cursor) void more();
  }, [index, count, cursor]);

  const step = useRef<(dir: 1 | -1) => void>(() => {});
  step.current = (dir) => {
    const to = index + dir;
    if (to >= 0 && to < count) go(to);
  };
  const ready = !!posts?.length && !!height;
  useEffect(() => {
    const el = web && ready ? (scroller.current as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.() : null;
    return el ? onePerSwipe(el, (dir) => step.current(dir)) : undefined;
  }, [ready]);

  useEffect(() => {
    if (!web || !wide) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea/i.test(t.tagName)) return;
      if (e.key === "ArrowDown" && index < count - 1) (e.preventDefault(), go(index + 1));
      if (e.key === "ArrowUp" && index > 0) (e.preventDefault(), go(index - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wide, index, count, go]);

  const openComments = (p: Post) => (wide ? setComments(true) : router.push({ pathname: "/comments/[id]", params: { id: p.id } }));
  const drop = (id: string) => setPosts((list) => (list ? list.filter((p) => p.id !== id) : list));
  const current = posts?.[index];
  const bg = wide ? c.bg : "#000";

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: bg }}>
      <View style={{ flex: 1 }} onLayout={onLayout}>
        {error && !posts ? (
          <ErrorState message={error} onRetry={retry} />
        ) : !posts || !height ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Pulse style={{ width: Math.round((height || 600) * 0.5), height: Math.max(0, (height || 600) - 32), borderRadius: radius.media }} />
          </View>
        ) : posts.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", padding: space[5] }}>
            <EmptyState icon="play" title="No videos yet" body="Videos people post show up here, one at a time." />
          </View>
        ) : (
          <ScrollView
            ref={scroller}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={100}
            onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.y / height))}
            style={[{ flex: 1 }, web ? ({ scrollSnapType: "y mandatory", overscrollBehavior: "contain" } as object) : null]}
          >
            {posts.map((p) => (
              <Item key={p.id} post={p} height={height} room={room} wide={wide} onComments={() => openComments(p)} onDeleted={drop} />
            ))}
          </ScrollView>
        )}
        {wide && count > 1 && (
          <View style={{ position: "absolute", right: space[4], top: 0, bottom: 0, justifyContent: "center", gap: space[3] }}>
            {index > 0 && <IconButton icon="up" label="Previous video" onPress={() => go(index - 1)} />}
            {index < count - 1 && <IconButton icon="down" label="Next video" onPress={() => go(index + 1)} />}
          </View>
        )}
      </View>
      {wide && comments && current && (
        <View style={{ paddingRight: space[4], justifyContent: "center" }}>
          <CommentsPanel post={current} height={height} onClose={() => setComments(false)} />
        </View>
      )}
    </View>
  );
}
