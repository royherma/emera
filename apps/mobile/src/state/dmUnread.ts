import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { openLive } from "@/lib/live";

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

let listeners = 0;
let closeLive: (() => void) | null = null;

function useLiveDmUnread() {
  useEffect(() => {
    if (listeners++ === 0) closeLive = openLive({ kind: "me" }, () => void refreshDmUnread());
    return () => {
      if (--listeners === 0) {
        closeLive?.();
        closeLive = null;
      }
    };
  }, []);
}

export function useRefreshDmUnread(dep: unknown) {
  useLiveDmUnread();
  useEffect(() => {
    void refreshDmUnread();
    const t = setInterval(refreshDmUnread, 30000);
    return () => clearInterval(t);
  }, [dep]);
}
