import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api";

let counts = { inbox: 0, requests: 0 };
const subs = new Set<() => void>();

export function setDmUnread(next: { inbox: number; requests: number }) {
  if (next.inbox === counts.inbox && next.requests === counts.requests) return;
  counts = next;
  subs.forEach((f) => f());
}

export const useDmUnread = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => counts,
    () => counts,
  );

export async function refreshDmUnread() {
  try {
    setDmUnread(await api.dmUnread());
  } catch {}
}

export function useRefreshDmUnread(dep: unknown) {
  useEffect(() => {
    void refreshDmUnread();
    const t = setInterval(refreshDmUnread, 30000);
    return () => clearInterval(t);
  }, [dep]);
}
