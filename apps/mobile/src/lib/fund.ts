import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import { ApiError, type Fund, type FundRules } from "./types";

type State = "unknown" | "on" | "off";

let state: State = "unknown";
let rules: FundRules | null = null;
let checking: Promise<void> | null = null;
const listeners = new Set<() => void>();

const set = (next: State) => {
  if (state === next) return;
  state = next;
  listeners.forEach((l) => l());
};

export const isFundOff = (e: unknown) => e instanceof ApiError && (e.code === "not_found" || e.code === "http_404");

export async function loadFund(): Promise<Fund> {
  try {
    const f = await api.fund();
    rules = f.rules;
    set("on");
    return f;
  } catch (e) {
    if (isFundOff(e)) set("off");
    throw e;
  }
}

export function checkFund() {
  if (state !== "unknown" || checking) return;
  checking = loadFund()
    .then(() => undefined, () => undefined)
    .finally(() => (checking = null));
}

export const fundState = () => state;
export const fundRules = () => rules;

export function useFundOn(): boolean {
  const s = useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => state,
    () => state,
  );
  useEffect(checkFund, []);
  return s === "on";
}

const groups = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function money(cents: number, always = false): string {
  const whole = Math.floor(Math.abs(cents) / 100);
  const rest = Math.abs(cents) % 100;
  const sign = cents < 0 ? "-" : "";
  return rest === 0 && !always ? `${sign}$${groups(whole)}` : `${sign}$${groups(whole)}.${String(rest).padStart(2, "0")}`;
}

export function percent(ppm: number): string {
  const p = ppm / 10_000;
  if (ppm > 0 && p < 0.01) return "under 0.01%";
  return `${p < 1 ? p.toFixed(2) : p.toFixed(1)}%`;
}

export const count = groups;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function monthName(month: string, withYear = true): string {
  const [y, m] = month.split("-").map(Number);
  return withYear ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
}

export function duration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${groups(h)}h ${m % 60}m` : `${groups(h)}h`;
}

const PAYOUT_MONTHS = [0, 3, 6, 9];

export function nextPayout(now = new Date()): string {
  const m = now.getUTCMonth();
  const next = PAYOUT_MONTHS.find((p) => p > m);
  return next === undefined ? `${MONTHS[0]} ${now.getUTCFullYear() + 1}` : `${MONTHS[next]} ${now.getUTCFullYear()}`;
}
