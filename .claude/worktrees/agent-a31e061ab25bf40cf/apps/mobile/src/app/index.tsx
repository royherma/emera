import { Redirect } from "expo-router";
import { useAuth } from "@/state/auth";

export default function Index() {
  const { status } = useAuth();
  return <Redirect href={status === "in" ? "/feed" : status === "needsHandle" ? "/handle" : "/welcome"} />;
}
