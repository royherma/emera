import { Linking, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { FundSkeleton, Header, mono, NotHere, Row, Section } from "@/components/FundParts";
import { Screen } from "@/components/Screen";
import { ErrorState } from "@/components/ui";
import { api } from "@/lib/api";
import brand from "@/lib/brand";
import { count, fundRules, isFundOff, money, monthName, percent } from "@/lib/fund";
import { radius, space, type } from "@/lib/theme";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";
import type { FundStatement } from "@/lib/types";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const nextMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

export default function Statement() {
  const { month } = useLocalSearchParams<{ month: string }>();
  const valid = MONTH_RE.test(month ?? "");
  const { data, error, retry } = useResource(async () => {
    if (!valid) return { off: true as const };
    try {
      return { statement: await api.fundMonth(month) };
    } catch (e) {
      if (isFundOff(e)) return { off: true as const };
      throw e;
    }
  }, `fund:${month}`);
  return (
    <Screen maxWidth={560}>
      <Header title={valid ? monthName(month) : "Statement"} fallback="/fund" />
      {error && !data ? <ErrorState message={error} onRetry={retry} /> : !data ? <FundSkeleton /> : "off" in data ? <NotHere /> : <Body s={data.statement} />}
    </Screen>
  );
}

function Body({ s }: { s: FundStatement }) {
  const { c } = useTheme();
  const paid = s.shares.reduce((a, x) => a + x.amountCents, 0);
  const closeDay = fundRules()?.closeDay ?? 3;
  const status = s.status === "closed" && s.closedAt ? `Closed ${new Date(s.closedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} · rules v${s.rulesVersion}` : `Live numbers. Final on ${monthName(nextMonth(s.month), false)} ${closeDay}`;
  return (
    <View style={{ gap: space[6] }}>
      <Text style={[type.meta, { color: c.ink2, marginTop: -space[3] }]}>{status}</Text>

      <Section title="Money">
        <Row label="Sponsored" value={money(s.sponsoredCents, true)} />
        <Row label="Carried in" sub={s.carryInCents ? "Cents left over from last month" : undefined} value={money(s.carryInCents, true)} />
        <Row label="To creators" value={money(s.creatorPoolCents, true)} />
        <Row label={`Runs ${brand.name}`} value={money(s.emeraCents, true)} />
        <Row label="Paid to creators" sub={`${count(s.totalSeconds)} seconds watched`} value={money(paid, true)} />
        <Row label="Carried out" sub="Goes into next month's creator share" value={money(s.carryOutCents, true)} />
      </Section>

      {s.sponsorships.length > 0 && (
        <Section title="Sponsors">
          {s.sponsorships.map((x) => (
            <Row
              key={x.id}
              label={x.sponsorName}
              sub={x.status === "refunded" ? "Refunded, not counted" : x.status === "pledged" ? "Pledged, not counted yet" : x.sponsorUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              value={money(x.amountCents)}
              onPress={x.sponsorUrl ? () => void Linking.openURL(x.sponsorUrl!) : undefined}
            />
          ))}
        </Section>
      )}

      {s.shares.length > 0 && (
        <Section title={`${count(s.shares.length)} creators`}>
          {s.shares.map((x, i) => (
            <Row
              key={`${x.handle ?? "anon"}-${i}`}
              left={<Text style={[type.meta, { width: 22, color: c.ink3, fontVariant: ["tabular-nums"] }]}>{i + 1}</Text>}
              label={x.handle ? `@${x.handle}` : "A creator"}
              sub={`${count(x.seconds)} s · ${percent(x.sharePpm)}`}
              value={money(x.amountCents, true)}
            />
          ))}
        </Section>
      )}

      {s.sha256 && (
        <Section title="Fingerprint">
          <View style={{ backgroundColor: c.sunk, borderRadius: radius.field, paddingVertical: space[3], paddingHorizontal: space[4], gap: space[1] }}>
            <Text selectable style={{ fontFamily: mono, fontSize: 11.5, lineHeight: 17, color: c.ink }}>{s.sha256}</Text>
            <Text style={[type.meta, { fontSize: 11, color: c.ink3 }]}>SHA-256 of this statement. Anyone can recompute it.</Text>
          </View>
        </Section>
      )}
    </View>
  );
}
