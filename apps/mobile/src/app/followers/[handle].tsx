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

export default function Followers() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  return (
    <UserList
      title="Followers"
      empty={{ title: "No followers yet", body: `@${handle} will show up in people's feeds once they follow.` }}
      load={(cursor) => api.followers(handle, cursor)}
      action={followToggle}
    />
  );
}
