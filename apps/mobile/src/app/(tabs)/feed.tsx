import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { SponsorLine, pickSponsor } from "@/components/Sponsor";
import { PeopleRail, PostRow, RowSkeleton } from "@/components/Grid";
import { NotificationBell, UnreadDot } from "@/components/Engage";
import { useDmUnread, useRefreshDmUnread } from "@/state/dmUnread";
import { Icon } from "@/components/Icon";
import { useInView } from "@/components/Media";
import { Button, EmptyState, ErrorState, Segmented, Wordmark } from "@/components/ui";
import { api } from "@/lib/api";
import { useLayout } from "@/lib/layout";
import { alpha, space, type } from "@/lib/theme";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";
import type { FeedMode, FundCards, Post } from "@/lib/types";

export default function Feed() {
  const router = useRouter();
  const { c } = useTheme();
  const { wide, column } = useLayout();
  const [mode, setMode] = useState<FeedMode>("all");
  const dm = useDmUnread();
  useRefreshDmUnread(mode);
  const { data, error, loading, refreshing, reload, retry, setData } = useResource(() => api.feed(null, mode), `feed:${mode}`);
  const [more, setMore] = useState(false);
  const [fund, setFund] = useState<FundCards | null>(null);
  useEffect(() => {
    let live = true;
    api.fund().then((f) => live && setFund(f)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const banner = fund ? pickSponsor(fund.banners, Date.now()) : null;
  const every = fund?.feedCards.on ? fund.feedCards.every : 0;
  const [moreError, setMoreError] = useState(false);
  const busy = useRef(false);

  const loadMore = useCallback(async () => {
    if (!data?.cursor || busy.current) return;
    busy.current = true;
    setMore(true);
    setMoreError(false);
    try {
      const next = await api.feed(data.cursor, mode);
      const seen = new Set(data.posts.map((p) => p.id));
      setData({ posts: [...data.posts, ...next.posts.filter((p: Post) => !seen.has(p.id))], cursor: next.cursor });
    } catch {
      setMoreError(true);
    } finally {
      busy.current = false;
      setMore(false);
    }
  }, [data, mode, setData]);

  const dropPost = (id: string) => data && setData({ ...data, posts: data.posts.filter((p) => p.id !== id) });

  return (
    <Screen tabs onRefresh={reload} refreshing={refreshing} maxWidth={wide ? column + 64 : undefined}>
      <View style={{ width: column, alignSelf: "center", gap: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
          {wide ? <View /> : <Wordmark size={22} />}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {!wide && <NotificationBell />}
            {!wide && (
              <Pressable accessibilityRole="button" accessibilityLabel={dm.inbox + dm.requests ? "Messages, unread" : "Messages"} onPress={() => router.push("/messages")} hitSlop={8} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Icon name="chat" size={22} color={c.ink} />
                {dm.inbox + dm.requests > 0 && (
                  <View style={{ position: "absolute", top: 9, right: 8 }}>
                    <UnreadDot />
                  </View>
                )}
              </Pressable>
            )}
            <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={() => router.push("/explore")} hitSlop={8} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Icon name="search" size={22} color={c.ink} />
            </Pressable>
          </View>
        </View>
        {banner && <SponsorLine sponsor={banner} />}
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setData(null);
          }}
          options={[
            { value: "following", label: "Following", icon: "user" },
            { value: "all", label: "Everyone", icon: "compass" },
          ]}
        />
        {error && !data ? (
          <ErrorState message={error} onRetry={retry} />
        ) : loading || !data ? (
          <View style={{ gap: space[5] }}>
            <RowSkeleton width={column} />
            <RowSkeleton width={column} />
          </View>
        ) : data.posts.length === 0 && mode === "following" ? (
          <EmptyState icon="user" title="Follow people to fill this feed" body="Work from the people you follow shows up here, newest first." action={<Button label="See everyone" kind="secondary" onPress={() => setMode("all")} />} />
        ) : data.posts.length === 0 ? (
          <EmptyState icon="image" title="Your feed starts with you" body="Share the first piece. It appears here the moment you post it." action={<Button label="Post something" icon="plus" onPress={() => router.push("/upload")} />} />
        ) : (
          <>
            <PeopleRail posts={data.posts} />
            <View style={{ gap: space[5] }}>
              {data.posts.map((p, i) => (
                <View key={p.id} style={{ gap: space[5] }}>
                  <PostRow post={p} width={column} onDeleted={dropPost} />
                  {every > 0 && fund && (i + 1) % every === 0 && <SponsorLine card sponsor={pickSponsor(fund.banners, (i + 1) / every)!} />}
                </View>
              ))}
            </View>
            <FeedEnd cursor={data.cursor} loading={more} failed={moreError} onMore={loadMore} onRefresh={reload} />
          </>
        )}
      </View>
    </Screen>
  );
}

function FeedEnd({ cursor, loading, failed, onMore, onRefresh }: { cursor?: string | null; loading: boolean; failed: boolean; onMore: () => void; onRefresh: () => void }) {
  const { c } = useTheme();
  const [ref, inView] = useInView(0.01);
  useEffect(() => {
    if (inView && cursor && !failed) onMore();
  }, [inView, cursor, failed, onMore]);
  return (
    <View ref={ref} testID="feed-end" style={{ minHeight: 180, alignItems: "center", justifyContent: "center", gap: space[3], paddingVertical: space[6] }}>
      {failed ? (
        <>
          <Text style={[type.bodySm, { color: c.ink2 }]}>More posts didn't load</Text>
          <Button label="Try again" kind="secondary" onPress={onMore} />
        </>
      ) : cursor || loading ? (
        <>
          <ActivityIndicator color={c.sun} />
          <Text style={[type.meta, { color: c.ink3 }]}>Loading more</Text>
        </>
      ) : (
        <>
          <View style={{ width: 44, height: 44, borderRadius: 99, backgroundColor: alpha(c.sun, 0.16), alignItems: "center", justifyContent: "center" }}>
            <Icon name="check" size={22} color={c.sunInk} strokeWidth={2} />
          </View>
          <Text style={[type.name, { color: c.ink }]}>You're all caught up</Text>
          <Text style={[type.meta, { color: c.ink3 }]}>New posts land at the top</Text>
          <Button label="Check for new posts" kind="secondary" onPress={onRefresh} />
        </>
      )}
    </View>
  );
}
