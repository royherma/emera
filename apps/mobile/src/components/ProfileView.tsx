import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Avatar } from "./Avatar";
import { Screen } from "./Screen";
import { Icon } from "./Icon";
import { GridSkeleton, SquareGrid } from "./Grid";
import { MediaImage } from "./Media";
import { Button, EmptyState, ErrorState, IconButton, Pulse } from "./ui";
import { api } from "@/lib/api";
import { PUBLIC_ORIGIN } from "@/lib/config";
import { useLayout } from "@/lib/layout";
import { shareLink } from "@/lib/share";
import { storage } from "@/lib/storage";
import { alpha, creatorColors, radius, space, type } from "@/lib/theme";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";
import { useToast } from "@/state/toast";
import type { Post } from "@/lib/types";

const FOLLOW_KEY = "follows";

function useFollow(handle: string) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    storage.get(FOLLOW_KEY).then((v) => {
      try {
        setOn((JSON.parse(v ?? "[]") as string[]).includes(handle));
      } catch {
        setOn(false);
      }
    });
  }, [handle]);
  const toggle = async () => {
    const next = !on;
    setOn(next);
    let list: string[] = [];
    try {
      list = JSON.parse((await storage.get(FOLLOW_KEY)) ?? "[]");
    } catch {}
    await storage.set(FOLLOW_KEY, JSON.stringify(next ? [...new Set([...list, handle])] : list.filter((h) => h !== handle)));
  };
  return { on, toggle };
}

type Group = "all" | "image" | "video" | "series";
const groupOf = (p: Post): Group => (p.media.length > 1 ? "series" : p.media[0].kind === "video" ? "video" : "image");
const groupLabel: Record<Group, string> = { all: "All", image: "Photos", video: "Films", series: "Series" };

export function ProfileView({ handle, own, tabs, back }: { handle: string; own?: boolean; tabs?: boolean; back?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();
  const { wide, column } = useLayout();
  const { data, error, loading, refreshing, reload, retry } = useResource(() => api.profile(handle), `profile:${handle}`);
  const follow = useFollow(handle);
  const [group, setGroup] = useState<Group>("all");

  const user = data?.user;
  const posts = data?.posts ?? [];
  const colors = creatorColors(handle || "me");
  const groups = useMemo(() => {
    const present = (["image", "video", "series"] as Group[]).filter((g) => posts.some((p) => groupOf(p) === g));
    return present.length > 1 ? (["all", ...present] as Group[]) : [];
  }, [posts]);
  const shown = group === "all" ? posts : posts.filter((p) => groupOf(p) === group);

  const share = async () => {
    const r = await shareLink(`${PUBLIC_ORIGIN}/@${handle}`, `@${handle}`);
    if (r === "copied") toast("Profile link copied");
  };

  const stat = (value: string, label: string) => (
    <View style={{ alignItems: "center", gap: 1 }}>
      <Text style={[type.stat, { color: c.ink }]}>{value}</Text>
      <Text style={[type.meta, { color: c.ink2 }]}>{label}</Text>
    </View>
  );

  return (
    <Screen tabs={tabs} onRefresh={reload} refreshing={refreshing} maxWidth={wide ? column + 64 : undefined}>
      <View style={{ width: column, alignSelf: "center" }}>
        <LinearGradient pointerEvents="none" colors={[alpha(colors.from, 0.22), alpha(colors.to, 0)]} style={{ position: "absolute", left: -48, right: -48, top: -80, height: 260 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 44, marginBottom: space[2] }}>
          {back ? <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/feed"))} /> : <View />}
          {own && <IconButton icon="sliders" label="Settings" onPress={() => router.push("/settings")} />}
        </View>
        {error && !data ? (
          <ErrorState message={error} onRetry={retry} />
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[5] }}>
              {user ? <Avatar user={user} size={84} /> : <Pulse style={{ width: 84, height: 84, borderRadius: 42 }} />}
              <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-evenly" }}>
                {user ? (
                  <>
                    {stat(String(posts.length), posts.length === 1 ? "Work" : "Works")}
                    {stat(new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" }), "Joined")}
                  </>
                ) : (
                  <Pulse style={{ height: 36, width: 160, borderRadius: 10 }} />
                )}
              </View>
            </View>
            <View style={{ marginTop: space[3], gap: 4 }}>
              {user ? (
                <>
                  <Text style={[type.title, { fontSize: 19, color: c.ink }]}>{user.displayName}</Text>
                  <Text style={[type.meta, { color: c.ink3 }]}>@{user.handle}</Text>
                  {user.bio ? <Text style={[type.bodySm, { color: c.ink, maxWidth: 420, marginTop: 2 }]}>{user.bio}</Text> : null}
                </>
              ) : (
                <>
                  <Pulse style={{ height: 22, width: 180, borderRadius: 8 }} />
                  <Pulse style={{ height: 14, width: "70%", borderRadius: 7 }} />
                </>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: space[2], marginTop: space[4] }}>
              {own ? (
                <Button label="Share profile" icon="share" onPress={share} disabled={!user} style={{ flex: 1 }} />
              ) : (
                <>
                  <Button label={follow.on ? "Following" : "Follow"} kind={follow.on ? "secondary" : "primary"} onPress={follow.toggle} disabled={!user} style={{ flex: 1.3 }} />
                  <Button label="Message" kind="secondary" disabled style={{ flex: 1 }} />
                  <IconButton icon="share" label="Share profile" onPress={share} />
                </>
              )}
            </View>

            {groups.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginTop: space[4] }} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
                {groups.map((g) => {
                  const cover = (g === "all" ? posts : posts.filter((p) => groupOf(p) === g))[0];
                  const on = group === g;
                  return (
                    <Pressable key={g} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setGroup(g)} style={{ width: 60, alignItems: "center", gap: 5 }}>
                      <LinearGradient colors={on ? [colors.from, colors.to] : [c.sunk, c.sunk]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 56, height: 56, borderRadius: 28, padding: 2 }}>
                        <View style={{ flex: 1, borderRadius: 26, borderWidth: 2, borderColor: c.bg, overflow: "hidden" }}>
                          <MediaImage media={cover.media[0]} style={{ flex: 1 }} playSize={20} />
                        </View>
                      </LinearGradient>
                      <Text style={[type.meta, { fontSize: 11, color: on ? c.ink : c.ink2 }]}>{groupLabel[g]}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <View style={{ height: 1, backgroundColor: c.hair, marginTop: space[4], marginBottom: 3 }} />
            {loading || !data ? (
              <GridSkeleton width={column} />
            ) : posts.length === 0 ? (
              <EmptyState
                icon="image"
                title={own ? "Your first work goes here" : "Nothing here yet"}
                body={own ? "Share a photo, a film or something you made. It is signed with your name from the first upload." : `@${data.user.handle} hasn't posted yet.`}
                action={own ? <Button label="Post something" icon="plus" onPress={() => router.push("/upload")} /> : undefined}
              />
            ) : (
              <SquareGrid posts={shown} width={column} />
            )}
          </>
        )}
      </View>
    </Screen>
  );
}
