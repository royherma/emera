import { api } from "./api";
import type { ChatRoomRef } from "./types";

export type LiveRoom = ChatRoomRef | { kind: "me"; id?: string };

export type LivePing = "new" | "deleted";

export function openLive(room: LiveRoom, onPing: (t: LivePing) => void, onState: (open: boolean) => void = () => {}) {
  let ws: WebSocket | null = null;
  let stopped = false;
  let wait = 1000;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let beat: ReturnType<typeof setInterval> | undefined;

  const again = () => {
    onState(false);
    clearInterval(beat);
    if (stopped) return;
    retry = setTimeout(connect, wait);
    wait = Math.min(wait * 2, 30000);
  };

  async function connect() {
    let url: string | null;
    try {
      url = await api.liveUrl(room);
    } catch {
      return again();
    }
    if (stopped || !url) return onState(false);
    const sock = new WebSocket(url);
    ws = sock;
    sock.onopen = () => {
      wait = 1000;
      onState(true);
      onPing("new");
      beat = setInterval(() => sock.readyState === 1 && sock.send("ping"), 25000);
    };
    sock.onmessage = (e) => {
      if (e.data === "pong") return;
      try {
        onPing(JSON.parse(String(e.data)).t === "deleted" ? "deleted" : "new");
      } catch {
        onPing("new");
      }
    };
    sock.onclose = () => ws === sock && again();
  }

  void connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    clearInterval(beat);
    ws?.close();
  };
}
