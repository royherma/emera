import { ApiError, type Earnings, type Fund, type FundMonth, type FundRules, type FundShare, type FundStatement, type Post, type FundSponsor, type Sponsorship } from "./types";

export const fundRules: FundRules = { version: "1.0.0", creatorShare: 0.5, photoCapS: 60, videoCapS: 600, creatorCapS: 1800, minViewerAgeH: 24, heartbeatMaxS: 10, payoutMinCents: 1000, closeDay: 3 };

const fundOff = process.env.EXPO_PUBLIC_MOCK_FUNDING === "off";

const sponsorInfo: Record<string, [string, string]> = {
  mossgrove: ["Mossgrove Supply Co.", "https://mossgrove.example"],
  northlight: ["Northlight Print Lab", "https://northlight-print.example"],
  tidewell: ["Tidewell Audio", "https://tidewell.example"],
  quillmark: ["Quillmark Paper", "https://quillmark.example"],
  kilnwright: ["Kilnwright Tools", "https://kilnwright.example"],
  fernhollow: ["Fernhollow Roasters", "https://fernhollow.example"],
};

const creatorWeights: [string | null, number, string][] = [
  ["tamsin", 9.2, "2026-08"],
  ["koji", 8.1, "2026-08"],
  ["harbor_loom", 6.4, "2026-08"],
  ["mina", 5.9, "2026-08"],
  ["noor", 5.2, "2026-08"],
  ["pell_and_ink", 4.6, "2026-08"],
  ["jonas_w", 4.3, "2026-08"],
  ["dune_reels", 3.9, "2026-08"],
  ["odd_type", 3.5, "2026-08"],
  ["ruth_kiln", 3.2, "2026-08"],
  [null, 3.0, "2026-08"],
  ["fenna_draws", 2.8, "2026-08"],
  ["ila_makes", 2.6, "2026-08"],
  ["cato_beats", 2.4, "2026-08"],
  ["bram", 2.2, "2026-08"],
  ["lupe_sews", 2.0, "2026-08"],
  ["marrow_press", 1.8, "2026-08"],
  ["tobi_frames", 1.6, "2026-08"],
  ["ines_glass", 3.4, "2026-09"],
  ["oren_sound", 2.9, "2026-09"],
  ["brisa_paints", 2.1, "2026-09"],
  [null, 1.7, "2026-09"],
  ["yusuf_wood", 1.5, "2026-09"],
  ["vela_studio", 1.3, "2026-09"],
  ["kaito_clay", 2.7, "2026-10"],
  ["sefa_prints", 2.2, "2026-10"],
  ["wren_clay", 1.9, "2026-10"],
  ["ottoline", 1.6, "2026-10"],
  ["quill_ana", 1.2, "2026-10"],
  ["mosaic_mo", 1.0, "2026-10"],
  ["lior_loops", 2.5, "2026-11"],
  ["aster_knits", 1.4, "2026-11"],
];

type MonthSeed = { month: string; closedAt: string | null; seconds: number; sponsorships: [string, number, Sponsorship["status"]?][] };

const seeds: MonthSeed[] = [
  { month: "2026-08", closedAt: "2026-09-03T00:00:00.000Z", seconds: 912_000, sponsorships: [["mossgrove", 250000], ["northlight", 150000], ["tidewell", 120000]] },
  { month: "2026-09", closedAt: "2026-10-03T00:00:00.000Z", seconds: 1_640_000, sponsorships: [["mossgrove", 250000], ["quillmark", 200000], ["northlight", 150000], ["tidewell", 120000], ["fernhollow", 50000, "refunded"]] },
  { month: "2026-10", closedAt: "2026-11-03T00:00:00.000Z", seconds: 2_870_000, sponsorships: [["mossgrove", 300000], ["kilnwright", 300000], ["quillmark", 200000], ["northlight", 150000], ["tidewell", 150000], ["fernhollow", 100000]] },
  { month: "2026-11", closedAt: null, seconds: 1_930_000, sponsorships: [["mossgrove", 400000], ["kilnwright", 350000], ["quillmark", 250000], ["northlight", 200000], ["tidewell", 150000], ["fernhollow", 120000]] },
];

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seconds = new Map<string, Map<string, number>>();
seeds.forEach((s, i) => {
  const r = rng(i + 7);
  const live = creatorWeights.filter(([, , since]) => since <= s.month);
  const weights = live.map(([, w]) => w * (0.8 + r() * 0.4));
  const sum = weights.reduce((a, b) => a + b, 0);
  const row = new Map<string, number>();
  live.forEach(([handle], j) => row.set(handle ?? `anon_${j}`, Math.round((s.seconds * weights[j]) / sum)));
  seconds.set(s.month, row);
});

const anon = (key: string) => key.startsWith("anon_");

function build(s: MonthSeed, carryInCents: number): FundStatement {
  const sponsorships: Sponsorship[] = s.sponsorships.map(([key, amountCents, status], i) => ({
    id: `sp_${s.month.replace("-", "")}_${i + 1}`,
    sponsorName: sponsorInfo[key][0],
    sponsorUrl: sponsorInfo[key][1],
    month: s.month,
    amountCents,
    status: status ?? "paid",
    createdAt: `${s.month}-0${(i % 7) + 1}T09:00:00.000Z`,
  }));
  const sponsoredCents = sponsorships.filter((x) => x.status === "paid").reduce((a, x) => a + x.amountCents, 0);
  const creatorCents = Math.floor(sponsoredCents * fundRules.creatorShare);
  const creatorPoolCents = carryInCents + creatorCents;
  const row = seconds.get(s.month)!;
  const totalSeconds = [...row.values()].reduce((a, b) => a + b, 0);
  const shares: FundShare[] = [...row.entries()]
    .filter(([, sec]) => sec > 0)
    .map(([key, sec]) => ({
      handle: anon(key) ? null : key,
      seconds: sec,
      sharePpm: totalSeconds ? Math.floor((sec * 1_000_000) / totalSeconds) : 0,
      amountCents: totalSeconds ? Math.floor((creatorPoolCents * sec) / totalSeconds) : 0,
    }))
    .sort((a, b) => b.amountCents - a.amountCents || b.seconds - a.seconds);
  const paid = shares.reduce((a, x) => a + x.amountCents, 0);
  const statement: FundStatement = {
    month: s.month,
    status: s.closedAt ? "closed" : "open",
    sponsoredCents,
    carryInCents,
    creatorPoolCents,
    emeraCents: sponsoredCents - creatorCents,
    totalSeconds,
    creators: shares.length,
    sponsors: sponsorships.filter((x) => x.status !== "refunded").length,
    closedAt: s.closedAt,
    sha256: null,
    rulesVersion: fundRules.version,
    sponsorships,
    shares,
    carryOutCents: creatorPoolCents - paid,
  };
  if (s.closedAt) statement.sha256 = sha256(canonical(statement));
  return statement;
}

function statements(): FundStatement[] {
  let carry = 0;
  return seeds.map((s) => {
    const st = build(s, carry);
    carry = st.carryOutCents;
    return st;
  });
}

const summary = (s: FundStatement): FundMonth => {
  const { rulesVersion, sponsorships, shares, carryOutCents, ...m } = s;
  return m;
};

function canonical(st: FundStatement): string {
  const sort = (v: unknown): unknown => (Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])])) : v);
  const { sha256: _h, closedAt: _c, ...rest } = st;
  return JSON.stringify(sort(rest));
}

const guard = () => {
  if (fundOff) throw new ApiError("not_found", "Not found.");
};

export function mockFund(): Fund {
  guard();
  const all = statements();
  const open = all[all.length - 1];
  const sponsors: FundSponsor[] = open.sponsorships
    .filter((x) => x.status === "paid")
    .map((x) => ({ name: x.sponsorName, url: x.sponsorUrl, amountCents: x.amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);
  return { rules: fundRules, month: summary(open), sponsors, history: all.slice(0, -1).reverse().map(summary) };
}

export function mockFundMonth(month: string): FundStatement {
  guard();
  const st = statements().find((s) => s.month === month);
  if (!st) throw new ApiError("not_found", "No money and no watch time that month.");
  return st;
}

const extraByPost = new Map<string, number>();

export function mockWatch(postId: string, authorHandle: string, viewerHandle: string, secs: number): number {
  guard();
  if (!Number.isInteger(secs) || secs < 1 || secs > 30) throw new ApiError("bad_seconds", "Seconds must be 1 to 30.");
  if (authorHandle === viewerHandle) return 0;
  const row = seconds.get(seeds[seeds.length - 1].month)!;
  row.set(authorHandle, (row.get(authorHandle) ?? 0) + secs);
  extraByPost.set(postId, (extraByPost.get(postId) ?? 0) + secs);
  return secs;
}

export function mockEarnings(handle: string, ownPosts: Post[]): Earnings {
  guard();
  const all = statements();
  const open = all[all.length - 1];
  const mine = open.shares.find((s) => s.handle === handle);
  const mySeconds = mine?.seconds ?? 0;
  const r = rng(handle.length * 31 + 3);
  const weights = ownPosts.map((_, i) => (r() + 0.3) / (i + 1));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const base = Math.max(0, mySeconds - ownPosts.reduce((a, p) => a + (extraByPost.get(p.id) ?? 0), 0));
  const topPosts = ownPosts
    .map((post, i) => ({ post, seconds: Math.floor((base * weights[i]) / sum) + (extraByPost.get(post.id) ?? 0) }))
    .filter((x) => x.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5);
  const months = all
    .filter((s) => s.status === "closed")
    .reverse()
    .flatMap((s) => s.shares.filter((x) => x.handle === handle).map((x) => ({ month: s.month, seconds: x.seconds, sharePpm: x.sharePpm, amountCents: x.amountCents })));
  return {
    rules: fundRules,
    thisMonth: { month: open.month, seconds: mySeconds, totalSeconds: open.totalSeconds, sharePpm: mine?.sharePpm ?? 0, estimateCents: mine?.amountCents ?? 0 },
    months,
    balanceCents: months.reduce((a, m) => a + m.amountCents, 0),
    topPosts,
  };
}

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function sha256(text: string): string {
  const bytes = Array.from(unescape(encodeURIComponent(text)), (ch) => ch.charCodeAt(0));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array<number>(64);
  const rot = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, k] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (k + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      k = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
    h[5] = (h[5] + f) | 0;
    h[6] = (h[6] + g) | 0;
    h[7] = (h[7] + k) | 0;
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
