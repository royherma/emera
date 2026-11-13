import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "./Avatar";
import { Screen } from "./Screen";
import { Button, EmptyState, ErrorState, IconButton, Pulse } from "./ui";
import { useLayout } from "@/lib/layout";
import { space, type } from "@/lib/theme";
import { ApiError } from "@/lib/types";
import type { User, UserPage } from "@/lib/types";
import { useAuth } from "@/state/auth";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";
import { useToast } from "@/state/toast";

export type RowAction = { label: string; kind?: "primary" | "secondary"; run: (u: User) => Promise<User> };

export function UserRow({ user, action, onChange }: { user: User; action?: RowAction; onChange: (u: User) => void }) {
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  const open = () => router.push({ pathname: "/u/[handle]", params: { handle: user.handle } });
  const press = async () => {
    if (!action) return;
    setBusy(true);
    try {
      onChange(await action.run(user));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 60 }}>
      <Pressable accessibilityRole="link" accessibilityLabel={`${user.displayName}'s profile`} onPress={open} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <Avatar user={user} size={48} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[type.title, { fontSize: 16, color: c.ink }]}>{user.displayName}</Text>
          <Text numberOfLines={1} style={[type.meta, { color: c.ink3 }]}>@{user.handle}</Text>
        </View>
      </Pressable>
      {action && <Button label={action.label} kind={action.kind ?? "secondary"} size="sm" busy={busy} onPress={press} />}
    </View>
  );
}

type Props = {
  title: string;
  empty: { title: string; body: string };
  load: (cursor?: string | null) => Promise<UserPage>;
  action?: (u: User, me: User | null) => RowAction | undefined;
};

export function UserList({ title, empty, load, action }: Props) {
  const router = useRouter();
  const { c } = useTheme();
  const { column, wide } = useLayout();
  const { user: me } = useAuth();
  const { data, error, loading, refreshing, reload, retry, setData } = useResource(() => load(), `list:${title}`);
  const [more, setMore] = useState(false);

  const loadMore = useCallback(async () => {
    if (!data?.cursor) return;
    setMore(true);
    try {
      const next = await load(data.cursor);
      const seen = new Set(data.users.map((u) => u.id));
      setData({ users: [...data.users, ...next.users.filter((u) => !seen.has(u.id))], cursor: next.cursor });
    } finally {
      setMore(false);
    }
  }, [data, load, setData]);

  const replace = (u: User) => data && setData({ ...data, users: data.users.map((x) => (x.id === u.id ? u : x)) });

  return (
    <Screen onRefresh={reload} refreshing={refreshing} maxWidth={wide ? column + 64 : 640}>
      <View style={{ gap: space[3] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[2] }}>
          <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/feed"))} />
          <Text style={[type.h1, { color: c.ink }]}>{title}</Text>
        </View>
        {error && !data ? (
          <ErrorState message={error} onRetry={retry} />
        ) : loading || !data ? (
          <View style={{ gap: space[3] }}>
            {[0, 1, 2, 3].map((i) => (
              <Pulse key={i} style={{ height: 52, borderRadius: 14 }} />
            ))}
          </View>
        ) : data.users.length === 0 ? (
          <EmptyState icon="user" title={empty.title} body={empty.body} />
        ) : (
          <>
            {data.users.map((u) => (
              <UserRow key={u.id} user={u} action={action?.(u, me)} onChange={replace} />
            ))}
            {data.cursor && (
              <View style={{ alignItems: "center" }}>
                <Button label="Show more" kind="secondary" busy={more} onPress={loadMore} />
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}
