import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatRoom, WhoAvatar } from "@/components/ChatRoom";
import { Icon } from "@/components/Icon";
import { Button, IconButton, type PS } from "@/components/ui";
import { api } from "@/lib/api";
import { useLayout } from "@/lib/layout";
import { confirmAsk } from "@/lib/share";
import { radius, space, type } from "@/lib/theme";
import { ApiError, type ChatUser, type DmThread } from "@/lib/types";
import { refreshDmUnread } from "@/state/dmUnread";
import { useSheet } from "@/state/sheet";
import { useTheme } from "@/state/theme";
import { useToast } from "@/state/toast";

function Header({ who, onBack, onMenu }: { who: ChatUser | null; onBack: () => void; onMenu?: () => void }) {
  const router = useRouter();
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[3], height: 60, borderBottomWidth: 1, borderBottomColor: c.hair }}>
      <IconButton icon="back" label="Back" onPress={onBack} />
      {who && (
        <Pressable accessibilityRole="link" onPress={() => who.handle && router.push({ pathname: "/u/[handle]", params: { handle: who.handle } })} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <WhoAvatar user={who} size={36} />
          <View>
            <Text numberOfLines={1} style={[type.name, { color: c.ink }]}>{who.displayName || who.handle}</Text>
            <Text numberOfLines={1} style={[type.meta, { color: c.ink3 }]}>@{who.handle}</Text>
          </View>
        </Pressable>
      )}
      {onMenu && <IconButton icon="dots" label="Conversation options" onPress={onMenu} />}
    </View>
  );
}

function NewThread({ handle, onBack }: { handle: string; onBack: () => void }) {
  const router = useRouter();
  const { c } = useTheme();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const r = await api.startThread(handle, draft);
      router.replace({ pathname: "/messages/[id]", params: { id: r.thread.id } });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "That didn't send. Try again.");
      setBusy(false);
    }
  };
  return (
    <>
      <Header who={{ id: "", handle, displayName: "", avatarUrl: null }} onBack={onBack} />
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], padding: space[3], borderTopWidth: 1, borderTopColor: c.hair }}>
        <TextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={send}
          placeholder={`Message @${handle}`}
          placeholderTextColor={c.ink3}
          returnKeyType="send"
          maxLength={2000}
          style={[type.bodySm, { flex: 1, minHeight: 40, paddingHorizontal: 14, borderRadius: radius.field, backgroundColor: c.sunk, color: c.ink, outlineStyle: "none" } as object]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!draft.trim() || busy} onPress={send} style={({ pressed }: PS) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: draft.trim() ? c.sun : c.sunk, opacity: pressed ? 0.8 : 1 })}>
          <Icon name="send" size={18} color={draft.trim() ? c.onSun : c.ink3} strokeWidth={2} />
        </Pressable>
      </View>
    </>
  );
}

export default function Thread() {
  const { id = "", handle = "" } = useLocalSearchParams<{ id: string; handle?: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const { wide } = useLayout();
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
  const toast = useToast();
  const [thread, setThread] = useState<DmThread | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/messages"));

  const hide = async () => {
    await api.hideThread(id);
    void refreshDmUnread();
    back();
  };
  const block = () => {
    const h = thread?.with.handle;
    if (!h) return;
    confirmAsk(`Block @${h}?`, "They can't message you or see your posts. They won't be told.", "Block", async () => {
      try {
        await api.block(h);
        back();
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Couldn't block. Try again.");
      }
    });
  };
  const menu = () =>
    sheet([
      { label: "Report account", icon: "flag", onPress: () => thread && router.push({ pathname: "/flag", params: { type: "user", id: thread.with.id, name: thread.with.handle ?? "" } }) },
      { label: "Block", icon: "x", destructive: true, onPress: block },
      { label: "Delete conversation", icon: "trash", destructive: true, onPress: () => confirmAsk("Delete this conversation?", "It's removed from your inbox. They keep their copy.", "Delete", hide) },
    ]);

  const accept = async () => {
    try {
      setThread(await api.acceptThread(id));
      void refreshDmUnread();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  };

  const request = thread && !thread.accepted;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: wide ? 0 : insets.top, paddingBottom: insets.bottom }}>
      <View style={{ flex: 1, width: "100%", maxWidth: 720, alignSelf: "center", borderLeftWidth: wide ? 1 : 0, borderRightWidth: wide ? 1 : 0, borderColor: c.hair }}>
        {id === "new" ? (
          <NewThread handle={handle} onBack={back} />
        ) : (
          <ChatRoom
            room={{ kind: "dm", id }}
            variant="bubbles"
            placeholder={`Message @${thread?.with.handle ?? ""}`}
            canSend={!request}
            onPage={(p) => p.thread && setThread(p.thread)}
            header={<Header who={thread?.with ?? null} onBack={back} onMenu={thread ? menu : undefined} />}
            footer={
              request ? (
                <View style={{ gap: space[3], padding: space[4], borderTopWidth: 1, borderTopColor: c.hair }}>
                  <Text style={[type.bodySm, { color: c.ink2 }]}>You don't follow @{thread.with.handle}. Accept to reply and move this to your inbox.</Text>
                  <View style={{ flexDirection: "row", gap: space[2] }}>
                    <Button label="Accept" onPress={accept} />
                    <Button label="Delete" kind="secondary" onPress={hide} />
                    <Button label="Block" kind="secondary" onPress={block} />
                  </View>
                </View>
              ) : thread && !thread.theyAccepted ? (
                <Text style={[type.meta, { color: c.ink3, textAlign: "center", paddingBottom: space[2] }]}>They see this as a request until they accept</Text>
              ) : null
            }
          />
        )}
      </View>
    </View>
  );
}
