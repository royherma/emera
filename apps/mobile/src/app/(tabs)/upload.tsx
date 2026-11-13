import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Icon } from "@/components/Icon";
import { ProofBadge } from "@/components/Grid";
import { Banner, Button, type PS } from "@/components/ui";
import { api } from "@/lib/api";
import { colors, font, radius, space, type } from "@/lib/theme";
import { ApiError, PickedFile } from "@/lib/types";
import { useAuth } from "@/state/auth";

const MAX = 10;
const MB = 1024 * 1024;

export default function Upload() {
  const router = useRouter();
  const { user } = useAuth();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [caption, setCaption] = useState("");
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
      for (let i = 0; i < files.length; i++) {
        setBusy(files.length > 1 ? `Uploading ${i + 1} of ${files.length}` : "Uploading");
        ids.push((await api.uploadMedia(files[i])).id);
      }
      setBusy("Signing and posting");
      const created = await api.createPost({ mediaIds: ids, caption });
      setFiles([]);
      setCaption("");
      router.push({ pathname: "/p/[id]", params: { id: created.id } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen tabs maxWidth={760}>
      <View style={{ gap: 6, paddingBottom: space[5] }}>
        <Text style={[type.h1, { color: colors.ink }]}>Share something</Text>
        <Text style={[type.body, { color: colors.muted }]}>Photos or video from your library. Your name and the time are signed into every upload.</Text>
      </View>

      {files.length === 0 ? (
        <Pressable
          onPress={pick}
          accessibilityRole="button"
          style={({ hovered }: PS) => ({ height: 280, borderRadius: radius.lg, borderWidth: 2, borderStyle: "dashed", borderColor: hovered ? colors.ink : colors.lineStrong, backgroundColor: hovered ? colors.surface : colors.sunk, alignItems: "center", justifyContent: "center", gap: space[3] })}
        >
          <View style={{ width: 64, height: 64, borderRadius: 99, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Icon name="image" size={28} color={colors.accent} />
          </View>
          <Text style={{ fontFamily: font.semibold, fontSize: 17, color: colors.ink }}>Choose photos or video</Text>
          <Text style={[type.small, { color: colors.muted }]}>Up to {MAX} items. Photos 25 MB, videos 200 MB.</Text>
        </Pressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[3] }}>
          {files.map((f, i) => (
            <View key={f.uri + i} style={{ width: 180, height: 225, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.ink }}>
              {f.kind === "image" ? <Image source={{ uri: f.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Icon name="play" size={30} color="#fff" /></View>}
              <Pressable accessibilityLabel="Remove" onPress={() => setFiles((all) => all.filter((_, j) => j !== i))} style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}>
                <Icon name="x" size={16} color="#fff" />
              </Pressable>
            </View>
          ))}
          {files.length < MAX && (
            <Pressable onPress={pick} style={{ width: 180, height: 225, borderRadius: radius.md, borderWidth: 2, borderStyle: "dashed", borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Icon name="plus" size={26} color={colors.muted} />
              <Text style={[type.small, { color: colors.muted }]}>Add more</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      <View style={{ gap: space[2], marginTop: space[5] }}>
        <Text style={[type.label, { color: colors.muted }]}>Caption</Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Tell people about it"
          placeholderTextColor={colors.faint}
          multiline
          maxLength={500}
          style={[{ minHeight: 112, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, padding: space[4], fontFamily: font.regular, fontSize: 16, lineHeight: 24, color: colors.ink, textAlignVertical: "top" }, { outlineStyle: "none" } as object]}
        />
        <Text style={[type.small, { color: colors.faint, alignSelf: "flex-end" }]}>{caption.length}/500</Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], backgroundColor: colors.accent2Soft, borderRadius: radius.md, padding: space[4], marginTop: space[2] }}>
        <Icon name="shield" size={22} color={colors.accent2} />
        <View style={{ flex: 1, gap: 4 }}>
          {user && <ProofBadge handle={user.handle} />}
          <Text style={[type.small, { color: colors.muted }]}>This is how your post will show up. Anyone can check who made it and when.</Text>
        </View>
      </View>

      {error && <View style={{ marginTop: space[4] }}><Banner text={error} /></View>}
      <View style={{ marginTop: space[5] }}>
        <Button label={busy ?? "Post"} size="lg" busy={!!busy} disabled={files.length === 0} onPress={post} />
      </View>
    </Screen>
  );
}
