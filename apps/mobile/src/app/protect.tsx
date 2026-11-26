import { useCallback, useState } from "react";
import { Linking, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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

const FREE_LINES = ["We check your 10 newest posts every month", "One tap takedowns for every copy", "If we get you paid, it is split 50/50"];

function FreeCard({ onTurnOn, busy, focused }: { onTurnOn: () => void; busy: boolean; focused: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space[3], backgroundColor: c.surface, borderRadius: radius.card, borderWidth: focused ? 2 : 1, borderColor: focused ? c.sun : c.hair, padding: space[4] }}>
      <Text style={[type.h1, { color: c.ink }]}>Free protection</Text>
      <View style={{ gap: space[1] }}>
        {FREE_LINES.map((line) => <Text key={line} style={[type.body, { color: c.ink }]}>{line}</Text>)}
      </View>
      <Button label="Turn on free protection" icon="shield" busy={busy} onPress={onTurnOn} style={{ alignSelf: "flex-start" }} />
      <Text style={[type.meta, { color: c.ink3 }]}>By turning it on you let Emera send copyright notices for your posts on your behalf. You can turn it off any time.</Text>
      <Text style={[type.bodySm, { color: c.ink2 }]} onPress={() => void Linking.openURL(PROTECT_URL)}>See paid plans</Text>
    </View>
  );
}

export default function Protect() {
  const { optin } = useLocalSearchParams<{ optin?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();
  const [plan, setPlan] = useState<ProtectPlan | null>(null);
  const [copies, setCopies] = useState<FoundCopy[] | null>(null);
  const [takedowns, setTakedowns] = useState<Takedown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    try {
      const me = await api.protectMe();
      setPlan(me);
      setCopies(me.plan === "free" && !me.optedIn ? [] : await api.foundCopies());
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

  const turn = async (on: boolean) => {
    setSwitching(true);
    try {
      setPlan(on ? await api.protectOptIn() : await api.protectOptOut());
      await load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setSwitching(false);
    }
  };

  const offer = plan?.plan === "free" && !plan.optedIn;

  return (
    <Screen maxWidth={640}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[4] }}>
        <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/settings"))} />
        <Text style={[type.h1, { color: c.ink }]}>Protect</Text>
      </View>
      {error && <Banner text={error} />}
      {plan && offer && <FreeCard onTurnOn={() => turn(true)} busy={switching} focused={optin === "1"} />}
      {plan && !offer && (
        <View style={{ gap: space[3] }}>
          {plan.plan !== "free" && (
            <Text style={[type.body, { color: c.ink2 }]}>
              {`${PLAN_NAME[plan.plan]} plan${plan.planUntil ? `, renews ${new Date(plan.planUntil).toLocaleDateString()}` : ""}`}
            </Text>
          )}
          <Button label="Scan my posts now" kind="secondary" busy={scanning} onPress={scan} style={{ alignSelf: "flex-start" }} />
          {plan.plan === "free" && (
            <Text style={[type.bodySm, { color: c.ink2 }]} onPress={() => void Linking.openURL(PROTECT_URL)}>Creator checks weekly and you keep 80% of what we recover</Text>
          )}
          <Text style={[type.section, { color: c.ink, marginTop: space[3] }]}>Found copies</Text>
          {copies && copies.length === 0 && <Text style={[type.body, { color: c.ink2 }]}>No copies found yet. We keep scanning.</Text>}
          {copies?.map((m) => <CopyCard key={m.id} item={m} onChange={load} hasTakedown={takedowns.some((t) => t.reportId === m.reportId)} />)}
        </View>
      )}
      {plan && takedowns.length > 0 && (
        <View style={{ gap: space[3], marginTop: space[3] }}>
          <Text style={[type.section, { color: c.ink }]}>Takedowns</Text>
          {takedowns.map((t) => <TakedownRow key={t.id} t={t} />)}
        </View>
      )}
      {plan && plan.plan === "free" && plan.optedIn && (
        <Text style={[type.meta, { color: c.ink3, marginTop: space[6] }]} onPress={() => void turn(false)}>Turn off free protection</Text>
      )}
    </Screen>
  );
}
