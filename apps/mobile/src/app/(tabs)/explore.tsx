import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Bento, GridSkeleton } from "@/components/Grid";
import { Icon } from "@/components/Icon";
import { Chip, EmptyState, ErrorState, Pulse } from "@/components/ui";
import { api } from "@/lib/api";
import { useLayout } from "@/lib/layout";
import { alpha, creatorColors, radius, space, type } from "@/lib/theme";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";

export default function Explore() {
  const { c } = useTheme();
  const { wide, column } = useLayout();
  const { data, error, loading, refreshing, reload, retry } = useResource(() => api.feed(), "explore");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [swatch, setSwatch] = useState<string | null>(null);

  const posts = data?.posts ?? [];
  const cats = useMemo(() => [...new Set(posts.map((p) => p.author.category).filter(Boolean) as string[])], [posts]);
  const swatches = useMemo(() => {
    const seen = new Set<string>();
    return posts.map((p) => creatorColors(p.author.handle).from).filter((h) => (seen.has(h) ? false : (seen.add(h), true))).slice(0, 8);
  }, [posts]);

  const needle = q.trim().toLowerCase();
  const shown = posts.filter(
    (p) =>
      (!cat || p.author.category === cat) &&
      (!swatch || creatorColors(p.author.handle).from === swatch) &&
      (!needle || [p.author.handle, p.author.displayName, p.caption, p.author.category ?? ""].some((s) => s.toLowerCase().includes(needle))),
  );
  const filtering = !!(needle || cat || swatch);

  return (
    <Screen tabs onRefresh={reload} refreshing={refreshing} maxWidth={wide ? column + 64 : undefined}>
      <View style={{ width: column, alignSelf: "center", gap: space[4] }}>
        <View style={{ height: 46, borderRadius: radius.field + 1, backgroundColor: c.sunk, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, marginTop: space[1] }}>
          <Icon name="search" size={19} color={c.ink3} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search people and work"
            placeholderTextColor={c.ink3}
            selectionColor={c.sun}
            accessibilityLabel="Search"
            autoCapitalize="none"
            autoCorrect={false}
            style={[{ flex: 1, height: 46, fontFamily: type.name.fontFamily, fontSize: 15, color: c.ink }, { outlineStyle: "none" } as object]}
          />
          {q ? (
            <Pressable accessibilityLabel="Clear search" onPress={() => setQ("")} hitSlop={10}>
              <Icon name="x" size={18} color={c.ink2} />
            </Pressable>
          ) : null}
        </View>

        {cats.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 7 }}>
            <Chip label="All" active={!cat} onPress={() => setCat(null)} />
            {cats.map((k) => {
              const owner = posts.find((p) => p.author.category === k)!;
              return <Chip key={k} label={k} color={creatorColors(owner.author.handle).from} active={cat === k} onPress={() => setCat(cat === k ? null : k)} />;
            })}
          </ScrollView>
        )}

        {swatches.length > 1 && (
          <View style={{ gap: space[2] }}>
            <Text style={[type.section, { color: c.ink }]}>Colors of today</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {swatches.map((h) => (
                <Pressable key={h} accessibilityRole="button" accessibilityLabel="Filter by this color" accessibilityState={{ selected: swatch === h }} onPress={() => setSwatch(swatch === h ? null : h)} style={{ flex: 1, height: 30, borderRadius: 10, backgroundColor: h, borderWidth: 2, borderColor: swatch === h ? c.ink : "transparent" }} />
              ))}
            </View>
          </View>
        )}

        <Text style={[type.section, { color: c.ink }]}>{filtering ? "Results" : "Fresh work"}</Text>
        {error && !data ? (
          <ErrorState message={error} onRetry={retry} />
        ) : loading || !data ? (
          <GridSkeleton width={column} rows={3} gap={5} />
        ) : shown.length === 0 ? (
          <EmptyState icon="search" title="Nothing matches" body="Try another word, or clear a filter." />
        ) : (
          <Bento posts={shown} width={column} />
        )}
      </View>
    </Screen>
  );
}
