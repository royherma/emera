import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Icon } from "@/components/Icon";
import { SignedMark, VideoPreview } from "@/components/Media";
import { Banner, Button, type PS } from "@/components/ui";
import { api } from "@/lib/api";
import { alpha, radius, space, type } from "@/lib/theme";
import { ApiError, PickedFile } from "@/lib/types";
import { useAuth } from "@/state/auth";
import { useTheme } from "@/state/theme";

const MAX = 10;
const MB = 1024 * 1024;

export default function Upload() {
  const router = useRouter();
  const { user } = useAuth();
  const { c } = useTheme();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [caption, setCaption] = useState("");
  const [alts, setAlts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], allowsMultipleSelection: true, selectionLimit: MAX - files.length, quality: 1 });
    if (res.canceled) return;
    const next: PickedFile[] = [];
    for (const a of res.assets) {
      const kind = a.type === "video" ? "video" : "image";
      const mimeType = a.mimeType ?? (kind === "video" ? "video/mp4" : "image/jpeg");
      const fileSize = a.fileSize ?? 0;
      if (fileSize > (kind === "video" ? 200 : 25) * MB) {
        setError(`${a.fileName ?? "That file"} is too big. Photos can be up to 25 MB and videos up to 200 MB.`);
        continue;
      }
      next.push({ uri: a.uri, mimeType, fileSize, width: a.width, height: a.height, kind });
    }
    setFiles((f) => [...f, ...next].slice(0, MAX));
  };

  const post = async () => {
    setError(null);
    try {
      const ids: string[] = [];
      const alt: Record<string, string> = {};
      for (let i = 0; i < files.length; i++) {
        setBusy(files.length > 1 ? `Uploading ${i + 1} of ${files.length}` : "Uploading");
        const id = (await api.uploadMedia(files[i])).id;
        ids.push(id);
        const text = (alts[files[i].uri] ?? "").trim();
        if (text) alt[id] = text;
      }
      setBusy("Signing and posting");
      const created = await api.createPost({ mediaIds: ids, caption, alt });
      setFiles([]);
      setCaption("");
      setAlts({});
      router.push({ pathname: "/p/[id]", params: { id: created.id } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen tabs maxWidth={760}>
      <View style={{ gap: 6, paddingBottom: space[5], paddingTop: space[2] }}>
        <Text style={[type.h1, { color: c.ink }]}>Share something</Text>
        <Text style={[type.body, { color: c.ink2 }]}>Photos or video from your library. Your name and the time are signed into every upload.</Text>
      </View>

      {files.length === 0 ? (
        <Pressable
          onPress={pick}
          accessibilityRole="button"
          style={({ hovered }: PS) => ({ height: 260, borderRadius: radius.media, borderWidth: 1.5, borderStyle: "dashed", borderColor: hovered ? c.sun : c.ink3, backgroundColor: hovered ? c.surface : c.sunk, alignItems: "center", justifyContent: "center", gap: space[3] })}
        >
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: alpha(c.sun, 0.16), alignItems: "center", justifyContent: "center" }}>
            <Icon name="image" size={26} color={c.sunInk} />
          </View>
          <Text style={[type.title, { color: c.ink }]}>Choose photos or video</Text>
          <Text style={[type.meta, { color: c.ink2 }]}>Up to {MAX} items. Photos 25 MB, videos 200 MB.</Text>
        </Pressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[3] }}>
          {files.map((f, i) => (
            <View key={f.uri + i} style={{ width: 168, height: 210, borderRadius: radius.card, overflow: "hidden", backgroundColor: c.sunk }}>
              {f.kind === "image" ? <Image source={{ uri: f.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <VideoPreview uri={f.uri} style={{ width: "100%", height: "100%" }} />}
              <Pressable accessibilityLabel="Remove" onPress={() => setFiles((all) => all.filter((_, j) => j !== i))} hitSlop={8} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(14,10,8,0.66)", alignItems: "center", justifyContent: "center" }}>
                <Icon name="x" size={16} color="#fff" />
              </Pressable>
            </View>
          ))}
          {files.length < MAX && (
            <Pressable onPress={pick} style={{ width: 168, height: 210, borderRadius: radius.card, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.ink3, alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Icon name="plus" size={24} color={c.ink2} />
              <Text style={[type.meta, { color: c.ink2 }]}>Add more</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {files.length > 0 && (
        <View style={{ gap: space[3], marginTop: space[5] }}>
          <Text style={[type.label, { color: c.ink2, textTransform: "uppercase", letterSpacing: 0.8 }]}>Description for people who can't see it</Text>
          {files.some((f) => !(alts[f.uri] ?? "").trim()) && <Banner tone="info" text="A sentence about what is in each one helps blind and low-vision people, and makes your work easier to find." />}
          {files.map((f, i) => (
            <View key={f.uri + i} style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
              <View style={{ width: 52, height: 52, borderRadius: radius.tile - 6, overflow: "hidden", backgroundColor: c.sunk, alignItems: "center", justifyContent: "center" }}>
                {f.kind === "image" ? <Image source={{ uri: f.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Icon name="play" size={18} color={c.ink2} />}
              </View>
              <TextInput
                value={alts[f.uri] ?? ""}
                onChangeText={(v) => setAlts((a) => ({ ...a, [f.uri]: v }))}
                placeholder={f.kind === "image" ? "Describe what is in this photo" : "Describe what happens in this video"}
                placeholderTextColor={c.ink3}
                selectionColor={c.sun}
                maxLength={1000}
                accessibilityLabel={`Description for item ${i + 1}`}
                style={[{ flex: 1, height: 52, borderRadius: radius.field, backgroundColor: c.sunk, paddingHorizontal: space[4], fontFamily: type.body.fontFamily, fontSize: 15, color: c.ink }, { outlineStyle: "none" } as object]}
              />
            </View>
          ))}
        </View>
      )}

      <View style={{ gap: space[2], marginTop: space[5] }}>
        <Text style={[type.label, { color: c.ink2, textTransform: "uppercase", letterSpacing: 0.8 }]}>Caption</Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Tell people about it"
          placeholderTextColor={c.ink3}
          selectionColor={c.sun}
          multiline
          maxLength={500}
          style={[{ minHeight: 112, borderRadius: radius.field, backgroundColor: c.sunk, padding: space[4], fontFamily: type.body.fontFamily, fontSize: 16, lineHeight: 24, color: c.ink, textAlignVertical: "top" }, { outlineStyle: "none" } as object]}
        />
        <Text style={[type.meta, { color: c.ink3, alignSelf: "flex-end" }]}>{caption.length}/500</Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], backgroundColor: c.surface, borderWidth: 1, borderColor: c.hair, borderRadius: radius.proof, padding: space[3], marginTop: space[2] }}>
        <View style={{ borderRadius: 13, backgroundColor: "#140f0b", padding: 4 }}>
          <SignedMark />
        </View>
        <Text style={[type.bodySm, { flex: 1, color: c.ink2 }]}>Signed with {user ? user.displayName : "your name"} and the time. Anyone can check who made it and when.</Text>
      </View>

      {error && <View style={{ marginTop: space[4] }}><Banner text={error} /></View>}
      <View style={{ marginTop: space[5] }}>
        <Button label={busy ?? "Post"} size="lg" busy={!!busy} disabled={files.length === 0} onPress={post} />
      </View>
    </Screen>
  );
}
