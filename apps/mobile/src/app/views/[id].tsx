import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { IconButton } from "@/components/ui";
import { api } from "@/lib/api";
import { ApiError, type ViewLedger } from "@/lib/types";
import { space, type } from "@/lib/theme";
import { useTheme } from "@/state/theme";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" });

export default function Views() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const [data, setData] = useState<ViewLedger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/feed"));
  useEffect(() => {
    api.views(id).then(setData, (e) => setError(e instanceof ApiError ? e.message : "Couldn't load the views."));
  }, [id]);
  const stat = (n: number, label: string) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={[type.h2, { color: c.ink }]}>{n.toLocaleString()}</Text>
      <Text style={[type.meta, { color: c.ink3 }]}>{label}</Text>
    </View>
  );
  return (
    <Screen maxWidth={680}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginBottom: space[3] }}>
        <IconButton icon="back" label="Back" onPress={back} />
        <Text style={[type.h2, { color: c.ink, flex: 1 }]}>Views</Text>
      </View>
      {error && <Text style={[type.body, { color: c.ink2 }]}>{error}</Text>}
      {data && (
        <ScrollView contentContainerStyle={{ gap: space[3], paddingBottom: space[4] }}>
          <View style={{ flexDirection: "row", gap: space[3] }}>
            {stat(data.viewCount, "people watched")}
            {stat(data.plays, "plays")}
            {stat(data.followers, "follow the maker")}
            {stat(data.newAccounts, "joined this week")}
          </View>
          <Text style={[type.meta, { color: c.ink2 }]}>{data.rule} Every view is listed below without the name.</Text>
          {(data.sameDevice > 0 || data.sameNetwork > 0) && (
            <Text style={[type.meta, { color: c.ink2 }]}>
              {data.sameDevice > 0 && `${data.sameDevice} came from a phone or computer another viewer also used. `}
              {data.sameNetwork > 0 && `${data.sameNetwork} came from an internet connection another viewer also used.`}
            </Text>
          )}
          <View>
            {data.ledger.map((r) => (
              <View key={r.viewer} style={{ gap: 2, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.hair }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                  <Text style={[type.meta, { color: c.ink, fontFamily: "monospace", flex: 1 }]}>{r.viewer}</Text>
                  {(r.sameDevice || r.sameNetwork) && <Text style={[type.meta, { color: c.ink2 }]}>{r.sameDevice ? "same device" : "same network"}</Text>}
                  <Text style={[type.meta, { color: c.ink }]}>{r.plays} {r.plays === 1 ? "play" : "plays"}</Text>
                </View>
                <Text style={[type.meta, { color: c.ink3 }]}>{[when(r.hour), r.follower ? "follower" : "not following", r.accountAge].join(" · ")}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
