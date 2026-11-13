import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Screen } from "@/components/Screen";
import { Banner, Button, EmptyState, ErrorState, IconButton, Pulse } from "@/components/ui";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { shareLink } from "@/lib/share";
import { radius, space, type } from "@/lib/theme";
import { ApiError, type Invite } from "@/lib/types";
import { useResource } from "@/state/resource";
import { useTheme } from "@/state/theme";
import { useToast } from "@/state/toast";

const USES = [1, 3, 5];

export default function Invites() {
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();
  const { data, error, loading, retry, reload } = useResource(() => api.listInvites(), "invites");
  const [uses, setUses] = useState(1);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/me"));

  const share = async (invite: Pick<Invite, "url">) => {
    const r = await shareLink(invite.url, "Join me on Emera");
    if (r === "copied") toast("Invite link copied");
  };

  const make = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const made = await api.createInvite(uses);
      await reload();
      await share(made);
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const invites = data?.invites ?? [];

  return (
    <Screen maxWidth={560}>
      <View style={{ marginBottom: space[3] }}>
        <IconButton icon="back" label="Back" onPress={back} />
      </View>
      <View style={{ gap: space[2], marginBottom: space[4] }}>
        <Text style={[type.h1, { color: c.ink }]}>Invite people</Text>
        <Text style={[type.body, { color: c.ink2 }]}>Emera is invite-only right now. Make a link, send it to someone who makes things, and see who joins.</Text>
      </View>

      <View style={{ gap: space[3], marginBottom: space[5] }}>
        <Text style={[type.label, { color: c.ink3 }]}>PEOPLE WHO CAN USE THIS LINK</Text>
        <View style={{ flexDirection: "row", gap: space[2] }}>
          {USES.map((n) => {
            const on = uses === n;
            return (
              <Button key={n} label={n === 1 ? "Just one" : `Up to ${n}`} kind={on ? "primary" : "secondary"} onPress={() => setUses(n)} style={{ flex: 1 }} />
            );
          })}
        </View>
        {problem && <Banner text={problem} />}
        <Button label="Make an invite link" icon="link" size="lg" busy={busy} onPress={make} />
      </View>

      {error && !data ? (
        <ErrorState message={error} onRetry={retry} />
      ) : loading || !data ? (
        <View style={{ gap: space[3] }}>
          <Pulse style={{ height: 96, borderRadius: radius.card }} />
          <Pulse style={{ height: 96, borderRadius: radius.card }} />
        </View>
      ) : invites.length === 0 ? (
        <EmptyState icon="userplus" title="No invites yet" body="Your links will show up here, with everyone who joined from each one." />
      ) : (
        <View style={{ gap: space[3] }}>
          <Text style={[type.section, { color: c.ink }]}>Your links</Text>
          {invites.map((inv) => {
            const full = inv.uses >= inv.maxUses;
            return (
              <View key={inv.code} style={{ backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.hair, padding: space[4], gap: space[3] }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[type.title, { color: c.ink, letterSpacing: 1 }]} numberOfLines={1}>{inv.code}</Text>
                    <Text style={[type.meta, { color: full ? c.ink3 : c.sunInk }]}>
                      {inv.uses} of {inv.maxUses} used - {timeAgo(inv.createdAt)}
                    </Text>
                  </View>
                  <IconButton icon="share" label="Share invite link" onPress={() => share(inv)} />
                </View>
                {inv.joined.length > 0 && (
                  <View style={{ gap: space[2], borderTopWidth: 1, borderTopColor: c.hair, paddingTop: space[3] }}>
                    {inv.joined.map((j) => (
                      <View key={j.handle} style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                        <Avatar user={{ handle: j.handle, displayName: j.displayName, avatarUrl: null }} size={28} />
                        <Text style={[type.name, { color: c.ink }]}>{j.displayName}</Text>
                        <Text style={[type.meta, { color: c.ink3 }]}>@{j.handle}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
