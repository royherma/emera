import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { FundSkeleton, Header, LinkRow, NotHere, Row, Section, tabular } from "@/components/FundParts";
import { MediaImage } from "@/components/Media";
import { Screen } from "@/components/Screen";
import { ErrorState, type PS } from "@/components/ui";
import { api } from "@/lib/api";
import { duration, isFundOff, loadFund, money, monthName, nextPayout, percent } from "@/lib/fund";
import { radius, space, type } from "@/lib/theme";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";
import type { Earnings as EarningsData } from "@/lib/types";

async function fetchEarnings() {
  try {
    const [earnings, fund] = await Promise.all([api.earnings(), loadFund()]);
    return { earnings, poolCents: fund.month.creatorPoolCents };
  } catch (e) {
    if (isFundOff(e)) return { off: true as const };
    throw e;
  }
}

export default function Earnings() {
  const router = useRouter();
  const { data, error, retry, reload, refreshing } = useResource(fetchEarnings, "earnings");
  return (
    <Screen maxWidth={560} onRefresh={reload} refreshing={refreshing}>
      <Header title="Earnings" fallback="/me" />
      {error && !data ? (
        <ErrorState message={error} onRetry={retry} />
      ) : !data ? (
        <FundSkeleton />
      ) : "off" in data ? (
        <NotHere />
      ) : (
        <Body data={data.earnings} poolCents={data.poolCents} openFund={() => router.push("/fund")} openPost={(id) => router.push({ pathname: "/p/[id]", params: { id } })} />
      )}
    </Screen>
  );
}

function Body({ data, poolCents, openFund, openPost }: { data: EarningsData; poolCents: number; openFund: () => void; openPost: (id: string) => void }) {
  const { c } = useTheme();
  const { thisMonth, months, balanceCents, topPosts, rules } = data;
  const ready = balanceCents >= rules.payoutMinCents;
  return (
    <View style={{ gap: space[6] }}>
      <View style={{ gap: space[2] }}>
        <Text style={[type.meta, { color: c.ink2 }]}>{monthName(thisMonth.month, false)} so far</Text>
        <Text style={[type.hero, tabular, { color: c.ink }]}>{money(thisMonth.estimateCents, true)}</Text>
        <Text style={[type.body, { color: c.ink2 }]}>
          {thisMonth.seconds > 0 ? `You had ${percent(thisMonth.sharePpm)} of watch time this month. Creators share ${money(poolCents)}.` : `Creators share ${money(poolCents)} this month, split by how long people watch their posts.`}
        </Text>
      </View>

      {topPosts.length > 0 && (
        <Section title="Most watched">
          {topPosts.map(({ post, seconds }) => (
            <Pressable key={post.id} accessibilityRole="link" accessibilityLabel={`Open post, watched ${duration(seconds)}`} onPress={() => openPost(post.id)} style={({ hovered }: PS) => [{ flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: 6 }, hovered && { opacity: 0.85 }]}>
              <MediaImage media={post.media[0]} style={{ width: 44, height: 55, borderRadius: radius.tile - 4 }} playSize={18} />
              <Text numberOfLines={1} style={[type.bodySm, { flex: 1, color: c.ink }]}>{post.caption || "Untitled"}</Text>
              <Text style={[type.name, tabular, { color: c.ink2 }]}>{duration(seconds)}</Text>
            </Pressable>
          ))}
        </Section>
      )}

      <Section title="Balance">
        <Text style={[type.h1, tabular, { color: c.ink }]}>{money(balanceCents, true)}</Text>
        <Text style={[type.meta, { color: c.ink2 }]}>{ready ? `Paid to your bank in ${nextPayout()}` : `Paid out once it reaches ${money(rules.payoutMinCents)}`}</Text>
      </Section>

      {months.length > 0 && (
        <Section title="Past months">
          {months.map((m) => (
            <Row key={m.month} label={monthName(m.month)} sub={`${percent(m.sharePpm)} of watch time`} value={money(m.amountCents, true)} />
          ))}
        </Section>
      )}

      <LinkRow label="Where the money comes from" onPress={openFund} />
    </View>
  );
}
