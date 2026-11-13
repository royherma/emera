import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { EngageBar } from "@/components/Engage";
import { FeedEnd } from "@/components/FeedEnd";
import { Icon } from "@/components/Icon";
import { IndexChip, MediaFull, SignedMark } from "@/components/Media";
import { Screen } from "@/components/Screen";
import { SnapItem } from "@/components/Snap";
import { Thread } from "@/components/Thread";
import { CategoryTag, ErrorState, IconButton, Pulse, sunGradient } from "@/components/ui";
import { usePostMenu } from "@/components/postMenu";
import { api } from "@/lib/api";
import { fullDate, shortHash, timeAgo } from "@/lib/format";
import { useLayout } from "@/lib/layout";
import { FULL, aspect, fitBox } from "@/lib/mediaBox";
import { pageOf, recallList, type ListSource } from "@/lib/postList";
import { alpha, creatorColors, elevation, radius, space, type } from "@/lib/theme";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";
import { RoleBadge } from "@/components/RoleBadge";
import type { Post } from "@/lib/types";

const BACK_GUTTER = 60;

type Next = { posts: Post[]; cursor: string | null };

function startAfter(from: ListSource, id: string): Next | null {
  const list = recallList(from, id);
  if (!list) return null;
  return { posts: list.posts.slice(list.posts.findIndex((p) => p.id === id) + 1), cursor: list.cursor };
}

export default function PostDetail() {
  const { id, from: fromParam } = useLocalSearchParams<{ id: string; from?: string }>();
  const from = (fromParam || "feed:all") as ListSource;
  const router = useRouter();
  const { wide } = useLayout();
  const { data: post, error, retry, setData } = useResource(() => api.post(id), `post:${id}`);
  const [next, setNext] = useState<Next | null>(() => startAfter(from, id));
  const [more, setMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const busy = useRef(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/feed"));

  const fetchNext = useCallback(async (cursor: string | null, have: Post[]) => {
    if (busy.current) return;
    busy.current = true;
    setMore(true);
    setMoreError(false);
    try {
      const page = await pageOf(from, cursor);
      const seen = new Set([id, ...have.map((p) => p.id)]);
      setNext({ posts: [...have, ...page.posts.filter((p) => !seen.has(p.id))], cursor: page.cursor });
    } catch {
      setMoreError(true);
    } finally {
      busy.current = false;
      setMore(false);
    }
  }, [from, id]);

  useEffect(() => {
    if (!next) void fetchNext(null, []);
  }, []);

  const drop = (gone: string) => next && setNext({ ...next, posts: next.posts.filter((p) => p.id !== gone) });
  const replace = (p: Post) => next && setNext({ ...next, posts: next.posts.map((x) => (x.id === p.id ? p : x)) });

  return (
    <Screen snap maxWidth={wide ? 1180 : 680}>
      <SnapItem top />
      <View style={[{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: wide ? -44 : space[2], zIndex: 5, alignSelf: "flex-start" }, wide && Platform.OS === "web" ? ({ position: "sticky", top: 0 } as object) : null]}>
        <IconButton icon="back" label="Back" onPress={back} />
      </View>
      {error && !post ? (
        <ErrorState message={error} onRetry={retry} />
      ) : (
        <View style={{ gap: space[7] }}>
          <PostItem post={post ?? null} onChange={setData} onDeleted={back} />
          {post &&
            next?.posts.map((p) => (
              <SnapItem key={p.id}>
                <PostItem post={p} onChange={replace} onDeleted={drop} />
              </SnapItem>
            ))}
          {post && <FeedEnd cursor={next ? next.cursor : "start"} loading={more || !next} failed={moreError} onMore={() => next && fetchNext(next.cursor, next.posts)} onRefresh={() => fetchNext(null, [])} />}
        </View>
      )}
    </Screen>
  );
}

function PostItem({ post, onChange, onDeleted }: { post: Post | null; onChange: (p: Post) => void; onDeleted: (id: string) => void }) {
  const router = useRouter();
  const { c, scheme } = useTheme();
  const { inner, wide, height } = useLayout();
  const [index, setIndex] = useState(0);
  const pager = useRef<any>(null);
  const menu = usePostMenu(onDeleted);
  const first = post?.media[0];
  const { width: mediaW, height: mediaH } = fitBox(aspect(first, FULL), { width: wide ? inner - 360 - space[6] - BACK_GUTTER : inner, height: wide ? height - 100 : height - 200 });
  const proof = first?.proof;

  return (
    <View style={{ flexDirection: wide ? "row" : "column", gap: wide ? space[6] : space[4], alignItems: "flex-start", justifyContent: "center", paddingLeft: wide ? BACK_GUTTER : 0 }}>
      <View style={{ width: mediaW }}>
        {post ? (
          <>
            <View style={[{ width: mediaW, height: mediaH, borderRadius: radius.media, overflow: "hidden" }, Platform.OS === "web" ? ({ boxShadow: elevation.media } as object) : null]}>
              <ScrollView
                ref={pager}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={post.media.length > 1}
                onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / mediaW))}
              >
                {post.media.map((m) => (
                  <MediaFull key={m.id} media={m} style={{ width: mediaW, height: mediaH }} />
                ))}
              </ScrollView>
              <View pointerEvents="none" style={{ position: "absolute", left: 12, top: 12 }}>
                <SignedMark />
              </View>
              {post.media.length > 1 && (
                <View pointerEvents="none" style={{ position: "absolute", right: 12, top: 12 }}>
                  <IndexChip index={index + 1} total={post.media.length} />
                </View>
              )}
            </View>
            {post.media.length > 1 && (
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: space[3] }}>
                {post.media.map((m, i) => (
                  <Pressable key={m.id} accessibilityLabel={`Show item ${i + 1}`} onPress={() => (pager.current?.scrollTo({ x: i * mediaW, animated: true }), setIndex(i))} hitSlop={10}>
                    <View style={{ width: i === index ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? c.sun : c.hair }} />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : (
          <Pulse style={{ width: mediaW, height: mediaH, borderRadius: radius.media }} />
        )}
      </View>

      <View style={{ flex: wide ? undefined : 1, width: wide ? 360 : "100%", gap: space[4] }}>
        {post ? (
          <>
            <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/u/[handle]", params: { handle: post.author.handle } })} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Avatar user={post.author} size={44} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[type.name, { fontSize: 15, color: c.ink }]}>{post.author.displayName}</Text>
                  <RoleBadge role={post.author.role} />
                </View>
                <Text style={[type.meta, { color: c.ink3 }]}>@{post.author.handle} · {timeAgo(post.createdAt)}</Text>
              </View>
              <IconButton icon="dots" label="More" filled={false} tint={c.ink2} onPress={() => menu(post)} />
            </Pressable>
            {post.caption ? <Text style={[type.title, { fontFamily: type.body.fontFamily, fontSize: 17, lineHeight: 25, letterSpacing: 0, color: c.ink }]}>{post.caption}</Text> : null}
            <EngageBar post={post} />
            {post.author.category ? <CategoryTag label={post.author.category} color={creatorColors(post.author.handle).from} /> : null}
            {proof && (
              <View
                style={[
                  { flexDirection: "row", gap: space[3], alignItems: "center", borderRadius: radius.proof, padding: space[3], paddingRight: space[4], backgroundColor: scheme === "day" ? c.surface : alpha(c.sun, 0.12), borderWidth: 1, borderColor: scheme === "day" ? c.hair : alpha(c.sun, 0.2) },
                ]}
              >
                <LinearGradient colors={sunGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="shield" size={20} color={c.onSun} strokeWidth={2} />
                </LinearGradient>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={[type.name, { color: c.ink }]}>Made by {post.author.displayName}</Text>
                  <Text style={[type.meta, { color: c.ink2 }]}>Signed {fullDate(proof.signedAt)}</Text>
                  <Text style={[type.meta, { fontSize: 11, color: c.ink3 }]}>Fingerprint {shortHash(proof.sha256)}</Text>
                </View>
              </View>
            )}
            <Thread postId={post.id} inline onCount={(n) => n !== post.commentCount && onChange({ ...post, commentCount: n })} />
          </>
        ) : (
          <>
            <Pulse style={{ height: 44, width: 220 }} />
            <Pulse style={{ height: 52 }} />
            <Pulse style={{ height: 66 }} />
          </>
        )}
      </View>
    </View>
  );
}
