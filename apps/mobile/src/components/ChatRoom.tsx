import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { type PS } from "./ui";
import { api } from "@/lib/api";
import { creatorColors, font, radius, space, type } from "@/lib/theme";
import { confirmAsk } from "@/lib/share";
import { ApiError, type ChatMessage, type ChatPage, type ChatRoomRef } from "@/lib/types";
import { useSheet } from "@/state/sheet";
import { useTheme } from "@/state/theme";
import { useToast } from "@/state/toast";

const POLL_MS = 3000;

function onScreen() {
  if (Platform.OS === "web") return typeof document === "undefined" || document.visibilityState === "visible";
  return AppState.currentState === "active";
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

function merge(old: ChatMessage[], add: ChatMessage[]) {
  const seen = new Set(old.map((m) => m.id));
  return [...old, ...add.filter((m) => !seen.has(m.id))];
}

export function useRoom(room: ChatRoomRef | null, onPage?: (p: ChatPage) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [moderator, setModerator] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef<string | null>(null);
  const ready = useRef(false);
  const pageRef = useRef(onPage);
  pageRef.current = onPage;
  const roomKey = room ? `${room.kind}:${room.id}` : "";

  useEffect(() => {
    if (!room) return;
    let alive = true;
    setMessages([]);
    setLoading(true);
    setError(null);
    latest.current = null;
    ready.current = false;
    const first = async () => {
      try {
        const p = await api.roomMessages(room);
        if (!alive) return;
        latest.current = p.latest;
        ready.current = true;
        setMessages(p.messages);
        setModerator(!!p.moderator);
        pageRef.current?.(p);
        void api.markRoomRead(room).catch(() => {});
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : "Can't load messages. Try again.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    const poll = async () => {
      if (!onScreen() || !ready.current) return;
      try {
        const p = await api.roomMessages(room, { after: latest.current });
        if (!alive) return;
        latest.current = p.latest;
        if (p.thread) pageRef.current?.(p);
        if (p.messages.length) {
          setMessages((old) => merge(old, p.messages));
          if (p.messages.some((m) => !m.mine)) void api.markRoomRead(room).catch(() => {});
        }
      } catch {}
    };
    void first();
    const t = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [roomKey]);

  const add = useCallback((m: ChatMessage) => setMessages((old) => merge(old, [m])), []);
  const remove = useCallback((id: string) => setMessages((old) => old.map((m) => (m.id === id ? { ...m, deleted: true, body: "" } : m))), []);
  return { messages, moderator, error, loading, add, remove };
}

function Line({ m, onMenu, onWho }: { m: ChatMessage; onMenu: () => void; onWho: () => void }) {
  const { c } = useTheme();
  const nick = m.user.handle ?? "someone";
  return (
    <Pressable onLongPress={onMenu} delayLongPress={350} style={({ hovered }: PS) => ({ flexDirection: "row", gap: 8, paddingVertical: 3, paddingHorizontal: space[3], backgroundColor: hovered ? c.sunk : "transparent" })}>
      {({ hovered }: PS) => (
        <>
          <Text style={[type.meta, { color: c.ink3, width: 38, fontVariant: ["tabular-nums"], lineHeight: 20 }]}>{clock(m.createdAt)}</Text>
          <Text style={[type.bodySm, { flex: 1, color: c.ink, lineHeight: 20 }]}>
            <Text onPress={onWho} style={{ fontFamily: font.body.bold, color: creatorColors(nick).from }}>{nick}</Text>
            {"  "}
            {m.deleted ? <Text style={{ color: c.ink3, fontStyle: "italic" }}>message deleted</Text> : m.body}
          </Text>
          {Platform.OS === "web" && !m.deleted && (
            <Pressable accessibilityRole="button" accessibilityLabel="Message options" onPress={onMenu} hitSlop={6} style={{ opacity: hovered ? 1 : 0, width: 20, alignItems: "center" }}>
              <Icon name="dots" size={16} color={c.ink3} />
            </Pressable>
          )}
        </>
      )}
    </Pressable>
  );
}

function Bubble({ m, onMenu, first }: { m: ChatMessage; onMenu: () => void; first: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: m.mine ? "flex-end" : "flex-start", paddingHorizontal: space[4], marginTop: first ? space[3] : 2 }}>
      <Pressable
        onLongPress={onMenu}
        delayLongPress={350}
        style={{ maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: m.mine ? c.sun : c.sunk }}
      >
        <Text style={[type.body, { color: m.deleted ? c.ink3 : m.mine ? c.onSun : c.ink, fontStyle: m.deleted ? "italic" : "normal" }]}>{m.deleted ? "message deleted" : m.body}</Text>
      </Pressable>
    </View>
  );
}

export function ChatRoom({ room, variant, placeholder, header, footer, onPage, canSend = true }: {
  room: ChatRoomRef;
  variant: "lines" | "bubbles";
  placeholder: string;
  header?: ReactNode;
  footer?: ReactNode;
  onPage?: (p: ChatPage) => void;
  canSend?: boolean;
}) {
  const router = useRouter();
  const { c } = useTheme();
  const sheet = useSheet();
  const toast = useToast();
  const { messages, moderator, error, loading, add, remove } = useRoom(room, onPage);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scroll = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);
  const stick = useRef(true);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      add(await api.sendMessage(room, text));
      setDraft("");
      stick.current = true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "That didn't send. Try again.");
    } finally {
      setSending(false);
    }
  };

  const menu = (m: ChatMessage) => {
    if (m.deleted) return;
    const del = {
      label: "Delete message",
      icon: "trash" as const,
      destructive: true,
      onPress: () => confirmAsk("Delete this message?", "It's removed for everyone.", "Delete", async () => {
        try {
          await api.deleteMessage(room, m.id);
          remove(m.id);
        } catch (e) {
          toast(e instanceof ApiError ? e.message : "Couldn't delete it. Try again.");
        }
      }),
    };
    const report = { label: "Report message", icon: "flag" as const, onPress: () => router.push({ pathname: "/flag", params: { type: room.kind, id: m.id } }) };
    sheet(m.mine ? [del] : moderator ? [report, del] : [report]);
  };

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      {header}
      <ScrollView
        ref={scroll as never}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: space[2], flexGrow: 1, justifyContent: "flex-end" }}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          stick.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 80;
        }}
        scrollEventThrottle={100}
        onContentSizeChange={() => stick.current && scroll.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <Text style={[type.bodySm, { color: c.ink3, textAlign: "center", padding: space[4] }]}>{error}</Text>
        ) : !loading && messages.length === 0 ? (
          <Text style={[type.bodySm, { color: c.ink3, textAlign: "center", padding: space[4] }]}>No messages yet. Say the first one.</Text>
        ) : variant === "lines" ? (
          messages.map((m) => <Line key={m.id} m={m} onMenu={() => menu(m)} onWho={() => m.user.handle && router.push({ pathname: "/u/[handle]", params: { handle: m.user.handle } })} />)
        ) : (
          messages.map((m, i) => <Bubble key={m.id} m={m} first={i === 0 || messages[i - 1].mine !== m.mine} onMenu={() => menu(m)} />)
        )}
      </ScrollView>
      {footer}
      {canSend && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], padding: space[3], borderTopWidth: 1, borderTopColor: c.hair }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={send}
            placeholder={placeholder}
            placeholderTextColor={c.ink3}
            returnKeyType="send"
            blurOnSubmit={false}
            maxLength={2000}
            accessibilityLabel={placeholder}
            style={[type.bodySm, { flex: 1, minHeight: 40, paddingHorizontal: 14, borderRadius: radius.field, backgroundColor: c.sunk, color: c.ink, outlineStyle: "none" } as object]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={!draft.trim() || sending}
            onPress={send}
            style={({ pressed }: PS) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: draft.trim() ? c.sun : c.sunk, opacity: pressed ? 0.8 : 1 })}
          >
            <Icon name="send" size={18} color={draft.trim() ? c.onSun : c.ink3} strokeWidth={2} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function WhoAvatar({ user, size = 40 }: { user: { handle: string | null; displayName: string; avatarUrl: string | null }; size?: number }) {
  return <Avatar user={{ ...user, handle: user.handle ?? "" }} size={size} />;
}
