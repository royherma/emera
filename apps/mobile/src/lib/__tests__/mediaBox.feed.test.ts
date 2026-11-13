import { describe, expect, it } from "vitest";
import { feedBox, feedColumn } from "../mediaBox";
import type { Media } from "../types";

const media = (width: number, height: number) => ({ width, height }) as Media;

describe("feed shapes", () => {
  it("shows 9:16 video as 4:5 like Instagram", () => {
    expect(feedBox(media(1080, 1920), 400)).toEqual({ width: 400, height: 500 });
  });
  it("keeps landscape and square at full width", () => {
    expect(feedBox(media(1920, 1080), 560)).toEqual({ width: 560, height: 315 });
    expect(feedBox(media(1000, 1000), 560)).toEqual({ width: 560, height: 560 });
  });
});

describe("feedColumn", () => {
  it("narrows so a 4:5 post fits the screen", () => {
    expect(feedColumn(560, 860, 330)).toBe(424);
  });
  it("keeps the full column on tall screens and phones", () => {
    expect(feedColumn(560, 1400, 330)).toBe(560);
    expect(feedColumn(358, 844, 300)).toBe(358);
  });
});
