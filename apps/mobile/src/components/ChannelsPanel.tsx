import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ChatRoom } from "./ChatRoom";
import { UnreadDot } from "./Engage";
import { type PS } from "./ui";
import { api } from "@/lib/api";
import { font, space, type } from "@/lib/theme";
import type { Channel } from "@/lib/types";
import { useTheme } from "@/state/theme";

let lastPicked = "lobby";

export function ChannelsPanel({ initial }: { initial?: string }) {
  const { c } = useTheme();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [picked, setPicked] = useState(initial ?? lastPicked);

  useEffect(() => {
    let alive = true;
    const load = () => api.channels().then((list) => alive && setChannels(list)).catch(() => {});
    void load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const pick = (id: string) => {
    lastPicked = id;
    setPicked(id);
    setChannels((list) => list.map((ch) => (ch.id === id ? { ...ch, unread: false } : ch)));
  };
  const current = channels.find((ch) => ch.id === picked);

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 2, paddingHorizontal: space[2], paddingTop: space[2] }}>
        {channels.map((ch) => {
          const on = ch.id === picked;
          return (
            <Pressable
              key={ch.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => pick(ch.id)}
              style={({ hovered }: PS) => ({ flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 10, borderRadius: 10, backgroundColor: on ? c.sunk : hovered ? c.sunk : "transparent" })}
            >
              <Text style={[type.label, { fontFamily: on ? font.body.bold : font.body.medium, color: on ? c.ink : c.ink2 }]}>#{ch.name}</Text>
              {ch.unread && !on && <UnreadDot />}
            </Pressable>
          );
        })}
      </ScrollView>
      {current && <Text numberOfLines={1} style={[type.meta, { color: c.ink3, paddingHorizontal: space[4], paddingVertical: space[2], borderBottomWidth: 1, borderBottomColor: c.hair }]}>{current.topic}</Text>}
      {current && <ChatRoom key={current.id} room={{ kind: "channel", id: current.id }} variant="lines" placeholder={`Say something to everyone in #${current.name}`} />}
    </View>
  );
}
