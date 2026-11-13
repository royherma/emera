export type Cue = { start: number; end: number; text: string };

const seconds = (t: string) => t.split(":").reduce((n, part) => n * 60 + Number(part), 0);

export function parseVtt(vtt: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of vtt.replace(/\r/g, "").split(/\n\n+/)) {
    const lines = block.split("\n");
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at < 0) continue;
    const [start, end] = lines[at].split("-->").map((s) => seconds(s.trim().split(/\s/)[0]));
    const text = lines.slice(at + 1).join("\n").trim();
    if (text && Number.isFinite(start) && Number.isFinite(end)) cues.push({ start, end, text });
  }
  return cues;
}

const cache = new Map<string, Promise<Cue[]>>();
export function loadCaptions(url: string): Promise<Cue[]> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => (r.ok ? r.text() : "")).then(parseVtt).catch(() => []);
    cache.set(url, p);
  }
  return p;
}

export const cueAt = (cues: Cue[], t: number) => cues.find((c) => t >= c.start && t < c.end)?.text ?? null;
