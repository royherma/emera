import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { MediaImage } from "@/components/Media";
import { Screen } from "@/components/Screen";
import { Button, EmptyState, ErrorState, IconButton, Pulse } from "@/components/ui";
import { api } from "@/lib/api";
import { alpha, radius, space, type } from "@/lib/theme";
import { CopyReport, ReportStatus } from "@/lib/types";
import { useAuth } from "@/state/auth";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";
import { useToast } from "@/state/toast";

const LABEL: Record<ReportStatus, string> = { sent: "Sent", filing: "We're filing the takedown", taken_down: "Taken down", not_removed: "Not removed" };
const SHORT: Record<ReportStatus, string> = { sent: "Sent", filing: "Filing", taken_down: "Taken down", not_removed: "Not removed" };
const ORDER: ReportStatus[] = ["sent", "filing", "taken_down", "not_removed"];

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

function Pill({ status }: { status: ReportStatus }) {
  const { c } = useTheme();
  const tone = status === "taken_down" ? { bg: alpha(c.sun, 0.2), fg: c.sunInk } : status === "not_removed" ? { bg: alpha(c.danger, 0.14), fg: c.danger } : { bg: c.sunk, fg: c.ink2 };
  return (
    <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: tone.bg }}>
      {status === "taken_down" && <Icon name="check" size={12} color={tone.fg} strokeWidth={2.6} />}
      <Text style={[type.label, { color: tone.fg, fontSize: 12 }]}>{LABEL[status]}</Text>
    </View>
  );
}

function Row({ r, mod, onChange }: { r: CopyReport; mod: boolean; onChange: (r: CopyReport) => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const set = async (status: ReportStatus) => {
    try {
      onChange(await api.setReportStatus(r.id, status));
    } catch {
      toast("Couldn't change that. Try again.");
    }
  };
  return (
    <View style={{ gap: space[3], backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.hair, padding: space[3] }}>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <View style={{ width: 56, height: 74, borderRadius: radius.tile, overflow: "hidden", backgroundColor: c.sunk }}>
          {r.thumbUrl ? <MediaImage media={{ id: r.id, kind: "image", contentType: "image/jpeg", width: 3, height: 4, url: r.thumbUrl, sha256: "", proof: { sha256: "", signedAt: r.createdAt, signer: "" } }} style={{ flex: 1 }} playSize={0} /> : null}
        </View>
        <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
          <Text numberOfLines={1} style={[type.name, { color: c.ink }]}>{host(r.url)}</Text>
          <Pill status={r.status} />
          <Text style={[type.meta, { color: c.ink3 }]}>
            {mod && r.reporter ? `@${r.reporter} · ` : ""}Sent {day(r.createdAt)}
            {r.status !== "sent" ? ` · Updated ${day(r.updatedAt)}` : ""}
          </Text>
        </View>
      </View>
      {mod && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
          {ORDER.map((s) => (
            <Pressable key={s} accessibilityRole="button" onPress={() => s !== r.status && set(s)} style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: "center", backgroundColor: s === r.status ? c.sun : c.sunk }}>
              <Text style={[type.label, { fontSize: 12, color: s === r.status ? c.onSun : c.ink }]}>{SHORT[s]}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function Reports() {
  const { all } = useLocalSearchParams<{ all?: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const { user } = useAuth();
  const isMod = user?.role === "admin" || user?.role === "mod";
  const mod = !!all && isMod;
  const { data, setData, error, loading, retry } = useResource(() => (mod ? api.modReports() : api.reports()), mod ? "mod" : "mine");

  return (
    <Screen maxWidth={560}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[4] }}>
        <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/settings"))} />
        <Text style={[type.h1, { color: c.ink, flex: 1 }]}>{mod ? "All reports" : "My reports"}</Text>
      </View>
      {error && !data ? (
        <ErrorState message={error} onRetry={retry} />
      ) : loading && !data ? (
        <View style={{ gap: space[3] }}>
          <Pulse style={{ height: 106 }} />
          <Pulse style={{ height: 106 }} />
        </View>
      ) : data && data.length === 0 ? (
        <EmptyState icon="flag" title="No reports yet" body="When you find a copy of what you made, report it and follow it here." action={<Button label="Report a copy" onPress={() => router.push("/report")} />} />
      ) : (
        <View style={{ gap: space[3] }}>
          {data?.map((r) => (
            <Row key={r.id} r={r} mod={mod} onChange={(n) => setData((d) => d && d.map((x) => (x.id === n.id ? { ...x, ...n } : x)))} />
          ))}
          {isMod && !mod && <Button label="Review all reports" kind="secondary" icon="shield" onPress={() => router.push({ pathname: "/reports", params: { all: "1" } })} style={{ alignSelf: "flex-start" }} />}
        </View>
      )}
    </Screen>
  );
}
