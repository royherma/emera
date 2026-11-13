import { useLocalSearchParams } from "expo-router";
import { ProfileView } from "@/components/ProfileView";
import { useAuth } from "@/state/auth";

export default function UserProfile() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { user } = useAuth();
  return <ProfileView handle={handle} own={user?.handle === handle} back />;
}
