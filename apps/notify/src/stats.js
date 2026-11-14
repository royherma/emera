import { device, isBotVisit, isTest, place, source, toMs } from "./people.js";

const DAY = 86_400_000;
export const bkkDay = (ms) => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10);

async function all(db, sql, ...args) {
  if (!db) return [];
  try {
    const q = db.prepare(sql);
    const { results } = await (args.length ? q.bind(...args) : q).all();
    return results || [];
  } catch (e) {
    console.log("[stats]", sql.slice(0, 60), String(e));
    return [];
  }
}

export async function load(env, { visitDays = 30 } = {}) {
  const since = new Date(Date.now() - visitDays * DAY).toISOString();
  const [early, visits, users, posts, media, reports, flags, likes, comments, follows, sponsors, checkouts] = await Promise.all([
    all(env.SITE_DB, "SELECT * FROM early_access ORDER BY id"),
    all(env.SITE_DB, "SELECT * FROM visits WHERE created_at >= ? AND bot = 0 ORDER BY id LIMIT 50000", since),
    all(env.API_DB, "SELECT id, email, handle, display_name, invited_by, created_at FROM users ORDER BY created_at"),
    all(env.API_DB, "SELECT id, user_id, caption, created_at FROM posts ORDER BY created_at"),
    all(env.API_DB, "SELECT post_id, kind, COUNT(*) AS n FROM media WHERE post_id IS NOT NULL GROUP BY post_id, kind"),
    all(env.API_DB, "SELECT id, post_id, reporter_user_id, copy_url, note, status, created_at FROM reports ORDER BY created_at"),
    all(env.API_DB, "SELECT id, reporter_user_id, target_type, target_id, reason, note, status, created_at FROM flags ORDER BY created_at"),
    all(env.API_DB, "SELECT COUNT(*) AS n FROM likes"),
    all(env.API_DB, "SELECT COUNT(*) AS n FROM comments"),
    all(env.API_DB, "SELECT COUNT(*) AS n FROM follows"),
    all(env.API_DB, `SELECT p.id, p.name, p.url, p.line, p.banner, p.contact_email AS email, p.demo, p.created_at,
      COALESCE(SUM(CASE WHEN s.status = 'paid' THEN s.amount_cents END), 0) AS paid_cents, MAX(s.month) AS last_month
      FROM sponsors p LEFT JOIN sponsorships s ON s.sponsor_id = p.id GROUP BY p.id ORDER BY p.created_at DESC LIMIT 100`),
    all(env.API_DB, "SELECT * FROM fund_checkouts ORDER BY created_at DESC LIMIT 200"),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  for (const u of users) u.test = isTest(env, u.email);
  for (const e of early) e.test = isTest(env, e.email, !!e.tester);
  const own = new Set(String(env.OWN_VISITORS || "").split(",").filter(Boolean));
  const visitsKept = visits.filter((v) => !isBotVisit(v));
  for (const v of visitsKept) v.test = !!v.tester || own.has(v.visitor);
  for (const p of posts) {
    const u = byId.get(p.user_id);
    p.handle = u?.handle || null;
    p.test = !!u?.test;
    p.media = media.filter((m) => m.post_id === p.id).map((m) => `${m.n} ${m.kind}`).join(", ");
  }
  for (const r of [...reports, ...flags]) {
    const u = byId.get(r.reporter_user_id);
    r.handle = u?.handle || null;
    r.test = !!u?.test;
  }
  return { early, visits: visitsKept, users, posts, reports, flags, likes: likes[0]?.n ?? 0, comments: comments[0]?.n ?? 0, follows: follows[0]?.n ?? 0, sponsors, checkouts };
}

function sessions(visits) {
  const out = new Map();
  for (const v of visits) {
    if (v.test) continue;
    const key = v.visitor || `anon-${v.id}`;
    const s = out.get(key);
    const at = toMs(v.created_at);
    if (!s) out.set(key, { visitor: key, first: at, last: at, pages: [v.path], place: place(v), device: device(v.ua), source: source(v), network: v.network, lang: v.lang });
    else {
      s.last = Math.max(s.last, at);
      s.first = Math.min(s.first, at);
      if (s.pages.length < 30) s.pages.push(v.path);
    }
  }
  return [...out.values()];
}

function series(days, rows) {
  const counts = Object.fromEntries(days.map((d) => [d, 0]));
  for (const ms of rows) {
    const d = bkkDay(ms);
    if (d in counts) counts[d]++;
  }
  return days.map((d) => counts[d]);
}

const lastDays = (n) => Array.from({ length: n }, (_, i) => bkkDay(Date.now() - (n - 1 - i) * DAY));

export function adminView(d) {
  const real = (xs) => xs.filter((x) => !x.test);
  const people = sessions(d.visits);
  const days = lastDays(30);
  const visitorDays = new Map();
  for (const v of d.visits) if (!v.test) visitorDays.set(`${v.visitor}|${bkkDay(toMs(v.created_at))}`, toMs(v.created_at));
  const posters = new Set(real(d.posts).map((p) => p.user_id));
  const since30 = Date.now() - 30 * DAY;
  const users30 = real(d.users).filter((u) => u.created_at >= since30);
  const sourceCounts = {};
  for (const s of people) sourceCounts[s.source] = (sourceCounts[s.source] || 0) + 1;
  const postsBy = {};
  for (const p of d.posts) postsBy[p.user_id] = (postsBy[p.user_id] || 0) + 1;
  return {
    at: Date.now(),
    totals: {
      visitors30: people.length,
      early: real(d.early).length, earlyTest: d.early.length - real(d.early).length,
      accounts: real(d.users).length, accountsTest: d.users.length - real(d.users).length,
      posts: real(d.posts).length, postsTest: d.posts.length - real(d.posts).length,
      likes: d.likes, comments: d.comments, follows: d.follows,
      reportsOpen: d.reports.filter((r) => r.status === "new").length, flagsOpen: d.flags.filter((f) => f.status === "new").length,
    },
    funnel: [
      ["Visited", people.length],
      ["Started sign-up", real(d.early).filter((e) => toMs(e.created_at) >= since30).length],
      ["Made an account", users30.length],
      ["Posted", users30.filter((u) => posters.has(u.id)).length],
    ],
    days,
    daily: {
      visitors: series(days, [...visitorDays.values()]),
      early: series(days, real(d.early).map((e) => toMs(e.created_at))),
      accounts: series(days, real(d.users).map((u) => u.created_at)),
      posts: series(days, real(d.posts).map((p) => p.created_at)),
    },
    sources: Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 8),
    visitors: people.sort((a, b) => b.last - a.last).slice(0, 60),
    accounts: [...d.users].reverse().slice(0, 300).map((u) => ({
      handle: u.handle, name: u.display_name, email: u.email, at: u.created_at, test: u.test, posts: postsBy[u.id] || 0,
    })),
    early: [...d.early].reverse().slice(0, 300).map((e) => ({ email: e.email, at: toMs(e.created_at), source: e.source, referrer: e.referrer, place: place(e), device: device(e.ua), test: e.test })),
    posts: [...d.posts].reverse().slice(0, 60).map((p) => ({ id: p.id, handle: p.handle, caption: (p.caption || "").slice(0, 140), media: p.media, at: p.created_at, test: p.test })),
    reports: [...d.reports].reverse().slice(0, 60).map((r) => ({ id: r.id, post_id: r.post_id, copy_url: r.copy_url, note: r.note, status: r.status, handle: r.handle, at: r.created_at, test: r.test })),
    flags: [...d.flags].reverse().slice(0, 60).map((f) => ({ target: `${f.target_type} ${f.target_id}`, reason: f.reason, note: f.note, status: f.status, handle: f.handle, at: f.created_at, test: f.test })),
    checkouts: (d.checkouts || []).map((x) => ({ name: x.sponsor_name, email: x.email, status: x.status, monthlyCents: x.monthly_cents, months: x.months, totalCents: x.amount_total, discountCents: x.discount_cents, promo: x.promo_code, at: x.created_at, test: !!x.tester || isTest({}, x.email) })),
    sponsors: (d.sponsors || []).map((x) => ({ id: x.id, name: x.name, url: x.url, line: x.line, banner: x.banner, email: x.email, paidCents: x.paid_cents, lastMonth: x.last_month, at: x.created_at, test: !!x.demo || isTest({}, x.email || "") })),
  };
}

export function ledgerView(d) {
  const users = d.users.filter((u) => !u.test);
  const posts = d.posts.filter((p) => !p.test);
  const reports = d.reports.filter((r) => !r.test);
  const first = Math.min(...users.map((u) => u.created_at).filter(Number.isFinite), Date.now());
  const span = Math.min(365, Math.max(14, Math.ceil((Date.now() - first) / DAY) + 1));
  const days = lastDays(span);
  const cumulative = (msList) => {
    const before = msList.filter((ms) => bkkDay(ms) < days[0]).length;
    let run = before;
    return series(days, msList).map((n) => (run += n));
  };
  const events = [
    ...users.map((u, i) => ({ type: "account", n: i + 1, at: u.created_at, handle: u.handle || null })),
    ...posts.map((p, i) => ({ type: "post", n: i + 1, at: p.created_at, handle: p.handle, id: p.id })),
    ...reports.map((r, i) => ({ type: "report", n: i + 1, at: r.created_at })),
  ].sort((a, b) => b.at - a.at);
  return {
    at: Date.now(),
    totals: { accounts: users.length, posts: posts.length, reports: reports.length },
    days,
    cumulative: {
      accounts: cumulative(users.map((u) => u.created_at)),
      posts: cumulative(posts.map((p) => p.created_at)),
    },
    events: events.slice(0, 200),
  };
}

export function summaryLines(d, now = Date.now()) {
  const todayStart = Date.parse(`${bkkDay(now)}T00:00:00+07:00`);
  const from = todayStart - DAY;
  const inDay = (ms) => ms >= from && ms < todayStart;
  const visitors = new Set(d.visits.filter((v) => !v.test && inDay(toMs(v.created_at))).map((v) => v.visitor)).size;
  const real = (xs) => xs.filter((x) => !x.test);
  return {
    day: bkkDay(from),
    visitors,
    early: real(d.early).filter((e) => inDay(toMs(e.created_at))).length,
    accounts: real(d.users).filter((u) => inDay(u.created_at)).length,
    posts: real(d.posts).filter((p) => inDay(p.created_at)).length,
    reports: real(d.reports).filter((r) => inDay(r.created_at)).length,
    totals: { accounts: real(d.users).length, posts: real(d.posts).length },
  };
}
