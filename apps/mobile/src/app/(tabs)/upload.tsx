import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Icon } from "@/components/Icon";
import { VideoPreview } from "@/components/Media";
import { Banner, Button, type PS } from "@/components/ui";
import { api } from "@/lib/api";
import { alpha, radius, space, type } from "@/lib/theme";
import { ApiError, PickedFile } from "@/lib/types";
import { useTheme } from "@/state/theme";

const MAX = 10;
const MAX_VIDEO_SECONDS = 600;
const MB = 1024 * 1024;

export default function Upload() {
  const router = useRouter();
  const { c } = useTheme();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], allowsMultipleSelection: true, selectionLimit: MAX - files.length, quality: 0.8, videoMaxDuration: MAX_VIDEO_SECONDS, videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
    if (res.canceled) return;
    const next: PickedFile[] = [];
    for (const a of res.assets) {
      const kind = a.type === "video" ? "video" : "image";
      const mimeType = a.mimeType ?? (kind === "video" ? "video/mp4" : "image/jpeg");
      const fileSize = a.fileSize ?? 0;
      const seconds = a.duration ? a.duration / 1000 : undefined;
      if (kind === "video" && seconds && seconds > MAX_VIDEO_SECONDS) {
        setError(`${a.fileName ?? "That video"} is too long. Videos can be up to 10 minutes.`);
        continue;
      }
      if (fileSize > (kind === "video" ? 2048 : 20) * MB) {
        setError(`${a.fileName ?? "That file"} is too big. Photos can be up to 20 MB and videos up to 2 GB.`);
        continue;
      }
      next.push({ uri: a.uri, mimeType, fileSize, width: a.width, height: a.height, kind, seconds });
    }
    setFiles((f) => [...f, ...next].slice(0, MAX));
  };

  const post = async () => {
    setError(null);
    try {
      const ids: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const label = files.length > 1 ? `Uploading ${i + 1} of ${files.length}` : "Uploading";
        setBusy(label);
        ids.push((await api.uploadMedia(files[i], (share) => setBusy(`${label} · ${Math.round(share * 100)}%`))).id);
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
      <View style={{ paddingBottom: space[5], paddingTop: space[2] }}>
        <Text style={[type.h1, { color: c.ink }]}>New post</Text>
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

      <View style={{ gap: space[2], marginTop: space[5] }}>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Write a caption"
          placeholderTextColor={c.ink3}
          selectionColor={c.sun}
          multiline
          maxLength={500}
          style={[{ minHeight: 112, borderRadius: radius.field, backgroundColor: c.sunk, padding: space[4], fontFamily: type.body.fontFamily, fontSize: 16, lineHeight: 24, color: c.ink, textAlignVertical: "top" }, { outlineStyle: "none" } as object]}
        />
      </View>

      {error && <View style={{ marginTop: space[4] }}><Banner text={error} /></View>}
      <View style={{ marginTop: space[5] }}>
        <Button label={busy ?? "Post"} size="lg" busy={!!busy} disabled={files.length === 0} onPress={post} />
      </View>
    </Screen>
  );
}
