import { useCallback, useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Banner, Button, IconButton } from "@/components/ui";
import { api } from "@/lib/api";
import { radius, space, type } from "@/lib/theme";
import { ApiError, FoundCopy, ProtectPlan } from "@/lib/types";
import { useTheme } from "@/state/theme";
import { useToast } from "@/state/toast";

const PROTECT_URL = "https://emera.social/protect/?ref=app";
const PLAN_NAME = { free: "Free", creator: "Creator", pro: "Pro" } as const;

function CopyCard({ item, onChange }: { item: FoundCopy; onChange: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState<"takedown" | "dismiss" | null>(null);

  const run = async (kind: "takedown" | "dismiss") => {
    setBusy(kind);
    try {
      if (kind === "takedown") await api.takedownCopy(item.id);
      else await api.dismissCopy(item.id);
      onChange();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flexDirection: "row", gap: space[3], backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.hair, padding: space[3] }}>
      <View style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", backgroundColor: c.hair }}>
        {item.thumbnail ? <Image source={{ uri: item.thumbnail }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
      </View>
      <View style={{ flex: 1, gap: space[1] }}>
        <Text numberOfLines={1} style={[type.title, { color: c.ink }]}>{item.site}</Text>
        <Text numberOfLines={2} style={[type.bodySm, { color: c.ink2 }]}>{item.title || item.url}</Text>
        <Text style={[type.meta, { color: c.ink3 }]}>{item.reason}</Text>
        {item.status === "reported" ? (
          <Text style={[type.bodySm, { color: c.ink }]}>Takedown requested</Text>
        ) : (
          <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap", marginTop: space[2] }}>
            <Button label="Take it down" size="sm" busy={busy === "takedown"} disabled={busy !== null} onPress={() => run("takedown")} />
            <Button label="Not a copy" size="sm" kind="secondary" busy={busy === "dismiss"} disabled={busy !== null} onPress={() => run("dismiss")} />
          </View>
        )}
        <Text style={[type.meta, { color: c.ink3, marginTop: space[1] }]} onPress={() => void Linking.openURL(item.url)}>Open the page</Text>
      </View>
    </View>
  );
}

export default function Protect() {
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();
  const [plan, setPlan] = useState<ProtectPlan | null>(null);
  const [copies, setCopies] = useState<FoundCopy[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    try {
      const me = await api.protectMe();
      setPlan(me);
      setCopies(me.plan === "free" ? [] : await api.foundCopies());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load this. Try again.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scan = async () => {
    setScanning(true);
    try {
      await api.scanNow();
      toast("Scan queued. New finds show up here.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't start a scan. Try again.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <Screen maxWidth={640}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[4] }}>
        <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/settings"))} />
        <Text style={[type.h1, { color: c.ink }]}>Protect</Text>
      </View>
      {error && <Banner text={error} />}
      {plan && (
        <View style={{ gap: space[3] }}>
          <Text style={[type.body, { color: c.ink2 }]}>
            {plan.plan === "free"
              ? "Emera Protect scans the web for copies of what you create and files takedowns for you."
              : `${PLAN_NAME[plan.plan]} plan${plan.planUntil ? `, renews ${new Date(plan.planUntil).toLocaleDateString()}` : ""}`}
          </Text>
          {plan.plan === "free" ? (
            <Button label="See Protect plans" icon="shield" onPress={() => void Linking.openURL(PROTECT_URL)} style={{ alignSelf: "flex-start" }} />
          ) : (
            <>
              <Button label="Scan my posts now" kind="secondary" busy={scanning} onPress={scan} style={{ alignSelf: "flex-start" }} />
              <Text style={[type.section, { color: c.ink, marginTop: space[3] }]}>Found copies</Text>
              {copies && copies.length === 0 && <Text style={[type.body, { color: c.ink2 }]}>No copies found yet. We keep scanning.</Text>}
              {copies?.map((m) => <CopyCard key={m.id} item={m} onChange={load} />)}
            </>
          )}
        </View>
      )}
    </Screen>
  );
}
