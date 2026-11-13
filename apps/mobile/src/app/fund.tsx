import { Linking, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { FundSkeleton, Header, NotHere, Row, Section, tabular } from "@/components/FundParts";
import { Screen } from "@/components/Screen";
import { ErrorState } from "@/components/ui";
import brand from "@/lib/brand";
import { count, duration, isFundOff, loadFund, money, monthName } from "@/lib/fund";
import { alpha, radius, space, type } from "@/lib/theme";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";
import type { Fund as FundData } from "@/lib/types";

async function fetchFund() {
  try {
    return { fund: await loadFund() };
  } catch (e) {
    if (isFundOff(e)) return { off: true as const };
    throw e;
  }
}

const prevMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

export default function Fund() {
  const { data, error, retry, reload, refreshing } = useResource(fetchFund, "fund");
  return (
    <Screen maxWidth={560} onRefresh={reload} refreshing={refreshing}>
      <Header title={`${brand.name} fund`} fallback="/" />
      {error && !data ? <ErrorState message={error} onRetry={retry} /> : !data ? <FundSkeleton /> : "off" in data ? <NotHere /> : <Body fund={data.fund} />}
    </Screen>
  );
}

function Body({ fund }: { fund: FundData }) {
  const router = useRouter();
  const { c } = useTheme();
  const { month, sponsors, history } = fund;
  const creatorCents = month.creatorPoolCents - month.carryInCents;
  const total = creatorCents + month.emeraCents;
  return (
    <View style={{ gap: space[6] }}>
      <View style={{ gap: space[2] }}>
        <Text style={[type.meta, { color: c.ink2 }]}>{monthName(month.month)} so far</Text>
        <Text style={[type.hero, tabular, { color: c.ink }]}>{money(month.sponsoredCents)}</Text>
        <Text style={[type.body, { color: c.ink2 }]}>
          From {month.sponsors} {month.sponsors === 1 ? "sponsor" : "sponsors"}. Half goes to the creators people watch, half runs {brand.name}.
        </Text>
      </View>

      <View style={{ gap: space[3] }}>
        <View accessibilityLabel={`${money(month.creatorPoolCents, true)} to creators, ${money(month.emeraCents, true)} runs ${brand.name}`} style={{ flexDirection: "row", height: 12, borderRadius: radius.pill, overflow: "hidden", gap: 3 }}>
          <View style={{ flex: total ? creatorCents : 1, backgroundColor: c.sun }} />
          <View style={{ flex: total ? month.emeraCents : 1, backgroundColor: alpha(c.ink, 0.22) }} />
        </View>
        <View style={{ flexDirection: "row", gap: space[4] }}>
          <Split dot={c.sun} label="To creators" value={money(month.creatorPoolCents, true)} sub={month.carryInCents ? `${money(month.carryInCents, true)} carried in from ${monthName(prevMonth(month.month), false)}` : undefined} />
          <Split dot={alpha(c.ink, 0.22)} label={`Runs ${brand.name}`} value={money(month.emeraCents, true)} sub="Servers and the takedown desk" />
        </View>
        <Text style={[type.meta, { color: c.ink2 }]}>
          {duration(month.totalSeconds)} watched across {count(month.creators)} creators
        </Text>
      </View>

      {sponsors.length > 0 && (
        <Section title="Sponsors">
          {sponsors.map((s) => (
            <Row key={s.name} label={s.name} sub={s.url ? s.url.replace(/^https?:\/\//, "").replace(/\/$/, "") : undefined} value={money(s.amountCents)} onPress={s.url ? () => void Linking.openURL(s.url!) : undefined} />
          ))}
        </Section>
      )}

      {history.length > 0 && (
        <Section title="Past months">
          {history.map((m) => (
            <Row
              key={m.month}
              label={monthName(m.month)}
              sub={`${money(m.creatorPoolCents, true)} to ${count(m.creators)} creators`}
              value={money(m.sponsoredCents)}
              onPress={() => router.push({ pathname: "/fund/[month]", params: { month: m.month } })}
            />
          ))}
        </Section>
      )}
    </View>
  );
}

function Split({ dot, label, value, sub }: { dot: string; label: string; value: string; sub?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
        <Text style={[type.meta, { color: c.ink2 }]}>{label}</Text>
      </View>
      <Text style={[type.stat, tabular, { color: c.ink }]}>{value}</Text>
      {sub ? <Text style={[type.meta, { fontSize: 11, color: c.ink3 }]}>{sub}</Text> : null}
    </View>
  );
}
