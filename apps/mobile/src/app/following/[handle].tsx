import { useLocalSearchParams } from "expo-router";
import { UserList, type RowAction } from "@/components/UserList";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

function followToggle(u: User, me: User | null): RowAction | undefined {
  if (!me || u.id === me.id) return undefined;
  return u.viewer?.following
    ? { label: "Following", run: (x) => api.unfollow(x.handle) }
    : { label: "Follow", kind: "primary", run: (x) => api.follow(x.handle) };
}

export default function Following() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  return (
    <UserList
      title="Following"
      empty={{ title: "Not following anyone yet", body: `@${handle} hasn't followed anyone yet.` }}
      load={(cursor) => api.following(handle, cursor)}
      action={followToggle}
    />
  );
}
