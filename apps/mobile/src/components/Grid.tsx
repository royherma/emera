import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { MediaImage } from "./Media";
import { Pulse, type PS } from "./ui";
import { colors, font, radius } from "@/lib/theme";
import { useAuth } from "@/state/auth";
import type { Post } from "@/lib/types";

export function ProofBadge({ handle, compact = false, short = false }: { handle: string; compact?: boolean; short?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.94)", paddingVertical: compact ? 3 : 5, paddingHorizontal: compact ? 7 : 10, borderRadius: radius.pill }}>
      <Icon name="shield" size={compact ? 12 : 14} color={colors.accent2} strokeWidth={2.2} />
      <Text style={{ fontFamily: font.semibold, fontSize: compact ? 11 : 12, color: colors.accent2 }}>{short ? "Signed" : `Signed by @${handle}`}</Text>
    </View>
  );
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const aspectOf = (p: Post) => clamp(p.media[0].width / p.media[0].height, 0.72, 1.3);

export function PostTile({ post, width, aspect, showAuthor = true }: { post: Post; width: number; aspect?: number; showAuthor?: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const own = user?.id === post.author.id;
  const a = aspect ?? aspectOf(post);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Post by ${post.author.displayName}`}
      onPress={() => router.push({ pathname: "/p/[id]", params: { id: post.id } })}
      style={({ hovered, pressed }: PS) => ({ width, height: width / a, borderRadius: radius.md, overflow: "hidden", transform: [{ scale: pressed ? 0.985 : hovered ? 1.012 : 1 }] })}
    >
      <MediaImage media={post.media[0]} style={{ flex: 1 }} />
      {post.media.length > 1 && (
        <View style={{ position: "absolute", top: 10, right: 10 }}>
          <Icon name="layers" size={18} color="#fff" />
        </View>
      )}
      {own && (
        <View style={{ position: "absolute", top: 8, left: 8 }}>
          <ProofBadge handle={post.author.handle} compact short={width < 190} />
        </View>
      )}
      {showAuthor && (
        <LinearGradient colors={["rgba(0,0,0,0)", "rgba(20,14,10,0.62)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 36, paddingBottom: 9, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Avatar user={post.author} size={22} />
          <Text numberOfLines={1} style={{ flex: 1, color: "#fff", fontFamily: font.medium, fontSize: 13 }}>
            @{post.author.handle}
          </Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

export function Masonry({ posts, cols, gap, width }: { posts: Post[]; cols: number; gap: number; width: number }) {
  const w = (width - gap * (cols - 1)) / cols;
  const heights = Array(cols).fill(0) as number[];
  const columns: Post[][] = Array.from({ length: cols }, () => []);
  posts.forEach((p) => {
    const i = heights.indexOf(Math.min(...heights));
    columns[i].push(p);
    heights[i] += w / aspectOf(p) + gap;
  });
  return (
    <View style={{ flexDirection: "row", gap }}>
      {columns.map((col, i) => (
        <View key={i} style={{ width: w, gap }}>
          {col.map((p) => (
            <PostTile key={p.id} post={p} width={w} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function SquareGrid({ posts, cols, gap, width }: { posts: Post[]; cols: number; gap: number; width: number }) {
  const w = Math.floor((width - gap * (cols - 1)) / cols);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
      {posts.map((p) => (
        <PostTile key={p.id} post={p} width={w} aspect={0.8} showAuthor={false} />
      ))}
    </View>
  );
}

export function GridSkeleton({ cols, gap, width }: { cols: number; gap: number; width: number }) {
  const w = (width - gap * (cols - 1)) / cols;
  const ratios = [1.25, 1, 0.8, 1.1, 0.9, 1.3];
  return (
    <View style={{ flexDirection: "row", gap }}>
      {Array.from({ length: cols }, (_, c) => (
        <View key={c} style={{ width: w, gap }}>
          {[0, 1, 2].map((r) => (
            <Pulse key={r} style={{ width: w, height: w * ratios[(c * 2 + r) % ratios.length] }} />
          ))}
        </View>
      ))}
    </View>
  );
}
