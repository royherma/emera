import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Screen } from "@/components/Screen";
import { Banner, Button, IconButton } from "@/components/ui";
import { api } from "@/lib/api";
import brand from "@/lib/brand";
import { API_URL, MOCK } from "@/lib/config";
import { copyText, shareLink } from "@/lib/share";
import { colors, font, radius, space, type } from "@/lib/theme";
import { ApiError } from "@/lib/types";
import { useAuth } from "@/state/auth";
import { useToast } from "@/state/toast";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space[3], paddingVertical: space[4] }}>
      <Text style={[type.label, { color: colors.muted }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function Settings() {
  const router = useRouter();
  const toast = useToast();
  const { user, signOut } = useAuth();
  const [invite, setInvite] = useState<{ code: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeInvite = async () => {
    setBusy(true);
    setError(null);
    try {
      setInvite(await api.createInvite());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen maxWidth={640}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[4] }}>
        <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/me"))} />
        <Text style={[type.h1, { color: colors.ink }]}>Settings</Text>
      </View>

      {user && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[4], borderWidth: 1, borderColor: colors.line }}>
          <Avatar user={user} size={56} />
          <View>
            <Text style={{ fontFamily: font.semibold, fontSize: 17, color: colors.ink }}>{user.displayName}</Text>
            <Text style={[type.small, { color: colors.muted }]}>@{user.handle}</Text>
          </View>
        </View>
      )}

      <Section title="Invite a friend">
        <Text style={[type.body, { color: colors.muted }]}>Make a link and send it to someone whose work you love.</Text>
        {invite ? (
          <View style={{ gap: space[3], backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space[4] }}>
            <Text selectable style={{ fontFamily: font.display, fontSize: 30, letterSpacing: 2, color: colors.ink }}>{invite.code}</Text>
            <Text selectable style={[type.small, { color: colors.muted }]}>{invite.url}</Text>
            <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
              <Button label="Copy link" icon="copy" kind="secondary" onPress={async () => (await copyText(invite.url), toast("Invite link copied"))} />
              <Button label="Share" icon="share" kind="secondary" onPress={async () => (await shareLink(invite.url, `Join me on ${brand.name}`)) === "copied" && toast("Invite link copied")} />
            </View>
          </View>
        ) : (
          <Button label="Make an invite link" icon="userplus" busy={busy} onPress={makeInvite} style={{ alignSelf: "flex-start" }} />
        )}
        {error && <Banner text={error} />}
      </Section>

      <View style={{ height: 1, backgroundColor: colors.line }} />
      <Section title="Account">
        <Button label="Sign out" icon="logout" kind="secondary" onPress={signOut} style={{ alignSelf: "flex-start" }} />
      </Section>

      <View style={{ height: 1, backgroundColor: colors.line }} />
      <Section title="About">
        <Text style={[type.body, { color: colors.ink }]}>{brand.name}: {brand.tagline}</Text>
        <Text style={[type.small, { color: colors.muted }]}>Open source and nonprofit. {MOCK ? "Preview mode: everything stays on this device and resets when you reload." : `Connected to ${API_URL}`}</Text>
      </Section>
    </Screen>
  );
}
