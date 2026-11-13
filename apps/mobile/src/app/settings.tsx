import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Screen } from "@/components/Screen";
import { Banner, Button, IconButton, Segmented } from "@/components/ui";
import { api } from "@/lib/api";
import brand from "@/lib/brand";
import { API_URL, MOCK } from "@/lib/config";
import { copyText, shareLink } from "@/lib/share";
import { radius, space, type } from "@/lib/theme";
import { ApiError } from "@/lib/types";
import { useAuth } from "@/state/auth";
import { useTheme } from "@/state/theme";
import { useToast } from "@/state/toast";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space[3], paddingVertical: space[4] }}>
      <Text style={[type.section, { color: c.ink }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function Settings() {
  const router = useRouter();
  const toast = useToast();
  const { c, mode, setMode } = useTheme();
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
        <Text style={[type.h1, { color: c.ink }]}>Settings</Text>
      </View>

      {user && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], backgroundColor: c.surface, borderRadius: radius.card, padding: space[4], borderWidth: 1, borderColor: c.hair }}>
          <Avatar user={user} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={[type.title, { color: c.ink }]}>{user.displayName}</Text>
            <Text style={[type.meta, { color: c.ink3 }]}>@{user.handle}</Text>
          </View>
          <Button label="Edit profile" kind="secondary" onPress={() => router.push("/edit-profile")} />
        </View>
      )}

      <Section title="Appearance">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "day", label: "Day", icon: "sun" },
            { value: "night", label: "Night", icon: "moon" },
            { value: "auto", label: "Auto", icon: "auto" },
          ]}
        />
        <Text style={[type.meta, { color: c.ink2 }]}>Auto follows your device.</Text>
      </Section>

      <View style={{ height: 1, backgroundColor: c.hair }} />
      <Section title="Invite a friend">
        <Text style={[type.body, { color: c.ink2 }]}>Send a link to someone whose creations you love.</Text>
        {invite ? (
          <View style={{ gap: space[3], backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.hair, padding: space[4] }}>
            <Text selectable style={[type.h1, { color: c.ink, letterSpacing: 2 }]}>{invite.code}</Text>
            <Text selectable style={[type.bodySm, { color: c.ink2 }]}>{invite.url}</Text>
            <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
              <Button label="Copy link" icon="copy" kind="secondary" onPress={async () => (await copyText(invite.url), toast("Invite link copied"))} />
              <Button label="Share" icon="share" kind="secondary" onPress={async () => (await shareLink(invite.url, `Join me on ${brand.name}`)) === "copied" && toast("Invite link copied")} />
            </View>
          </View>
        ) : (
          <Button label="Get my invite link" icon="userplus" busy={busy} onPress={makeInvite} style={{ alignSelf: "flex-start" }} />
        )}
        {error && <Banner text={error} />}
      </Section>

      <View style={{ height: 1, backgroundColor: c.hair }} />
      <Section title="Privacy">
        <Text style={[type.body, { color: c.ink2 }]}>See who you have blocked or muted, and undo it any time.</Text>
        <Button label="Blocked and muted" icon="shield" kind="secondary" onPress={() => router.push("/blocked")} style={{ alignSelf: "flex-start" }} />
      </Section>

      <View style={{ height: 1, backgroundColor: c.hair }} />
      <Section title="Account">
        <Button label="Sign out" icon="logout" kind="secondary" onPress={signOut} style={{ alignSelf: "flex-start" }} />
      </Section>

      <View style={{ height: 1, backgroundColor: c.hair }} />
      <Section title="About">
        <Text style={[type.body, { color: c.ink }]}>{brand.name}: {brand.tagline}</Text>
        <Text style={[type.bodySm, { color: c.ink2 }]}>Open source and nonprofit. {MOCK ? "Preview mode: everything stays on this device and resets when you reload." : `Connected to ${API_URL}`}</Text>
      </Section>
    </Screen>
  );
}
