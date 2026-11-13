import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Banner, Button, Field, IconButton } from "@/components/ui";
import { api } from "@/lib/api";
import { radius, space, type } from "@/lib/theme";
import { ApiError, type PickedFile } from "@/lib/types";
import { useAuth } from "@/state/auth";
import { useTheme } from "@/state/theme";
import { useToast } from "@/state/toast";

const BIO_MAX = 280;
const LINKS_MAX = 5;
const MB = 1024 * 1024;

export default function EditProfile() {
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();
  const { user, finishHandle } = useAuth();
  const [name, setName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [links, setLinks] = useState<string[]>(user?.links?.length ? user.links : [""]);
  const [avatar, setAvatar] = useState<{ file: PickedFile } | { clear: true } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/me"));

  const pick = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (res.canceled) return;
    const a = res.assets[0];
    const fileSize = a.fileSize ?? 0;
    if (fileSize > 25 * MB) return setError("That photo is too big. Photos can be up to 25 MB.");
    setAvatar({ file: { uri: a.uri, mimeType: a.mimeType ?? "image/jpeg", fileSize, width: a.width, height: a.height, kind: "image" } });
  };

  const preview = !user ? null : avatar && "file" in avatar ? { ...user, avatarUrl: avatar.file.uri } : avatar ? { ...user, avatarUrl: null } : user;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const input: Parameters<typeof api.updateProfile>[0] = { displayName: name.trim(), bio: bio.trim(), links: links.map((l) => l.trim()).filter(Boolean) };
      if (avatar && "file" in avatar) input.avatarMediaId = (await api.uploadMedia(avatar.file)).id;
      else if (avatar) input.avatarMediaId = null;
      finishHandle(await api.updateProfile(input));
      toast("Profile saved");
      back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen maxWidth={560}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[4] }}>
        <IconButton icon="back" label="Back" onPress={back} />
        <Text style={[type.h1, { color: c.ink }]}>Edit profile</Text>
      </View>

      <View style={{ gap: space[5] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[4] }}>
          {preview ? <Avatar user={preview} size={88} /> : null}
          <View style={{ gap: space[2], alignItems: "flex-start" }}>
            <Button label="Change photo" icon="image" kind="secondary" onPress={pick} />
            {(preview?.avatarUrl ?? null) ? (
              <Pressable accessibilityRole="button" onPress={() => setAvatar({ clear: true })} hitSlop={8}>
                <Text style={[type.meta, { color: c.ink2 }]}>Remove photo</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Field label="Display name" value={name} onChangeText={setName} maxLength={50} autoCapitalize="words" />

        <View style={{ gap: 6 }}>
          <Text style={[type.label, { color: c.ink2, textTransform: "uppercase", letterSpacing: 0.8 }]}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="What you make, in a sentence"
            placeholderTextColor={c.ink3}
            selectionColor={c.sun}
            multiline
            maxLength={BIO_MAX}
            accessibilityLabel="Bio"
            style={[{ minHeight: 104, borderRadius: radius.field, backgroundColor: c.sunk, padding: space[4], fontFamily: type.body.fontFamily, fontSize: 16, lineHeight: 24, color: c.ink, textAlignVertical: "top" }, { outlineStyle: "none" } as object]}
          />
          <Text style={[type.meta, { color: c.ink3, alignSelf: "flex-end" }]}>{bio.length}/{BIO_MAX}</Text>
        </View>

        <View style={{ gap: space[2] }}>
          <Text style={[type.label, { color: c.ink2, textTransform: "uppercase", letterSpacing: 0.8 }]}>Links</Text>
          {links.map((l, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
              <View style={{ flex: 1 }}>
                <Field label={`Link ${i + 1}`} value={l} onChangeText={(v) => setLinks((all) => all.map((x, j) => (j === i ? v : x)))} placeholder="https://" autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={200} />
              </View>
              {links.length > 1 || l ? (
                <Pressable accessibilityLabel={`Remove link ${i + 1}`} onPress={() => setLinks((all) => (all.length > 1 ? all.filter((_, j) => j !== i) : [""]))} hitSlop={8} style={{ marginTop: 22 }}>
                  <Icon name="x" size={20} color={c.ink2} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {links.length < LINKS_MAX ? <Button label="Add a link" icon="plus" kind="secondary" onPress={() => setLinks((all) => [...all, ""])} style={{ alignSelf: "flex-start" }} /> : null}
        </View>

        {error && <Banner text={error} />}
        <Button label="Save" size="lg" busy={busy} disabled={!name.trim()} onPress={save} />
      </View>
    </Screen>
  );
}
