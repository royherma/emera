import { api } from "./api";
import type { FeedMode, Post } from "./types";

export type ListSource = "explore" | "search" | `@${string}` | `feed:${FeedMode}`;

let last: { from: ListSource; posts: Post[]; cursor: string | null } | null = null;

export function rememberList(from: ListSource, posts: Post[], cursor: string | null = null) {
  last = { from, posts, cursor };
}

// Gone after a reload or a shared link; the screen refetches from `from`.
export function recallList(from: ListSource, id: string) {
  return last && last.from === from && last.posts.some((p) => p.id === id) ? last : null;
}

export async function pageOf(from: ListSource, cursor: string | null): Promise<{ posts: Post[]; cursor: string | null }> {
  if (from.startsWith("@")) return api.profile(from.slice(1), cursor);
  return api.feed(cursor, from === "feed:following" ? "following" : "all");
}
