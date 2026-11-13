import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HANDLE_RE, shortHash, timeAgo } from "../format";

const NOW = new Date("2026-11-13T12:00:00Z");
const ago = (s: number) => new Date(NOW.getTime() - s * 1000).toISOString();

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("says now under a minute, including future timestamps", () => {
    expect(timeAgo(ago(5))).toBe("now");
    expect(timeAgo(ago(-30))).toBe("now");
  });
  it("switches unit exactly at each boundary", () => {
    expect(timeAgo(ago(59))).toBe("now");
    expect(timeAgo(ago(60))).toBe("1m");
    expect(timeAgo(ago(3599))).toBe("59m");
    expect(timeAgo(ago(3600))).toBe("1h");
    expect(timeAgo(ago(86400))).toBe("1d");
    expect(timeAgo(ago(86400 * 6))).toBe("6d");
  });
  it("falls back to a calendar date after a week", () => {
    const out = timeAgo(ago(86400 * 30));
    expect(out).not.toMatch(/^\d+[mhd]$/);
    expect(out).toMatch(/\d/);
  });
});

describe("shortHash", () => {
  it("keeps short hashes whole", () => {
    expect(shortHash("abcdef")).toBe("abcdef");
    expect(shortHash("a".repeat(14))).toBe("a".repeat(14));
  });
  it("elides the middle of long hashes", () => {
    expect(shortHash("0123456789abcdefghij")).toBe("01234567...efghij");
  });
});

describe("HANDLE_RE", () => {
  it("accepts 3-20 lowercase letters, digits and underscores", () => {
    for (const ok of ["abc", "roy_1", "a".repeat(20), "x_y_z"]) expect(HANDLE_RE.test(ok)).toBe(true);
  });
  it("rejects bad handles", () => {
    for (const bad of ["ab", "a".repeat(21), "Roy", "a-b", "a b", "", "name.x"]) expect(HANDLE_RE.test(bad)).toBe(false);
  });
});
