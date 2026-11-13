import { describe, expect, it } from "vitest";
import { FEED, FULL, aspect, feedBox, fitBox } from "../mediaBox";
import type { Media } from "../types";

const media = (width: number, height: number) => ({ width, height }) as Media;

describe("aspect", () => {
  it("uses the real ratio inside the limits", () => {
    expect(aspect(media(1000, 1000), FEED)).toBe(1);
  });
  it("clamps very wide and very tall media", () => {
    expect(aspect(media(4000, 1000), FEED)).toBe(FEED.max);
    expect(aspect(media(1000, 4000), FEED)).toBe(FEED.min);
    expect(aspect(media(1000, 4000), FULL)).toBe(FULL.min);
    expect(aspect(media(4000, 1000), FULL)).toBe(FULL.max);
  });
  it("falls back when size is missing or zero", () => {
    expect(aspect(undefined, FEED)).toBe(FEED.fallback);
    expect(aspect(media(0, 500), FULL)).toBe(FULL.fallback);
  });
});

describe("fitBox", () => {
  it("fills the width when the room is tall enough", () => {
    expect(fitBox(1, { width: 300, height: 1000 })).toEqual({ width: 300, height: 300 });
  });
  it("shrinks to the height when the room is short", () => {
    expect(fitBox(0.5, { width: 1000, height: 400 })).toEqual({ width: 200, height: 400 });
  });
  it("never returns a zero size", () => {
    expect(fitBox(1, { width: 0, height: 0 })).toEqual({ width: 1, height: 1 });
  });
});

describe("feedBox", () => {
  it("derives height from clamped aspect", () => {
    expect(feedBox(media(1000, 4000), 400)).toEqual({ width: 400, height: 711 });
    expect(feedBox(undefined, 400)).toEqual({ width: 400, height: 500 });
  });
});
