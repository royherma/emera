import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { UserRow } from "@/components/UserList";
import { EmptyState, ErrorState, IconButton, Pulse } from "@/components/ui";
import { api } from "@/lib/api";
import { space, type } from "@/lib/theme";
import type { User } from "@/lib/types";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";

type Lists = { blocked: User[]; muted: User[] };

const fetchAll = async (): Promise<Lists> => {
  const [b, m] = await Promise.all([api.blocks(), api.mutes()]);
  return { blocked: b.users, muted: m.users };
};

export default function Blocked() {
  const router = useRouter();
  const { c } = useTheme();
  const { data, error, loading, retry, setData } = useResource(fetchAll, "blocked-muted");

  const drop = (kind: keyof Lists, u: User) => data && setData({ ...data, [kind]: data[kind].filter((x) => x.id !== u.id) });

  const section = (title: string, kind: keyof Lists, label: string, run: (u: User) => Promise<User>, none: string) => (
    <View style={{ gap: space[3], paddingVertical: space[3] }}>
      <Text style={[type.section, { color: c.ink }]}>{title}</Text>
      {data && data[kind].length === 0 ? (
        <EmptyState icon="shield" title={none} body="People you add show up here, and you can undo it any time." />
      ) : (
        data?.[kind].map((u) => <UserRow key={u.id} user={u} action={{ label, run }} onChange={(next) => drop(kind, next)} />)
      )}
    </View>
  );

  return (
    <Screen maxWidth={640}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[4] }}>
        <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/settings"))} />
        <Text style={[type.h1, { color: c.ink }]}>Blocked and muted</Text>
      </View>
      {error && !data ? (
        <ErrorState message={error} onRetry={retry} />
      ) : loading || !data ? (
        <View style={{ gap: space[3] }}>
          {[0, 1, 2].map((i) => (
            <Pulse key={i} style={{ height: 52, borderRadius: 14 }} />
          ))}
        </View>
      ) : (
        <>
          {section("Blocked accounts", "blocked", "Unblock", (u) => api.unblock(u.handle), "Nobody blocked")}
          <View style={{ height: 1, backgroundColor: c.hair }} />
          {section("Muted accounts", "muted", "Unmute", (u) => api.unmute(u.handle), "Nobody muted")}
        </>
      )}
    </Screen>
  );
}
