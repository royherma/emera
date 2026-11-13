import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "./Avatar";
import { EngageBar } from "./Engage";
import { Icon } from "./Icon";
import { IndexChip, InlineVideo, MediaImage, SignedMark } from "./Media";
import { CategoryTag, Glass, IconButton, Pulse, type PS } from "./ui";
import { usePostMenu } from "./postMenu";
import { creatorColors, elevation, radius, space, type } from "@/lib/theme";
import { timeAgo } from "@/lib/format";
import { useTheme } from "@/state/theme";
import type { Post } from "@/lib/types";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const web = typeof document !== "undefined";

export function PostRow({ post, width, onDeleted }: { post: Post; width: number; onDeleted?: (id: string) => void }) {
  const router = useRouter();
  const { c } = useTheme();
  const menu = usePostMenu(onDeleted);
  const m = post.media[0];
  const h = Math.round(width / clamp(m.width && m.height ? m.width / m.height : 0.8, 0.8, 1.91));
  const open = () => router.push({ pathname: "/p/[id]", params: { id: post.id } });
  const tag = post.author.category;
  return (
    <View style={{ width, gap: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
        <Pressable accessibilityRole="link" accessibilityLabel={`${post.author.displayName}'s profile`} onPress={() => router.push({ pathname: "/u/[handle]", params: { handle: post.author.handle } })} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar user={post.author} size={38} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[type.name, { color: c.ink }]}>{post.author.displayName}</Text>
            <Text numberOfLines={1} style={[type.meta, { color: c.ink3 }]}>@{post.author.handle} · {timeAgo(post.createdAt)}</Text>
          </View>
        </Pressable>
        <IconButton icon="dots" label="More" filled={false} tint={c.ink2} onPress={() => menu(post)} />
      </View>
      <Pressable accessibilityRole="link" accessibilityLabel={`Open post by ${post.author.displayName}`} onPress={open} style={({ pressed }: PS) => [{ width, height: h, borderRadius: radius.media, overflow: "hidden", transform: [{ scale: pressed ? 0.992 : 1 }] }, web ? ({ boxShadow: elevation.media } as object) : null]}>
        {m.kind === "video" ? <InlineVideo media={m} style={{ flex: 1 }} /> : <MediaImage media={m} style={{ flex: 1 }} playSize={56} />}
        <View style={{ position: "absolute", left: 10, top: 10 }}>
          <SignedMark />
        </View>
        {post.media.length > 1 && (
          <View style={{ position: "absolute", right: 10, top: 10 }}>
            <IndexChip index={1} total={post.media.length} />
          </View>
        )}
      </Pressable>
      <EngageBar post={post} />
      <Pressable onPress={open} style={{ gap: 8, paddingHorizontal: 2 }}>
        {post.caption ? (
          <Text numberOfLines={2} style={[type.bodySm, { color: c.ink }]}>
            <Text style={{ fontFamily: type.name.fontFamily }}>{post.author.handle} </Text>
            {post.caption}
          </Text>
        ) : null}
        {tag ? <CategoryTag label={tag} color={creatorColors(post.author.handle).from} /> : null}
      </Pressable>
    </View>
  );
}

export function PostTile({ post, w, h, radiusPx = radius.tile }: { post: Post; w: number; h: number; radiusPx?: number }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Post by ${post.author.displayName}`}
      onPress={() => router.push({ pathname: "/p/[id]", params: { id: post.id } })}
      style={({ hovered, pressed }: PS) => ({ width: w, height: h, borderRadius: radiusPx, overflow: "hidden", transform: [{ scale: pressed ? 0.98 : hovered ? 1.01 : 1 }] })}
    >
      <MediaImage media={post.media[0]} style={{ flex: 1 }} playSize={0} />
      {(post.media.length > 1 || post.media[0].kind === "video") && (
        <View style={{ position: "absolute", top: 7, right: 7 }}>
          <Glass style={{ width: 22, height: 22, borderRadius: 11, paddingLeft: post.media.length > 1 ? 0 : 2 }}>
            <Icon name={post.media.length > 1 ? "layers" : "play"} size={post.media.length > 1 ? 12 : 10} color="#fff" strokeWidth={2} />
          </Glass>
        </View>
      )}
      <View style={{ position: "absolute", right: 6, bottom: 6 }}>
        <SignedMark compact />
      </View>
    </Pressable>
  );
}

export function SquareGrid({ posts, width, gap = 3 }: { posts: Post[]; width: number; gap?: number }) {
  const w = Math.floor((width - gap * 2) / 3);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
      {posts.map((p) => (
        <PostTile key={p.id} post={p} w={w} h={Math.round((w * 4) / 3)} radiusPx={radius.tile - 4} />
      ))}
    </View>
  );
}

export function Bento({ posts, width, gap = 5 }: { posts: Post[]; width: number; gap?: number }) {
  const cell = (width - gap * 2) / 3;
  const unit = cell * 1.02;
  const slots = [
    { x: 0, y: 0, w: 2, h: 2 },
    { x: 2, y: 0, w: 1, h: 2 },
    { x: 0, y: 2, w: 1, h: 1 },
    { x: 1, y: 2, w: 1, h: 1 },
    { x: 2, y: 2, w: 1, h: 1 },
  ];
  const tiles: { post: Post; x: number; y: number; w: number; h: number }[] = [];
  let rows = 0;
  posts.forEach((post, i) => {
    const block = Math.floor(i / 5);
    const s = slots[i % 5];
    const flip = block % 2 === 1;
    const x = flip ? 3 - s.x - s.w : s.x;
    const y = block * 3 + s.y;
    rows = Math.max(rows, y + s.h);
    tiles.push({ post, x, y, w: s.w, h: s.h });
  });
  return (
    <View style={{ width, height: rows * unit + Math.max(0, rows - 1) * gap }}>
      {tiles.map((t) => (
        <View key={t.post.id} style={{ position: "absolute", left: t.x * (cell + gap), top: t.y * (unit + gap) }}>
          <PostTile post={t.post} w={t.w * cell + (t.w - 1) * gap} h={t.h * unit + (t.h - 1) * gap} radiusPx={16} />
        </View>
      ))}
    </View>
  );
}

export function PeopleRail({ posts }: { posts: Post[] }) {
  const router = useRouter();
  const { c } = useTheme();
  const seen = new Set<string>();
  const people = posts.map((p) => p.author).filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
  if (people.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingVertical: 2 }}>
      {people.map((u) => (
        <Pressable key={u.id} accessibilityRole="link" accessibilityLabel={`${u.displayName}'s profile`} onPress={() => router.push({ pathname: "/u/[handle]", params: { handle: u.handle } })} style={{ width: 60, alignItems: "center", gap: 5 }}>
          <Avatar user={u} size={56} />
          <Text numberOfLines={1} style={[type.meta, { fontSize: 11, color: c.ink2, maxWidth: 60 }]}>{u.displayName.split(" ")[0]}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function GridSkeleton({ width, rows = 3, gap = 3 }: { width: number; rows?: number; gap?: number }) {
  const w = Math.floor((width - gap * 2) / 3);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
      {Array.from({ length: rows * 3 }, (_, i) => (
        <Pulse key={i} style={{ width: w, height: Math.round((w * 4) / 3), borderRadius: radius.tile - 4 }} />
      ))}
    </View>
  );
}

export function RowSkeleton({ width }: { width: number }) {
  return (
    <View style={{ width, gap: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 44 }}>
        <Pulse style={{ width: 38, height: 38, borderRadius: 19 }} />
        <View style={{ gap: 6 }}>
          <Pulse style={{ width: 120, height: 12, borderRadius: 6 }} />
          <Pulse style={{ width: 80, height: 10, borderRadius: 5 }} />
        </View>
      </View>
      <Pulse style={{ width, height: width * 0.8, borderRadius: radius.media }} />
      <Pulse style={{ width: width * 0.7, height: 12, borderRadius: 6 }} />
    </View>
  );
}
