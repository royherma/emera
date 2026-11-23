import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { storage } from "@/lib/storage";
import type { Post } from "@/lib/types";

export const WATCH_MS = 2000;

const PLAY_GAP_MS = 60_000;
const counts = new Map<string, number>();
const sentAt = new Map<string, number>();
const subs = new Set<() => void>();

let device: Promise<string> | null = null;
const deviceId = () =>
  (device ??= storage.get("emera.device").then(async (id) => {
    if (id) return id;
    const fresh = Array.from({ length: 4 }, () => Math.floor(Math.random() * 2 ** 32).toString(16).padStart(8, "0")).join("");
    await storage.set("emera.device", fresh);
    return fresh;
  }));

export async function watched(postId: string) {
  const last = sentAt.get(postId);
  if (last && Date.now() - last < PLAY_GAP_MS) return;
  sentAt.set(postId, Date.now());
  try {
    counts.set(postId, (await api.view(postId, await deviceId())).viewCount);
    subs.forEach((f) => f());
  } catch {
    sentAt.delete(postId);
  }
}

export const useViewCount = (post: Post) =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => counts.get(post.id) ?? post.viewCount,
    () => post.viewCount,
  );
