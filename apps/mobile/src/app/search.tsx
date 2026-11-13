import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { SquareGrid, GridSkeleton } from "@/components/Grid";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Button, EmptyState, ErrorState, IconButton, Segmented, type PS } from "@/components/ui";
import { api } from "@/lib/api";
import { useLayout } from "@/lib/layout";
import { radius, space, type } from "@/lib/theme";
import { ApiError, type Post, type SearchKind, type User } from "@/lib/types";
import { useTheme } from "@/state/theme";

type Found = { users: User[]; posts: Post[]; cursor: string | null };

export default function Search() {
  const router = useRouter();
  const { c } = useTheme();
  const { wide, column } = useLayout();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<SearchKind>("people");
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const term = q.trim();

  useEffect(() => {
    if (!term) {
      setFound(null);
      setError(null);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.search(term, kind);
        if (live) {
          setFound(r);
          setError(null);
        }
      } catch (e) {
        if (live) setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      } finally {
        if (live) setLoading(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term, kind]);

  const loadMore = async () => {
    if (!found?.cursor) return;
    setMore(true);
    try {
      const r = await api.search(term, kind, found.cursor);
      setFound({ users: [...found.users, ...r.users], posts: [...found.posts, ...r.posts], cursor: r.cursor });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setMore(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace("/explore"));
  const items = kind === "people" ? (found?.users.length ?? 0) : (found?.posts.length ?? 0);

  return (
    <Screen maxWidth={wide ? column + 64 : undefined}>
      <View style={{ width: column, alignSelf: "center", gap: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <IconButton icon="back" label="Back" onPress={back} />
          <View style={{ flex: 1, height: 46, borderRadius: radius.field + 1, backgroundColor: c.sunk, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 }}>
            <Icon name="search" size={19} color={c.ink3} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search people and work"
              placeholderTextColor={c.ink3}
              selectionColor={c.sun}
              accessibilityLabel="Search"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={[{ flex: 1, height: 46, fontFamily: type.name.fontFamily, fontSize: 15, color: c.ink }, { outlineStyle: "none" } as object]}
            />
            {q ? (
              <Pressable accessibilityLabel="Clear search" onPress={() => setQ("")} hitSlop={10}>
                <Icon name="x" size={18} color={c.ink2} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "people", label: "People", icon: "user" },
            { value: "posts", label: "Work", icon: "image" },
          ]}
        />

        {!term ? (
          <EmptyState icon="search" title="Find a creator or a piece of work" body="Try a name, a handle, a craft, or a word from a caption or description." />
        ) : error && !found ? (
          <ErrorState message={error} onRetry={() => setQ((v) => v + " ")} />
        ) : loading && !found ? (
          <GridSkeleton width={column} rows={2} gap={5} />
        ) : items === 0 ? (
          <EmptyState icon="search" title="Nothing matches" body="Check the spelling, or try fewer words." />
        ) : kind === "people" ? (
          <View style={{ gap: 2 }}>
            {found!.users.map((u) => (
              <Pressable
                key={u.id}
                accessibilityRole="link"
                accessibilityLabel={`${u.displayName}, @${u.handle}`}
                onPress={() => router.push({ pathname: "/u/[handle]", params: { handle: u.handle } })}
                style={({ hovered, pressed }: PS) => ({ flexDirection: "row", alignItems: "center", gap: space[3], padding: space[2], borderRadius: radius.field, backgroundColor: hovered || pressed ? c.sunk : "transparent" })}
              >
                <Avatar user={u} size={52} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={[type.name, { fontSize: 15, color: c.ink }]}>{u.displayName}</Text>
                  <Text style={[type.meta, { color: c.ink3 }]}>@{u.handle}</Text>
                  {u.bio ? <Text numberOfLines={1} style={[type.bodySm, { color: c.ink2 }]}>{u.bio}</Text> : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <SquareGrid posts={found!.posts} width={column} from="search" />
        )}

        {found?.cursor ? <Button label="Show more" kind="secondary" busy={more} onPress={loadMore} /> : null}
      </View>
    </Screen>
  );
}
