import { useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Art } from "@/components/Art";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Banner, Button, Chip, Field, IconButton, Pulse, Segmented } from "@/components/ui";
import { api } from "@/lib/api";
import { API_URL, MOCK } from "@/lib/config";
import { copyText } from "@/lib/share";
import { radius, space, type } from "@/lib/theme";
import { ApiError, type ImportItem, type ImportRules, type ImportSource } from "@/lib/types";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";
import { useToast } from "@/state/toast";

const MCP_URL = `${MOCK || !API_URL ? "https://api.emera.social" : API_URL.replace(/\/$/, "")}/mcp`;
const message = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Try again.");
const ruleText = (r: ImportRules) => `${r.media === "photos" ? "Photo posts" : r.media === "videos" ? "Video posts" : "New posts"}${r.tag ? ` tagged #${r.tag}` : ""} come over every 15 minutes`;

function Rules({ value, onChange }: { value: ImportRules; onChange: (r: ImportRules) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space[2] }}>
      <Segmented
        value={value.media}
        onChange={(media) => onChange({ ...value, media })}
        options={[{ value: "any", label: "Everything" }, { value: "photos", label: "Photos" }, { value: "videos", label: "Videos" }]}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], borderWidth: 1, borderColor: c.hair, borderRadius: radius.card, paddingHorizontal: space[3], backgroundColor: c.surface }}>
        <Text style={[type.body, { color: c.ink3 }]}>Only posts tagged #</Text>
        <TextInput
          value={value.tag ?? ""}
          onChangeText={(t) => onChange({ ...value, tag: t.replace(/[^\p{L}\p{N}_]/gu, "").slice(0, 50) || undefined })}
          placeholder="anything"
          placeholderTextColor={c.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          style={[type.body, { color: c.ink, flex: 1, paddingVertical: space[3] }]}
        />
      </View>
    </View>
  );
}

export default function Connect() {
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();
  const sources = useResource(() => api.sources(), "sources");
  const connectors = useResource(() => api.connectors(), "connectors");
  const [from, setFrom] = useState("");
  const [hint, setHint] = useState("@you.bsky.social, or a Mastodon, Pixelfed or blog link");
  const [preview, setPreview] = useState<{ from: string; label: string; items: ImportItem[] } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [auto, setAuto] = useState(true);
  const [rules, setRules] = useState<ImportRules>({ media: "any" });
  const [busy, setBusy] = useState<"look" | "bring" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const look = async () => {
    if (!from.trim()) return;
    setBusy("look");
    setError(null);
    setPreview(null);
    try {
      const r = await api.importPreview(from.trim());
      setPreview({ from: from.trim(), ...r });
      setPicked(new Set(r.items.filter((i) => !i.onEmera).map((i) => i.id)));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };

  const flip = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bring = async () => {
    if (!preview) return;
    setBusy("bring");
    setError(null);
    try {
      const r = await api.importPosts({ from: preview.from, only: [...picked], autoPost: auto, rules: auto ? rules : undefined });
      toast(r.imported ? `${r.imported} post${r.imported === 1 ? "" : "s"} added to your profile` : auto ? "Auto-post is on" : "Nothing new to bring over");
      setPreview(null);
      setFrom("");
      await sources.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };

  const update = async (s: ImportSource, on: boolean, r?: ImportRules) => {
    try {
      await api.setSource(s.from, on, r);
      await sources.reload();
    } catch (e) {
      toast(message(e));
    }
  };

  const remove = async (id: string) => {
    await api.removeSource(id).catch(() => {});
    await sources.reload();
  };

  const n = picked.size;
  return (
    <Screen maxWidth={640}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[4] }}>
        <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/settings"))} />
        <Text style={[type.h1, { color: c.ink }]}>Bring your posts</Text>
      </View>

      <View style={{ gap: space[3] }}>
        <Text style={[type.body, { color: c.ink2 }]}>Your photos, videos, captions and dates come with them.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
          {(connectors.data?.connectors ?? []).map((k) => (
            <Chip key={k.id} label={k.id === "feed" ? "Blog or feed" : k.name} onPress={() => setHint(k.example)} />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: space[2], alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}>
          <Field
            label="Where your posts are"
            placeholder={hint}
            value={from}
            onChangeText={setFrom}
            onSubmitEditing={look}
            autoCapitalize="none"
            autoCorrect={false}
          />
          </View>
          <Button label="Look" busy={busy === "look"} onPress={look} disabled={!from.trim()} />
        </View>
        {error && <Banner text={error} />}
      </View>

      {busy === "look" && (
        <View style={{ flexDirection: "row", gap: space[2], marginTop: space[4] }}>
          {[0, 1, 2].map((i) => <Pulse key={i} style={{ flex: 1, aspectRatio: 1, borderRadius: radius.card }} />)}
        </View>
      )}

      {preview && (
        <View style={{ gap: space[3], marginTop: space[4] }}>
          <Text style={[type.section, { color: c.ink }]}>{preview.items.length ? `Tap to leave any out` : `No photos or videos at ${preview.label}`}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {preview.items.map((it) => {
              const on = picked.has(it.id);
              return (
                <Pressable
                  key={it.id}
                  disabled={!!it.onEmera}
                  onPress={() => flip(it.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={it.caption.slice(0, 80) || "Post"}
                  style={{ width: "31%", aspectRatio: 1, borderRadius: radius.card, overflow: "hidden", backgroundColor: c.surface, opacity: it.onEmera ? 0.35 : on ? 1 : 0.5 }}
                >
                  {it.thumb?.startsWith("mock:") ? <Art seed={it.thumb} /> : it.thumb ? <Image source={{ uri: it.thumb }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={180} /> : <Text style={[type.meta, { color: c.ink3, padding: space[2] }]} numberOfLines={4}>{it.caption || "Video"}</Text>}
                  {it.onEmera ? (
                    <Text style={[type.label, { position: "absolute", bottom: 6, left: 8, color: "#fff" }]}>ON EMERA</Text>
                  ) : (
                    <View style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.ink : "rgba(0,0,0,0.25)", borderWidth: 1.5, borderColor: "#fff" }}>
                      {on && <Icon name="check" size={14} color="#fff" strokeWidth={2.4} />}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          {preview.items.some((i) => !i.onEmera) && (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
                <Text style={[type.body, { color: c.ink, flex: 1 }]}>Keep posting new ones automatically</Text>
                <Switch value={auto} onValueChange={setAuto} accessibilityLabel="Keep posting new ones automatically" />
              </View>
              {auto && <Rules value={rules} onChange={setRules} />}
              <Button label={n ? `Bring over ${n} post${n === 1 ? "" : "s"}` : auto ? "Just auto-post new ones" : "Pick at least one"} icon="plus" size="lg" busy={busy === "bring"} disabled={!n && !auto} onPress={bring} />
            </>
          )}
        </View>
      )}

      {(sources.data?.length ?? 0) > 0 && (
        <View style={{ gap: space[2], marginTop: space[5] }}>
          <Text style={[type.section, { color: c.ink }]}>Posting automatically</Text>
          {sources.data!.map((s) => (
            <View key={s.id} style={{ gap: space[3], backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.hair, padding: space[3] }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.name, { color: c.ink }]} numberOfLines={1}>{s.label}</Text>
                  <Text style={[type.meta, { color: s.lastError ? c.sunInk : c.ink3 }]} numberOfLines={1}>{s.lastError ? `Last check failed: ${s.lastError}` : s.autoPost ? ruleText(s.rules) : "Off"}</Text>
                </View>
                <Switch value={s.autoPost} onValueChange={(on) => update(s, on)} accessibilityLabel={`Auto-post from ${s.label}`} />
                <IconButton icon="trash" label={`Remove ${s.label}`} onPress={() => remove(s.id)} filled={false} />
              </View>
              {s.autoPost && <Rules value={s.rules} onChange={(r) => update(s, true, r)} />}
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 1, backgroundColor: c.hair, marginVertical: space[5] }} />
      <View style={{ gap: space[3] }}>
        <Text style={[type.section, { color: c.ink }]}>Or ask Claude or ChatGPT</Text>
        <Text style={[type.body, { color: c.ink2 }]}>Add Emera as a connector, sign in, then ask it to bring your posts over or post for you.</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.hair, paddingLeft: space[3] }}>
          <Text selectable style={[type.bodySm, { color: c.ink, flex: 1 }]} numberOfLines={1}>{MCP_URL}</Text>
          <IconButton icon="copy" label="Copy connector link" onPress={async () => (await copyText(MCP_URL), toast("Connector link copied"))} filled={false} />
        </View>
        {(connectors.data?.locked.length ?? 0) > 0 && (
          <Text style={[type.meta, { color: c.ink3 }]}>{connectors.data!.locked.map((l) => l.name).join(", ")} do not let other apps read your posts.</Text>
        )}
      </View>
    </Screen>
  );
}
