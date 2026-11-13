import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api";

let count = 0;
const subs = new Set<() => void>();

export function setUnread(n: number) {
  if (n === count) return;
  count = n;
  subs.forEach((f) => f());
}

export const useUnread = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => count,
    () => 0,
  );

export async function refreshUnread() {
  try {
    setUnread(await api.unreadCount());
  } catch {}
}

export function useRefreshUnread(dep: unknown) {
  useEffect(() => {
    void refreshUnread();
    const t = setInterval(refreshUnread, 60000);
    return () => clearInterval(t);
  }, [dep]);
}
