import { useRouter } from "expo-router";
import { ProfileView } from "@/components/ProfileView";
import { useAuth } from "@/state/auth";

export default function Me() {
  const { user } = useAuth();
  const router = useRouter();
  return <ProfileView handle={user?.handle ?? ""} own tabs onInvite={() => router.push("/invites")} />;
}
