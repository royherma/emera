import { ProfileView } from "@/components/ProfileView";
import { useAuth } from "@/state/auth";

export default function Me() {
  const { user } = useAuth();
  return <ProfileView handle={user?.handle ?? ""} own tabs />;
}
