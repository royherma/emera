import { describe, expect, it } from "vitest";
import { centerTop, pickStop } from "../settle";

const stops = [0, 300, 1000, 1700];

describe("pickStop", () => {
  it("settles a small nudge back on the post you were on", () => {
    expect(pickStop(stops, 1000, 1040)).toBe(1000);
  });
  it("moves one post on a single wheel click", () => {
    expect(pickStop(stops, 1000, 1100)).toBe(1700);
    expect(pickStop(stops, 1000, 900)).toBe(300);
  });
  it("lands on the nearest post after a long scroll", () => {
    expect(pickStop(stops, 0, 1600)).toBe(1700);
    expect(pickStop(stops, 0, 1150)).toBe(1000);
  });
});

describe("centerTop", () => {
  it("centers a post that fits the window", () => {
    expect(centerTop(1000, 600, 800)).toBe(900);
  });
  it("puts a post taller than the window at the top edge", () => {
    expect(centerTop(1000, 900, 800)).toBe(988);
  });
});
