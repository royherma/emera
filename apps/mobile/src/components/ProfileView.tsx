import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "./Avatar";
import { Screen } from "./Screen";
import { GridSkeleton, SquareGrid } from "./Grid";
import { Button, EmptyState, ErrorState, IconButton, Pulse } from "./ui";
import { api } from "@/lib/api";
import { PUBLIC_ORIGIN } from "@/lib/config";
import { useLayout } from "@/lib/layout";
import { shareLink } from "@/lib/share";
import { colors, font, space, type } from "@/lib/theme";
import { useResource } from "@/state/resource";
import { useToast } from "@/state/toast";

export function ProfileView({ handle, own, tabs, back }: { handle: string; own?: boolean; tabs?: boolean; back?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { inner, wide } = useLayout();
  const { data, error, loading, refreshing, reload, retry } = useResource(() => api.profile(handle), `profile:${handle}`);
  const cols = inner < 560 ? 3 : 4;
  const gap = wide ? 12 : 4;

  const share = async () => {
    const r = await shareLink(`${PUBLIC_ORIGIN}/@${handle}`, `@${handle}`);
    if (r === "copied") toast("Profile link copied");
  };

  const user = data?.user;
  return (
    <Screen tabs={tabs} onRefresh={reload} refreshing={refreshing}>
      {back && (
        <View style={{ marginBottom: space[3], alignSelf: "flex-start" }}>
          <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/feed"))} />
        </View>
      )}
      {error && !data ? (
        <ErrorState message={error} onRetry={retry} />
      ) : (
        <>
          <View style={{ flexDirection: wide ? "row" : "column", alignItems: wide ? "center" : "flex-start", gap: wide ? space[6] : space[4], paddingVertical: space[4] }}>
            {user ? <Avatar user={user} size={wide ? 132 : 92} /> : <Pulse style={{ width: wide ? 132 : 92, height: wide ? 132 : 92, borderRadius: 99 }} />}
            <View style={{ flex: 1, gap: space[2], width: "100%" }}>
              {user ? (
                <>
                  <Text style={[type.h1, { color: colors.ink }]}>{user.displayName}</Text>
                  <Text style={{ fontFamily: font.medium, fontSize: 15, color: colors.muted }}>@{user.handle}</Text>
                  {user.bio ? <Text style={[type.body, { color: colors.ink, maxWidth: 560 }]}>{user.bio}</Text> : null}
                  <Text style={[type.small, { color: colors.muted }]}>{data!.posts.length} {data!.posts.length === 1 ? "post" : "posts"}</Text>
                </>
              ) : (
                <>
                  <Pulse style={{ height: 34, width: 200 }} />
                  <Pulse style={{ height: 16, width: 110 }} />
                  <Pulse style={{ height: 16, width: "70%" }} />
                </>
              )}
              <View style={{ flexDirection: "row", gap: space[2], marginTop: space[2] }}>
                <Button label="Share profile" icon="share" kind="secondary" onPress={share} disabled={!user} />
                {own && <IconButton icon="sliders" label="Settings" onPress={() => router.push("/settings")} />}
              </View>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: space[4] }} />
          {loading || !data ? (
            <GridSkeleton cols={cols} gap={gap} width={inner} />
          ) : data.posts.length === 0 ? (
            <EmptyState
              icon="image"
              title={own ? "Your first post goes here" : "Nothing here yet"}
              body={own ? "Share a photo, a film or something you made. It is signed with your name from the first upload." : `@${data.user.handle} hasn't posted yet.`}
              action={own ? <Button label="Post something" icon="plus" onPress={() => router.push("/upload")} /> : undefined}
            />
          ) : (
            <SquareGrid posts={data.posts} cols={cols} gap={gap} width={inner} />
          )}
        </>
      )}
    </Screen>
  );
}
