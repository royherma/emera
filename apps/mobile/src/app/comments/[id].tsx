import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Thread } from "@/components/Thread";
import { IconButton } from "@/components/ui";
import { space, type } from "@/lib/theme";
import { useTheme } from "@/state/theme";

export default function Comments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const [total, setTotal] = useState<number | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/feed"));
  return (
    <Screen maxWidth={680}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginBottom: space[3] }}>
        <IconButton icon="back" label="Back" onPress={back} />
        <Text style={[type.h2, { color: c.ink, flex: 1 }]}>Comments{total !== null ? ` (${total})` : ""}</Text>
      </View>
      <Thread postId={id} onCount={setTotal} />
    </Screen>
  );
}
