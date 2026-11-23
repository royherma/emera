import { useCallback, useState } from "react";
import { Linking, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Banner, Button, IconButton } from "@/components/ui";
import { api } from "@/lib/api";
import { radius, space, type } from "@/lib/theme";
import { shareLink } from "@/lib/share";
import { ApiError, FoundCopy, ProtectPlan, Takedown } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/state/theme";
import { useToast } from "@/state/toast";

const PROTECT_URL = "https://emera.social/protect/?ref=app";
const PLAN_NAME = { free: "Free", creator: "Creator", pro: "Pro" } as const;

const STATUS_TEXT = {
  ready: "Waiting for our check",
  sent: "Sent, watching the page",
  removed: "Removed",
  still_up: "Still up after 30 days",
  counter_notice: "They sent a counter-notice",
  rejected: "We did not send it",
} as const;

function TakedownRow({ t }: { t: Takedown }) {
  const { c } = useTheme();
  const toast = useToast();
  if (t.status === "removed") {
    const date = t.removedAt ? new Date(t.removedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "";
    const days = t.daysToRemoval === 0 ? "the same day" : t.daysToRemoval === 1 ? "in 1 day" : `in ${t.daysToRemoval} days`;
    return (
      <View style={{ gap: space[2], backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.sun, padding: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Icon name="check" size={18} color={c.sunInk} strokeWidth={2.4} />
          <Text style={[type.label, { color: c.sunInk, textTransform: "uppercase", letterSpacing: 0.8 }]}>Removed</Text>
        </View>
        <Text style={[type.h1, { color: c.ink }]}>{`Gone ${days}`}</Text>
        <Text style={[type.bodySm, { color: c.ink2 }]}>{`${t.site}, ${date}`}</Text>
        {t.receiptUrl && (
          <Button
            label="Share receipt"
            size="sm"
            kind="secondary"
            onPress={async () => {
              const how = await shareLink(t.receiptUrl!, `Removed ${days} from ${t.site}`);
              if (how === "copied") toast("Link copied");
            }}
            style={{ alignSelf: "flex-start", marginTop: space[1] }}
          />
        )}
      </View>
    );
  }
  return (
    <View style={{ gap: space[1], backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.hair, padding: space[3] }}>
      <Text numberOfLines={1} style={[type.title, { color: c.ink }]}>{t.site}</Text>
      <Text style={[type.bodySm, { color: c.ink }]}>{STATUS_TEXT[t.status]}</Text>
      {t.status === "rejected" && t.rejectReason ? <Text style={[type.meta, { color: c.ink2 }]}>{t.rejectReason}</Text> : null}
    </View>
  );
}

function CopyCard({ item, onChange, hasTakedown }: { item: FoundCopy; onChange: () => void; hasTakedown: boolean }) {
  const { c } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<"takedown" | "dismiss" | null>(null);

  const run = async (kind: "takedown" | "dismiss") => {
    setBusy(kind);
    try {
      if (kind === "takedown") {
        const m = await api.takedownCopy(item.id);
        onChange();
        if (m.reportId) router.push({ pathname: "/report", params: { reportId: m.reportId } });
        return;
      }
      await api.dismissCopy(item.id);
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
          hasTakedown ? (
            <Text style={[type.bodySm, { color: c.ink }]}>Takedown in progress</Text>
          ) : (
            <Button label="Finish takedown" size="sm" onPress={() => router.push({ pathname: "/report", params: { reportId: item.reportId ?? "" } })} style={{ alignSelf: "flex-start", marginTop: space[2] }} />
          )
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
  const [takedowns, setTakedowns] = useState<Takedown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    try {
      const me = await api.protectMe();
      setPlan(me);
      setCopies(me.plan === "free" ? [] : await api.foundCopies());
      setTakedowns(await api.takedowns());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load this. Try again.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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
              {copies?.map((m) => <CopyCard key={m.id} item={m} onChange={load} hasTakedown={takedowns.some((t) => t.reportId === m.reportId)} />)}
            </>
          )}
          {takedowns.length > 0 && (
            <>
              <Text style={[type.section, { color: c.ink, marginTop: space[3] }]}>Takedowns</Text>
              {takedowns.map((t) => <TakedownRow key={t.id} t={t} />)}
            </>
          )}
        </View>
      )}
    </Screen>
  );
}
