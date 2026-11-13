import { describe, expect, it } from "vitest";
import { markPath, markTransform, markViewBox } from "../markPath";

describe("brand mark", () => {
  it("is a square viewBox", () => {
    const [x, y, w, h] = markViewBox.split(" ").map(Number);
    expect([x, y, w]).toEqual([0, 0, 600]);
    expect(h).toBe(w);
  });
  it("flips the y axis inside the viewBox", () => {
    expect(markTransform).toMatch(/translate\(0\.0+,600\.0+\) scale\(0\.1\d*,-0\.1\d*\)/);
  });
  it("is non-empty path data starting with a move", () => {
    expect(markPath.startsWith("M")).toBe(true);
    expect(markPath).not.toMatch(/[^MmLlHhVvCcSsQqTtAaZz0-9eE.,\s-]/);
  });
});
