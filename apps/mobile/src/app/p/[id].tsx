import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { MediaFull } from "@/components/Media";
import { Screen } from "@/components/Screen";
import { Button, ErrorState, IconButton, Pulse } from "@/components/ui";
import { api } from "@/lib/api";
import { fullDate, shortHash, timeAgo } from "@/lib/format";
import { useLayout } from "@/lib/layout";
import { confirmAsk, shareLink } from "@/lib/share";
import { colors, font, radius, space, type } from "@/lib/theme";
import { useAuth } from "@/state/auth";
import { useResource } from "@/state/resource";
import { useToast } from "@/state/toast";

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { inner, wide } = useLayout();
  const { data: post, error, retry } = useResource(() => api.post(id), `post:${id}`);
  const [index, setIndex] = useState(0);
  const pager = useRef<any>(null);
  const [deleting, setDeleting] = useState(false);

  const mediaW = wide ? Math.min(640, Math.floor(inner * 0.6)) : inner;
  const first = post?.media[0];
  const ratio = first ? Math.min(1.25, Math.max(0.75, first.width / first.height)) : 0.9;
  const mediaH = Math.round(mediaW / ratio);
  const own = !!post && user?.id === post.author.id;

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const share = async () => {
    if (!post) return;
    const r = await shareLink(post.url, `A post by @${post.author.handle}`);
    if (r === "copied") toast("Link copied");
  };
  const remove = () =>
    confirmAsk("Delete this post?", "It will be removed for everyone. This can't be undone.", "Delete", async () => {
      setDeleting(true);
      try {
        await api.deletePost(id);
        back();
      } finally {
        setDeleting(false);
      }
    });

  const proof = first?.proof;

  return (
    <Screen maxWidth={wide ? 1180 : 680}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: space[4] }}>
        <IconButton icon="back" label="Back" onPress={back} />
        <IconButton icon="share" label="Share" onPress={share} />
      </View>
      {error && !post ? (
        <ErrorState message={error} onRetry={retry} />
      ) : (
        <View style={{ flexDirection: wide ? "row" : "column", gap: wide ? space[6] : space[4], alignItems: "flex-start" }}>
          <View style={{ width: mediaW }}>
            {post ? (
              <>
                <ScrollView
                  ref={pager}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  scrollEnabled={post.media.length > 1}
                  onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / mediaW))}
                  style={{ borderRadius: radius.lg, width: mediaW }}
                >
                  {post.media.map((m) => (
                    <MediaFull key={m.id} media={m} style={{ width: mediaW, height: mediaH }} />
                  ))}
                </ScrollView>
                {post.media.length > 1 && (
                  <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginTop: space[3] }}>
                    {post.media.map((m, i) => (
                      <Pressable key={m.id} accessibilityLabel={`Show item ${i + 1}`} onPress={() => (pager.current?.scrollTo({ x: i * mediaW, animated: true }), setIndex(i))} hitSlop={8}>
                        <View style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 99, backgroundColor: i === index ? colors.ink : colors.lineStrong }} />
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Pulse style={{ width: mediaW, height: mediaH, borderRadius: radius.lg }} />
            )}
          </View>

          <View style={{ flex: 1, width: "100%", gap: space[4] }}>
            {post ? (
              <>
                <Pressable onPress={() => router.push({ pathname: "/u/[handle]", params: { handle: post.author.handle } })} style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
                  <Avatar user={post.author} size={48} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.semibold, fontSize: 16, color: colors.ink }}>{post.author.displayName}</Text>
                    <Text style={[type.small, { color: colors.muted }]}>@{post.author.handle} · {timeAgo(post.createdAt)}</Text>
                  </View>
                </Pressable>
                {post.caption ? <Text style={[type.body, { color: colors.ink, fontSize: 18, lineHeight: 28 }]}>{post.caption}</Text> : null}
                {proof && (
                  <View style={{ borderRadius: radius.md, backgroundColor: colors.accent2Soft, padding: space[4], gap: space[2] }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Icon name="shield" size={20} color={colors.accent2} strokeWidth={2.2} />
                      <Text style={{ fontFamily: font.semibold, fontSize: 15, color: colors.accent2 }}>Signed by @{proof.signer.replace(/^@/, "")}</Text>
                    </View>
                    <Text style={[type.small, { color: colors.muted }]}>{fullDate(proof.signedAt)}</Text>
                    <Text style={[type.small, { color: colors.faint, fontFamily: font.medium }]}>Fingerprint {shortHash(proof.sha256)}</Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
                  <Button label="Share" icon="share" kind="secondary" onPress={share} />
                  {own && <Button label="Delete" icon="trash" kind="danger" busy={deleting} onPress={remove} />}
                </View>
              </>
            ) : (
              <>
                <Pulse style={{ height: 48, width: 220 }} />
                <Pulse style={{ height: 60 }} />
                <Pulse style={{ height: 96 }} />
              </>
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}
