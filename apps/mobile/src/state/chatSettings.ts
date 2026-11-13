import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import type { ChatSettings } from "@/lib/types";

let settings: ChatSettings = { dmFrom: "everyone", channelsHidden: false };
let loaded = false;
const subs = new Set<() => void>();
const set = (next: ChatSettings) => {
  settings = next;
  subs.forEach((f) => f());
};

export function useChatSettings() {
  const now = useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => settings,
    () => settings,
  );
  useEffect(() => {
    if (loaded) return;
    loaded = true;
    api.chatSettings().then(set, () => (loaded = false));
  }, []);
  return now;
}

export const useChannelsHidden = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => settings.channelsHidden,
    () => settings.channelsHidden,
  );

export async function saveChatSettings(input: Partial<ChatSettings>) {
  const before = settings;
  set({ ...settings, ...input });
  try {
    set(await api.saveChatSettings(input));
  } catch (e) {
    set(before);
    throw e;
  }
}

export function resetChatSettings() {
  loaded = false;
  settings = { dmFrom: "everyone", channelsHidden: false };
}
