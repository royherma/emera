import { describe, expect, it } from "vitest";
import { cueAt, parseVtt } from "../captions";

const VTT = `WEBVTT

1
00:00:01.000 --> 00:00:03.500
Hello there

00:01:02.250 --> 00:01:04.000 align:start
Second
line
`;

describe("parseVtt", () => {
  it("parses cues, skipping the header and numeric ids", () => {
    expect(parseVtt(VTT)).toEqual([
      { start: 1, end: 3.5, text: "Hello there" },
      { start: 62.25, end: 64, text: "Second\nline" },
    ]);
  });
  it("handles CRLF line endings", () => {
    expect(parseVtt(VTT.replace(/\n/g, "\r\n"))).toHaveLength(2);
  });
  it("handles hour timestamps", () => {
    expect(parseVtt("01:00:00.000 --> 01:00:01.000\nHi")[0]).toMatchObject({ start: 3600, end: 3601 });
  });
  it("drops cues with no text or unparseable times", () => {
    expect(parseVtt("00:00:01.000 --> 00:00:02.000\n")).toEqual([]);
    expect(parseVtt("abc --> def\nText")).toEqual([]);
  });
  it("returns nothing for empty input", () => {
    expect(parseVtt("")).toEqual([]);
  });
});

describe("cueAt", () => {
  const cues = parseVtt(VTT);
  it("finds the cue covering a time, start inclusive and end exclusive", () => {
    expect(cueAt(cues, 1)).toBe("Hello there");
    expect(cueAt(cues, 3.499)).toBe("Hello there");
    expect(cueAt(cues, 3.5)).toBeNull();
  });
  it("returns null outside every cue", () => {
    expect(cueAt(cues, 0)).toBeNull();
    expect(cueAt([], 5)).toBeNull();
  });
});
