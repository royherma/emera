import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import type { Post } from "@/lib/types";

export const WATCH_MS = 2000;

const counts = new Map<string, number>();
const sent = new Set<string>();
const subs = new Set<() => void>();

export async function watched(postId: string) {
  if (sent.has(postId)) return;
  sent.add(postId);
  try {
    counts.set(postId, (await api.view(postId)).viewCount);
    subs.forEach((f) => f());
  } catch {
    sent.delete(postId);
  }
}

export const useViewCount = (post: Post) =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => counts.get(post.id) ?? post.viewCount,
    () => post.viewCount,
  );
