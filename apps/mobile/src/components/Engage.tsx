import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "./Icon";
import type { PS } from "./ui";
import { api } from "@/lib/api";
import { ApiError, type Post } from "@/lib/types";
import { space, sun, type } from "@/lib/theme";
import { useToast } from "@/state/toast";
import { useTheme } from "@/state/theme";
import { useUnread } from "@/state/unread";
import { useViewCount } from "@/state/views";

const count = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function LikeButton({ post }: { post: Post }) {
  const { c } = useTheme();
  const toast = useToast();
  const [liked, setLiked] = useState(post.viewer.liked);
  const [n, setN] = useState(post.likeCount);
  const busy = useRef(false);

  useEffect(() => {
    setLiked(post.viewer.liked);
    setN(post.likeCount);
  }, [post.viewer.liked, post.likeCount]);

  const toggle = async () => {
    if (busy.current) return;
    busy.current = true;
    const next = !liked;
    setLiked(next);
    setN((v) => Math.max(0, v + (next ? 1 : -1)));
    try {
      const r = await (next ? api.like(post.id) : api.unlike(post.id));
      setLiked(r.liked);
      setN(r.likeCount);
    } catch (e) {
      setLiked(!next);
      setN((v) => Math.max(0, v + (next ? -1 : 1)));
      toast(e instanceof ApiError ? e.message : "That didn't go through. Try again.");
    } finally {
      busy.current = false;
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={liked ? "Unlike" : "Like"}
      accessibilityState={{ selected: liked }}
      onPress={toggle}
      hitSlop={6}
      style={({ pressed, hovered }: PS) => ({ flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingRight: space[2], opacity: hovered ? 0.8 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}
    >
      <Icon name="heart" size={24} color={liked ? sun.sun : c.ink} fill={liked ? sun.sun : "none"} strokeWidth={liked ? 1.9 : 1.7} />
      <Text style={[type.name, { color: liked ? c.sunInk : c.ink2 }]}>{count(n)}</Text>
    </Pressable>
  );
}

export function CommentButton({ post }: { post: Post }) {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Comments, ${post.commentCount}`}
      onPress={() => router.push({ pathname: "/comments/[id]", params: { id: post.id } })}
      hitSlop={6}
      style={({ pressed, hovered }: PS) => ({ flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingRight: space[2], opacity: hovered ? 0.8 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}
    >
      <Icon name="chat" size={23} color={c.ink} />
      <Text style={[type.name, { color: c.ink2 }]}>{count(post.commentCount)}</Text>
    </Pressable>
  );
}

export function ViewCount({ post }: { post: Post }) {
  const { c } = useTheme();
  const router = useRouter();
  const n = useViewCount(post);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${n} ${n === 1 ? "person" : "people"} watched. See where the views came from`}
      onPress={() => router.push({ pathname: "/views/[id]", params: { id: post.id } })}
      hitSlop={6}
      style={({ pressed, hovered }: PS) => ({ flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingRight: space[2], opacity: hovered ? 0.8 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}
    >
      <Icon name="eye" size={23} color={c.ink} />
      <Text style={[type.name, { color: c.ink2 }]}>{count(n)}</Text>
    </Pressable>
  );
}

export function EngageBar({ post }: { post: Post }) {
  const video = post.media.some((m) => m.kind === "video");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginLeft: -2 }}>
      <LikeButton post={post} />
      <CommentButton post={post} />
      {video && <ViewCount post={post} />}
    </View>
  );
}

export function UnreadDot({ size = 10 }: { size?: number }) {
  const { c } = useTheme();
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: sun.sun, borderWidth: 2, borderColor: c.bg }} />;
}

export function NotificationBell() {
  const { c } = useTheme();
  const router = useRouter();
  const unread = useUnread();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
      onPress={() => router.push("/notifications")}
      hitSlop={8}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name="bell" size={22} color={c.ink} />
      {unread > 0 && (
        <View style={{ position: "absolute", top: 9, right: 10 }}>
          <UnreadDot />
        </View>
      )}
    </Pressable>
  );
}
