import { type ComponentRef, useCallback, useRef } from "react";
import { AppState, Dimensions, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "./api";
import { checkFund, fundRules, fundState } from "./fund";
import type { Post } from "./types";
import { useAuth } from "@/state/auth";

type Node = ComponentRef<typeof View>;
type Target = { postId: string; ref: { current: Node | null } };

const targets = new Set<Target>();
const pending = new Map<string, number>();
let timer: ReturnType<typeof setInterval> | null = null;

const step = () => Math.max(1, Math.min(fundRules()?.heartbeatMaxS ?? 10, 30));

function send(postId: string, seconds: number) {
  if (seconds < 1) return;
  api.watch(postId, seconds).catch(() => {});
}

function flush(postId: string) {
  const s = pending.get(postId) ?? 0;
  pending.delete(postId);
  for (let left = s; left > 0; left -= step()) send(postId, Math.min(left, step()));
}

const flushAll = () => [...pending.keys()].forEach(flush);

function tick() {
  if (AppState.currentState !== "active" || fundState() !== "on") return;
  const win = Dimensions.get("window");
  for (const t of targets) {
    t.ref.current?.measureInWindow((x, y, w, h) => {
      const part = (start: number, len: number, max: number) => Math.max(0, Math.min(start + len, max) - Math.max(start, 0)) / len;
      const seen = w > 0 && h > 0 && part(y, h, win.height) * part(x, w, win.width) >= 0.5;
      if (!seen) return void (pending.has(t.postId) && flush(t.postId));
      const s = (pending.get(t.postId) ?? 0) + 1;
      if (s >= step()) {
        pending.delete(t.postId);
        send(t.postId, s);
      } else pending.set(t.postId, s);
    });
  }
}

AppState.addEventListener("change", (s) => s !== "active" && flushAll());

function start() {
  if (!timer) timer = setInterval(tick, 1000);
}

function stop() {
  if (targets.size || !timer) return;
  clearInterval(timer);
  timer = null;
}

export function useWatchTime(post: Post | null | undefined) {
  const { status, user } = useAuth();
  const ref = useRef<Node | null>(null);
  const postId = post?.id ?? "";
  const counts = !!post && status === "in" && !!user && user.id !== post.author.id && user.handle !== post.author.handle;
  useFocusEffect(
    useCallback(() => {
      if (!counts) return;
      checkFund();
      const t: Target = { postId, ref };
      targets.add(t);
      start();
      return () => {
        targets.delete(t);
        flush(postId);
        stop();
      };
    }, [counts, postId]),
  );
  return ref;
}
