import { describe, expect, it } from "vitest";
import { feedBox } from "../mediaBox";
import type { Media } from "../types";

const media = (width: number, height: number) => ({ width, height }) as Media;

describe("feedBox shapes", () => {
  it("keeps a 9:16 video uncropped", () => {
    expect(feedBox(media(1080, 1920), 360)).toEqual({ width: 360, height: 640 });
  });
  it("shrinks tall media to the screen height, keeping its shape", () => {
    expect(feedBox(media(1080, 1920), 560, 690)).toEqual({ width: 388, height: 690 });
  });
  it("keeps landscape and square at full width", () => {
    expect(feedBox(media(1920, 1080), 560, 690)).toEqual({ width: 560, height: 315 });
    expect(feedBox(media(1000, 1000), 560, 690)).toEqual({ width: 560, height: 560 });
  });
});
