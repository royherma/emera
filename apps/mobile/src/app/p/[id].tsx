import { useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { EngageBar } from "@/components/Engage";
import { Icon } from "@/components/Icon";
import { IndexChip, MediaFull, SignedMark } from "@/components/Media";
import { Screen } from "@/components/Screen";
import { Thread } from "@/components/Thread";
import { CategoryTag, ErrorState, IconButton, Pulse, sunGradient } from "@/components/ui";
import { usePostMenu } from "@/components/postMenu";
import { api } from "@/lib/api";
import { fullDate, shortHash, timeAgo } from "@/lib/format";
import { useLayout } from "@/lib/layout";
import { FULL, aspect, fitBox } from "@/lib/mediaBox";
import { alpha, creatorColors, elevation, radius, space, type } from "@/lib/theme";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c, scheme } = useTheme();
  const { inner, wide, height } = useLayout();
  const { data: post, error, retry, setData } = useResource(() => api.post(id), `post:${id}`);
  const [index, setIndex] = useState(0);
  const pager = useRef<any>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/feed"));
  const menu = usePostMenu(back);

  const first = post?.media[0];
  const { width: mediaW, height: mediaH } = fitBox(aspect(first, FULL), { width: wide ? inner - 360 - space[6] : inner, height: wide ? height - 100 : height - 200 });
  const proof = first?.proof;

  return (
    <Screen maxWidth={wide ? 1180 : 680}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space[2] }}>
        <IconButton icon="back" label="Back" onPress={back} />
        {post ? <IconButton icon="dots" label="More" onPress={() => menu(post)} /> : <View style={{ width: 44 }} />}
      </View>
      {error && !post ? (
        <ErrorState message={error} onRetry={retry} />
      ) : (
        <View style={{ flexDirection: wide ? "row" : "column", gap: wide ? space[6] : space[4], alignItems: "flex-start", justifyContent: "center" }}>
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
                    <Text style={[type.name, { fontSize: 15, color: c.ink }]}>{post.author.displayName}</Text>
                    <Text style={[type.meta, { color: c.ink3 }]}>@{post.author.handle} · {timeAgo(post.createdAt)}</Text>
                  </View>
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
                <Thread postId={post.id} inline onCount={(n) => n !== post.commentCount && setData({ ...post, commentCount: n })} />
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
      )}
    </Screen>
  );
}
