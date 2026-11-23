import { bangkok, clockLine, connection, device, isBotVisit, isTest, networkKind, place, screenLine, screenOf, source, toMs } from "./people.js";
import { adminView, ledgerView, load, summaryLines } from "./stats.js";
import { ADMIN_HTML } from "./admin-page.js";

const enc = new TextEncoder();

export function esc(t) {
  return String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function silent(env) {
  return env.ENVIRONMENT !== "production" && env.SLACK_NON_PROD !== "1";
}

export async function slackPost(env, body) {
  if (!env.SLACK_BOT_TOKEN || silent(env)) {
    console.log("[slack:noop]", JSON.stringify(body).slice(0, 400));
    return null;
  }
  try {
    const r = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` },
      body: JSON.stringify({ channel: env.SLACK_CHANNEL, unfurl_links: false, unfurl_media: false, ...body }),
    });
    const d = await r.json();
    if (!d.ok) console.log("[slack:fail]", d.error);
    return d.ok ? d.ts || "ok" : null;
  } catch (e) {
    console.log("[slack:error]", String(e));
    return null;
  }
}

export function blocks(a) {
  const title = a.test ? `Test - ${a.title}` : a.title;
  const head = `${a.test ? "🧪" : a.icon}  *${title}*${a.detail ? `  ·  ${a.detail}` : ""}`;
  const facts = (a.facts || []).filter(Boolean).join("  ·  ");
  const links = (a.links || []).filter(Boolean).map(([label, url]) => `<${url}|${label} →>`).join("     ");
  const rows = (a.rows || []).filter(Boolean);
  return {
    text: `${title}${a.detail ? ` · ${a.detail}` : ""}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: head } },
      ...(rows.length ? [{ type: "section", text: { type: "mrkdwn", text: rows.join("\n").slice(0, 2900) } }] : []),
      ...(facts ? [{ type: "context", elements: [{ type: "mrkdwn", text: facts.slice(0, 2900) }] }] : []),
      ...(links ? [{ type: "context", elements: [{ type: "mrkdwn", text: links }] }] : []),
    ],
  };
}

export async function slack(env, a, thread = null) {
  return slackPost(env, { ...blocks(a), ...(thread ? { thread_ts: thread.ts, reply_broadcast: !!thread.broadcast } : {}) });
}

export async function verifyGithub(secret, body, header) {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  const want = header.slice(7);
  if (want.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

const link = (url, label) => `<${url}|${esc(label)}>`;

export function githubText(event, p) {
  const who = p.sender ? link(p.sender.html_url, p.sender.login) : "someone";
  const repo = p.repository ? link(p.repository.html_url, p.repository.full_name) : "the repo";
  const stars = p.repository ? `  ·  ${p.repository.stargazers_count} stars, ${p.repository.forks_count} forks` : "";
  switch (event) {
    case "ping":
      return `:white_check_mark: *GitHub hooked up*  ·  ${repo}`;
    case "fork":
      return `:fork_and_knife: *New fork*  ·  ${who} forked ${repo} → ${link(p.forkee.html_url, p.forkee.full_name)}${stars}`;
    case "watch":
      return p.action === "started" ? `:star: *New star*  ·  ${who} starred ${repo}${stars}` : null;
    case "star":
      return p.action === "created" ? `:star: *New star*  ·  ${who} starred ${repo}${stars}` : null;
    case "issues":
      return ["opened", "reopened"].includes(p.action)
        ? `:memo: *Issue ${p.action}*  ·  ${who}: ${link(p.issue.html_url, `#${p.issue.number} ${p.issue.title}`)}`
        : null;
    case "pull_request":
      if (p.action === "opened") return `:twisted_rightwards_arrows: *New PR*  ·  ${who}: ${link(p.pull_request.html_url, `#${p.pull_request.number} ${p.pull_request.title}`)}`;
      if (p.action === "closed" && p.pull_request.merged) return `:tada: *PR merged*  ·  ${link(p.pull_request.html_url, `#${p.pull_request.number} ${p.pull_request.title}`)}`;
      return null;
    case "discussion":
      return p.action === "created" ? `:speech_balloon: *New discussion*  ·  ${who}: ${link(p.discussion.html_url, p.discussion.title)}` : null;
    case "release":
      return p.action === "published" ? `:rocket: *Release*  ·  ${link(p.release.html_url, p.release.tag_name)}` : null;
    case "public":
      return `:earth_africa: *Repo is now public*  ·  ${repo}`;
    case "member":
      return p.action === "added" ? `:busts_in_silhouette: *Collaborator added*  ·  ${link(p.member.html_url, p.member.login)}` : null;
    default:
      return null;
  }
}

async function github(request, env) {
  const body = await request.text();
  if (!(await verifyGithub(env.GITHUB_WEBHOOK_SECRET, body, request.headers.get("x-hub-signature-256")))) {
    return new Response("bad signature", { status: 401 });
  }
  const text = githubText(request.headers.get("x-github-event"), JSON.parse(body));
  if (text) await slackPost(env, { text });
  return new Response("ok");
}

const MIN = 60_000;
const site = (env) => env.SITE_URL || "https://emera.social";
const adminLink = (env) => ["Admin", `${site(env)}/admin`];
const profileLink = (env, handle) => handle && ["Profile", `${site(env)}/@${encodeURIComponent(handle)}`];
const stamp = (ms) => bangkok(ms ?? Date.now());

async function realCount(env, db, sql) {
  const { results } = await db.prepare(sql).all();
  return results.filter((r) => !isTest(env, r.email, !!r.tester)).length;
}

async function threadFor(env, visitor) {
  return visitor ? env.STATE.get(`thread:${visitor}`) : null;
}

async function sendVisit(env, r) {
  if (isBotVisit(r) || !screenOf(r) || r.tester || !r.visitor || (await env.STATE.get(`own:${r.visitor}`))) return false;
  const prior = await env.SITE_DB.prepare("SELECT COUNT(*) AS n, MAX(created_at) AS last FROM visits WHERE visitor = ? AND id < ? AND bot = 0").bind(r.visitor, r.id).first();
  const thread = await threadFor(env, r.visitor);
  const at = toMs(r.created_at);
  if (thread && prior?.last && at - toMs(prior.last) < 30 * MIN) {
    await slackPost(env, { thread_ts: thread, text: `➡️ \`${esc(r.path)}\`  ·  ${stamp(at)}` });
    return;
  }
  const visits = await env.SITE_DB.prepare("SELECT COUNT(DISTINCT substr(created_at, 1, 10)) AS d FROM visits WHERE visitor = ? AND id < ? AND bot = 0").bind(r.visitor, r.id).first();
  const sc = screenOf(r);
  const langs = [...new Set(sc?.langs?.length ? sc.langs : r.lang ? [r.lang] : [])];
  const ts = await slack(env, {
    icon: "👀",
    title: prior?.n ? `Returning visitor (day ${(visits?.d ?? 0) + 1})` : "New visitor",
    detail: place(r) || "somewhere",
    rows: [
      `🔗 *from* ${source(r)}${r.referrer ? `  _${esc(r.referrer.slice(0, 120))}_` : ""}`,
      `🛬 *landed* \`${esc(r.path)}\`${r.utm ? `  ·  \`${esc(r.utm)}\`` : ""}`,
      clockLine(r, sc) && `🕐 *their time* ${esc(clockLine(r, sc))}`,
      device(r.ua, sc) && `*device* ${esc(device(r.ua, sc))}`,
      screenLine(sc) && `🖥️ *screen* ${screenLine(sc)}`,
      r.network && `📡 *network* \`${networkKind(r.network)}\` · ${esc(r.network)}`,
      connection(sc, r.network) && `📶 *connection* ${connection(sc, r.network)}`,
      langs.length && `🗣️ *language* ${langs.map((l) => `\`${esc(l)}\``).join(" ")}`,
    ],
    facts: [stamp(at)],
    links: [adminLink(env)],
  });
  if (ts) await env.STATE.put(`thread:${r.visitor}`, ts, { expirationTtl: 7 * 24 * 3600 });
}

async function sendEarly(env, r) {
  const test = isTest(env, r.email, !!r.tester);
  const n = await realCount(env, env.SITE_DB, "SELECT email, tester FROM early_access");
  const thread = await threadFor(env, r.visitor);
  const first = r.visitor ? await env.SITE_DB.prepare("SELECT referrer, utm, ua FROM visits WHERE visitor = ? ORDER BY id LIMIT 1").bind(r.visitor).first().catch(() => null) : null;
  await slack(env, {
    icon: "👋",
    title: "Started sign-up",
    detail: esc(r.email),
    facts: [place(r), device(r.ua), `from ${source(first || r)}`, r.source && r.source !== "site" ? `form \`${esc(r.source)}\`` : null, `*${n}* started so far`, stamp(toMs(r.created_at))],
    links: [adminLink(env)],
    test,
  }, thread ? { ts: thread, broadcast: true } : null);
}

async function sendSponsor(env, r) {
  const thread = await threadFor(env, r.visitor);
  await slack(env, {
    icon: "🤝",
    title: "Sponsor interest",
    detail: `*${esc(r.company)}*`,
    facts: [esc(r.email), r.monthly_cents ? `$${(r.monthly_cents / 100).toLocaleString("en-US")}/mo` : "no amount given", place(r), device(r.ua), stamp(toMs(r.created_at))],
    links: [r.url && ["Their site", r.url], adminLink(env)],
    test: isTest(env, r.email, !!r.tester),
  }, thread ? { ts: thread, broadcast: true } : null);
}

async function sendEnterprise(env, r) {
  const thread = await threadFor(env, r.visitor);
  await slack(env, {
    icon: "🛡️",
    title: "Enterprise Protect lead",
    detail: `*${esc(r.company)}*: ${esc(r.name)}`,
    facts: [esc(r.email), r.creators ? `${Number(r.creators).toLocaleString("en-US")} creators` : "no count given", place(r), device(r.ua), stamp(toMs(r.created_at))],
    links: [adminLink(env)],
    test: isTest(env, r.email, !!r.tester),
  }, thread ? { ts: thread, broadcast: true } : null);
}

const PLAN_PRICE = { creator: "$10/mo", pro: "$100/mo" };
const userOf = (env, id) => (id ? env.API_DB.prepare("SELECT email, handle FROM users WHERE id = ?").bind(id).first() : null);
const ago = (from, to) => { const d = Math.round((to - from) / 86400000); return d <= 0 ? "same day" : `${d} day${d === 1 ? "" : "s"}`; };

async function sendPlanEvent(env, r) {
  const u = await userOf(env, r.user_id);
  const email = u?.email || r.email;
  const live = await env.API_DB.prepare("SELECT COUNT(*) AS n FROM users WHERE plan != 'free' AND (plan_until IS NULL OR plan_until > ?)").bind(r.created_at).first();
  const title = r.kind === "ended" ? "Protect plan ended" : r.kind === "paid_no_account" ? "Protect paid, account not made yet" : `New Protect ${r.plan === "pro" ? "Pro" : "Creator"} plan`;
  await slack(env, {
    icon: r.kind === "ended" ? "👋" : "💰",
    title,
    detail: u?.handle ? `*@${esc(u.handle)}*` : esc(email || "?"),
    facts: [r.kind !== "ended" && PLAN_PRICE[r.plan], esc(email || ""), r.plan_until && `paid until ${stamp(r.plan_until)}`, `*${live?.n ?? "?"}* on a paid plan`, stamp(r.created_at)],
    links: [profileLink(env, u?.handle), adminLink(env)],
    test: isTest(env, email),
  });
}

async function sendScan(env, r) {
  const { results } = await env.API_DB.prepare("SELECT site, url FROM matches WHERE post_id = ? AND user_id = ? AND found_at = ? LIMIT 50").bind(r.post_id, r.user_id, r.last_scanned_at).all();
  if (!results.length) return false;
  const u = await userOf(env, r.user_id);
  const sites = [...new Set(results.map((m) => m.site))];
  await slack(env, {
    icon: "🔎",
    title: `${results.length} possible cop${results.length === 1 ? "y" : "ies"} found`,
    detail: `@${esc(u?.handle || "?")}`,
    rows: results.slice(0, 5).map((m) => `• <${m.url}|${esc(m.site)}>`),
    facts: [sites.length > 5 ? `${sites.length} sites` : sites.map(esc).join(", "), stamp(r.last_scanned_at)],
    links: [["Original", `${site(env)}/p/${r.post_id}`], adminLink(env)],
    test: isTest(env, u?.email),
  });
}

const takedownFacts = (t) => [esc(t.site), t.method === "email" ? `email to ${esc(t.target || "?")}` : "platform form"];

async function sendTakedownReady(env, r) {
  const u = await userOf(env, r.user_id);
  const waiting = await env.API_DB.prepare("SELECT COUNT(*) AS n FROM takedowns WHERE status = 'ready'").first();
  await slack(env, {
    icon: "⚖️",
    title: "Takedown waiting for your OK",
    detail: `@${esc(u?.handle || "?")} signed as ${esc(r.signer_name)}`,
    rows: [`Copy: <${r.copy_url}|${esc(r.copy_url.slice(0, 80))}>`, r.recipient_note && `_${esc(r.recipient_note)}_`],
    facts: [...takedownFacts(r), `*${waiting?.n ?? "?"}* waiting`, stamp(r.created_at)],
    links: [["Open the desk", `${site(env)}/admin`], ["Original", `${site(env)}/p/${r.post_id}`]],
    test: isTest(env, u?.email),
  });
}

async function sendTakedownSent(env, r) {
  const u = await userOf(env, r.user_id);
  await slack(env, {
    icon: "📨",
    title: r.sent_via === "form" ? "Takedown filed by form" : "Takedown sent",
    detail: `@${esc(u?.handle || "?")}`,
    rows: [`Copy: <${r.copy_url}|${esc(r.copy_url.slice(0, 80))}>`],
    facts: [...takedownFacts(r), "rechecked daily", stamp(r.sent_at)],
    links: [adminLink(env)],
    test: isTest(env, u?.email),
  });
}

async function sendTakedownRemoved(env, r) {
  const u = await userOf(env, r.user_id);
  const total = await env.API_DB.prepare("SELECT COUNT(*) AS n FROM takedowns WHERE status = 'removed'").first();
  await slack(env, {
    icon: "🏆",
    title: "Copy removed",
    detail: `@${esc(u?.handle || "?")} on ${esc(r.site)}`,
    rows: [esc(r.check_reason || "")],
    facts: [`${ago(r.sent_at || r.created_at, r.removed_at)} after filing`, `*${total?.n ?? "?"}* removed so far`, stamp(r.removed_at)],
    links: [["Receipt", `${site(env)}/takedown/${r.id}`], profileLink(env, u?.handle)],
    test: isTest(env, u?.email),
  });
}

async function sendTakedownStuck(env, r) {
  const u = await userOf(env, r.user_id);
  await slack(env, {
    icon: "⚠️",
    title: "Copy still up after 30 days",
    detail: `@${esc(u?.handle || "?")} on ${esc(r.site)}`,
    rows: [`Copy: <${r.copy_url}|${esc(r.copy_url.slice(0, 80))}>`, esc(r.check_reason || "")],
    facts: [...takedownFacts(r), stamp(r.last_check_at)],
    links: [["Open the desk", `${site(env)}/admin`]],
    test: isTest(env, u?.email),
  });
}

async function sendUser(env, r) {
  const test = isTest(env, r.email);
  const n = await realCount(env, env.API_DB, "SELECT email FROM users");
  const early = env.SITE_DB ? await env.SITE_DB.prepare("SELECT created_at, visitor FROM early_access WHERE email = ?").bind(r.email.toLowerCase()).first().catch(() => null) : null;
  const inviter = r.invited_by ? await env.API_DB.prepare("SELECT handle FROM users WHERE id = ?").bind(r.invited_by).first().catch(() => null) : null;
  const thread = await threadFor(env, early?.visitor);
  await slack(env, {
    icon: "🎉",
    title: "New account",
    detail: r.handle ? `*@${esc(r.handle)}*` : "no handle picked",
    facts: [
      r.display_name && esc(r.display_name),
      esc(r.email),
      inviter?.handle ? `invited by @${esc(inviter.handle)}` : r.invited_by ? "invited" : null,
      `*${n}* accounts`,
      stamp(r.created_at),
    ],
    links: [profileLink(env, r.handle), adminLink(env)],
    test,
  }, thread ? { ts: thread, broadcast: true } : null);
}

async function sendPost(env, r) {
  const user = await env.API_DB.prepare("SELECT email, handle FROM users WHERE id = ?").bind(r.user_id).first();
  const { results: media } = await env.API_DB.prepare("SELECT kind, COUNT(*) AS n FROM media WHERE post_id = ? GROUP BY kind").bind(r.id).all();
  const mine = await env.API_DB.prepare("SELECT COUNT(*) AS n FROM posts WHERE user_id = ? AND created_at <= ?").bind(r.user_id, r.created_at).first();
  const total = await env.API_DB.prepare("SELECT COUNT(*) AS n FROM posts").first();
  await slack(env, {
    icon: "🖼️",
    title: mine?.n === 1 ? "First post" : "New post",
    detail: `@${esc(user?.handle || "?")}`,
    rows: [r.caption && `>${esc(r.caption).slice(0, 400).replace(/\n/g, "\n>")}`],
    facts: [media.map((m) => `${m.n} ${m.kind}`).join(", ") || null, `post ${mine?.n ?? "?"} for them`, `*${total?.n ?? "?"}* posts on Emera`, stamp(r.created_at)],
    links: [["Post", `${site(env)}/p/${r.id}`], profileLink(env, user?.handle), adminLink(env)],
    test: isTest(env, user?.email),
  });
}

async function sendReport(env, r) {
  const user = await env.API_DB.prepare("SELECT email, handle FROM users WHERE id = ?").bind(r.reporter_user_id).first();
  const open = await env.API_DB.prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'new'").first();
  await slack(env, {
    icon: "🚨",
    title: "Copy reported",
    detail: `@${esc(user?.handle || "?")} found a copy`,
    rows: [r.note && `>${esc(r.note).slice(0, 500)}`],
    facts: [esc(user?.email), `*${open?.n ?? "?"}* open`, stamp(r.created_at)],
    links: [["The copy", r.copy_url], ["Their post", `${site(env)}/p/${r.post_id}`], adminLink(env)],
    test: isTest(env, user?.email),
  });
}

async function sendFlag(env, r) {
  const user = await env.API_DB.prepare("SELECT email, handle FROM users WHERE id = ?").bind(r.reporter_user_id).first();
  const open = await env.API_DB.prepare("SELECT COUNT(*) AS n FROM flags WHERE status = 'new'").first();
  const target = r.target_type === "post" ? ["Post", `${site(env)}/p/${r.target_id}`] : null;
  await slack(env, {
    icon: "🚩",
    title: `Flagged ${esc(r.target_type)}`,
    detail: esc(r.reason),
    rows: [r.note && `>${esc(r.note).slice(0, 500)}`],
    facts: [`${esc(r.target_id)}`, `by @${esc(user?.handle || "?")}`, `*${open?.n ?? "?"}* open`, stamp(r.created_at)],
    links: [target, adminLink(env)],
    test: isTest(env, user?.email),
  });
}

export const FEEDS = [
  {
    key: "visits", db: "SITE_DB", sql: "SELECT *, id AS cursor FROM visits WHERE id > ? ORDER BY id LIMIT 40", max: "SELECT COALESCE(MAX(id), 0) AS m FROM visits",
    ready: (r, now) => !!r.screen || !!r.bot || now - toMs(r.created_at) > 2 * MIN,
    send: sendVisit,
  },
  { key: "early", db: "SITE_DB", sql: "SELECT *, id AS cursor FROM early_access WHERE id > ? ORDER BY id LIMIT 20", max: "SELECT COALESCE(MAX(id), 0) AS m FROM early_access", send: sendEarly },
  { key: "sponsors", db: "SITE_DB", sql: "SELECT *, id AS cursor FROM sponsor_interest WHERE id > ? ORDER BY id LIMIT 20", max: "SELECT COALESCE(MAX(id), 0) AS m FROM sponsor_interest", send: sendSponsor },
  { key: "enterprise", db: "SITE_DB", sql: "SELECT *, id AS cursor FROM enterprise_interest WHERE id > ? ORDER BY id LIMIT 20", max: "SELECT COALESCE(MAX(id), 0) AS m FROM enterprise_interest", send: sendEnterprise },
  {
    key: "users", db: "API_DB",
    sql: "SELECT id, email, handle, display_name, invited_by, created_at, created_at AS cursor FROM users WHERE created_at > ? ORDER BY created_at LIMIT 20",
    max: "SELECT COALESCE(MAX(created_at), 0) AS m FROM users",
    ready: (r, now) => !!r.handle || now - r.created_at > 10 * MIN,
    send: sendUser,
  },
  { key: "posts", db: "API_DB", sql: "SELECT id, user_id, caption, created_at, created_at AS cursor FROM posts WHERE created_at > ? ORDER BY created_at LIMIT 20", max: "SELECT COALESCE(MAX(created_at), 0) AS m FROM posts", send: sendPost },
  { key: "reports", db: "API_DB", sql: "SELECT *, created_at AS cursor FROM reports WHERE created_at > ? ORDER BY created_at LIMIT 20", max: "SELECT COALESCE(MAX(created_at), 0) AS m FROM reports", send: sendReport },
  {
    key: "paid", db: "API_DB",
    sql: `SELECT s.stripe_session, p.name, p.url, p.line, p.banner, p.contact_email AS email, p.demo, SUM(s.amount_cents) AS cents, COUNT(*) AS months,
      MIN(s.month) AS first_month, MAX(s.month) AS last_month, MAX(s.created_at) AS cursor, MAX(k.promo_code) AS promo, MAX(k.discount_cents) AS discount, MAX(k.tester) AS tester
      FROM sponsorships s JOIN sponsors p ON p.id = s.sponsor_id LEFT JOIN fund_checkouts k ON k.session_id = s.stripe_session
      WHERE s.stripe_session IS NOT NULL AND s.created_at > ? GROUP BY s.stripe_session ORDER BY cursor LIMIT 20`,
    max: "SELECT COALESCE(MAX(created_at), 0) AS m FROM sponsorships",
    send: sendPaid,
  },
  { key: "plans", db: "API_DB", sql: "SELECT *, id AS cursor FROM plan_events WHERE id > ? ORDER BY id LIMIT 20", max: "SELECT COALESCE(MAX(id), 0) AS m FROM plan_events", send: sendPlanEvent },
  { key: "scans", db: "API_DB", sql: "SELECT *, last_scanned_at AS cursor FROM scans WHERE last_scanned_at > ? ORDER BY last_scanned_at LIMIT 20", max: "SELECT COALESCE(MAX(last_scanned_at), 0) AS m FROM scans", send: sendScan },
  { key: "takedown_ready", db: "API_DB", sql: "SELECT *, created_at AS cursor FROM takedowns WHERE created_at > ? ORDER BY created_at LIMIT 20", max: "SELECT COALESCE(MAX(created_at), 0) AS m FROM takedowns", send: sendTakedownReady },
  { key: "takedown_sent", db: "API_DB", sql: "SELECT *, sent_at AS cursor FROM takedowns WHERE sent_at > ? ORDER BY sent_at LIMIT 20", max: "SELECT COALESCE(MAX(sent_at), 0) AS m FROM takedowns", send: sendTakedownSent },
  { key: "takedown_removed", db: "API_DB", sql: "SELECT *, removed_at AS cursor FROM takedowns WHERE removed_at > ? ORDER BY removed_at LIMIT 20", max: "SELECT COALESCE(MAX(removed_at), 0) AS m FROM takedowns", send: sendTakedownRemoved },
  { key: "takedown_stuck", db: "API_DB", sql: "SELECT *, last_check_at AS cursor FROM takedowns WHERE status = 'still_up' AND last_check_at > ? ORDER BY last_check_at LIMIT 20", max: "SELECT COALESCE(MAX(last_check_at), 0) AS m FROM takedowns WHERE status = 'still_up'", send: sendTakedownStuck },
  { key: "flags", db: "API_DB", sql: "SELECT *, created_at AS cursor FROM flags WHERE created_at > ? ORDER BY created_at LIMIT 20", max: "SELECT COALESCE(MAX(created_at), 0) AS m FROM flags", send: sendFlag },
];

export async function poll(env, now = Date.now()) {
  const sent = {};
  for (const f of FEEDS) {
    const db = env[f.db];
    if (!db) continue;
    try {
      const saved = await env.STATE.get(`cursor:${f.key}`);
      if (saved === null) {
        const { m } = await db.prepare(f.max).first();
        await env.STATE.put(`cursor:${f.key}`, String(m));
        continue;
      }
      const { results } = await db.prepare(f.sql).bind(Number(saved)).all();
      for (const r of results) {
        if (f.ready && !f.ready(r, now)) break;
        const posted = await f.send(env, r);
        await env.STATE.put(`cursor:${f.key}`, String(r.cursor));
        if (posted !== false) sent[f.key] = (sent[f.key] || 0) + 1;
      }
    } catch (e) {
      console.log(`[poll:${f.key}]`, String(e));
    }
  }
  return sent;
}

export async function dailySummary(env, now = Date.now()) {
  const s = summaryLines(await load(env, { visitDays: 2 }), now);
  return slack(env, {
    icon: "📊",
    title: `Yesterday on Emera`,
    detail: s.day,
    rows: [
      `👀 *${s.visitors}* visitors  ·  👋 *${s.early}* started sign-up  ·  🎉 *${s.accounts}* accounts  ·  🖼️ *${s.posts}* posts${s.reports ? `  ·  🚨 *${s.reports}* copy reports` : ""}`,
      `All time: *${s.totals.accounts}* accounts, *${s.totals.posts}* posts`,
    ],
    facts: ["test accounts left out", stamp(now)],
    links: [adminLink(env), ["Public ledger", `${site(env)}/ledger`]],
  });
}

export async function inboundMail(message, env) {
  const h = message.headers;
  const from = h.get("from") || message.from;
  const subject = h.get("subject") || "(no subject)";
  let forwarded = "not forwarded: MAIL_FORWARD_TO unset";
  if (env.MAIL_FORWARD_TO) {
    try {
      await message.forward(env.MAIL_FORWARD_TO);
      forwarded = "forwarded to the inbox";
    } catch (e) {
      forwarded = `forward failed: ${String(e).slice(0, 200)}`;
    }
  }
  await slack(env, {
    icon: forwarded.startsWith("forwarded") ? "✉️" : "🚨",
    title: `Email to ${esc(message.to)}`,
    detail: `*${esc(subject).slice(0, 200)}*`,
    facts: [`from ${esc(from).slice(0, 200)}`, `${Math.round((message.rawSize || 0) / 1024)} KB`, forwarded, "check spam if it is not in the inbox", stamp()],
  });
  return forwarded;
}

async function sendPaid(env, r) {
  const months = r.months === 1 ? r.first_month : `${r.first_month} to ${r.last_month}`;
  await slack(env, {
    icon: "💳",
    title: "Sponsor paid",
    detail: `*${esc(r.name)}*${r.line ? ` - ${esc(r.line)}` : ""}`,
    facts: [`$${(r.cents / 100).toLocaleString("en-US")} for ${months}`, r.promo ? `code ${esc(r.promo)} took $${(r.discount / 100).toLocaleString("en-US")} off` : null, r.email ? esc(r.email) : null, `banner ${r.banner}`, stamp(r.cursor)],
    links: [r.url && ["Their site", r.url], adminLink(env)],
    test: isTest(env, r.email || "", !!r.demo || !!r.tester),
  });
}

async function setBanner(request, env) {
  if (!authed(request, env)) return Response.json({ ok: false, error: "bad_key" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!["approved", "rejected", "pending"].includes(body.banner) || typeof body.id !== "string") return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
  const res = await env.API_DB.prepare("UPDATE sponsors SET banner = ? WHERE id = ?").bind(body.banner, body.id).run();
  return Response.json({ ok: !!res.meta?.changes, banner: body.banner }, { status: res.meta?.changes ? 200 : 404 });
}

const ACTIONS = new Set(["send-email", "mark-filed", "reject", "counter-notice"]);

async function takedownList(env) {
  const rows = (await env.API_DB.prepare(
    `SELECT t.id, t.copy_url, t.site, t.method, t.target, t.recipient_note, t.notice, t.status, t.created_at, t.sent_at, t.last_http, t.check_reason, u.handle
     FROM takedowns t JOIN users u ON u.id = t.user_id WHERE t.status IN ('ready', 'sent', 'still_up') ORDER BY CASE t.status WHEN 'ready' THEN 0 ELSE 1 END, t.created_at LIMIT 100`,
  ).all()).results;
  return rows.map((r) => ({ id: r.id, url: r.copy_url, site: r.site, method: r.method, target: r.target, note: r.recipient_note, notice: r.notice, status: r.status, at: r.created_at, sentAt: r.sent_at, http: r.last_http, reason: r.check_reason, handle: r.handle }));
}

async function takedownAct(request, env, id, action) {
  if (!authed(request, env)) return Response.json({ ok: false, error: "bad_key" }, { status: 401 });
  if (!ACTIONS.has(action) || !/^[\w-]{4,40}$/.test(id)) return Response.json({ ok: false, error: "bad_action" }, { status: 400 });
  if (!env.API_URL || !env.FUND_ADMIN_KEY) return Response.json({ ok: false, error: "not_configured" }, { status: 503 });
  const body = action === "reject" ? JSON.stringify({ reason: String((await request.json().catch(() => ({}))).reason || "") }) : undefined;
  const res = await fetch(`${env.API_URL}/v1/admin/takedowns/${id}/${action}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.FUND_ADMIN_KEY}`, "content-type": "application/json" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  return Response.json({ ok: res.ok, status: json.takedown?.status, error: json.error?.message }, { status: res.ok ? 200 : res.status });
}

function authed(request, env) {
  return !!env.ADMIN_KEY && request.headers.get("x-admin-key") === env.ADMIN_KEY;
}

const cors = { "access-control-allow-origin": "*", "cache-control": "public, max-age=60" };

export { takedownList, takedownAct };

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && pathname === "/github") return github(request, env);
    if (pathname === "/health") return Response.json({ ok: true, env: env.ENVIRONMENT, silent: silent(env) });
    if (pathname === "/api/ledger") return Response.json(ledgerView(await load(env, { visitDays: 1 })), { headers: cors });
    if (pathname === "/admin" || pathname === "/admin/") return new Response(ADMIN_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
    if (request.method === "POST" && pathname === "/admin/sponsor") return setBanner(request, env);
    if (pathname === "/admin/takedowns" && request.method === "GET") {
      if (!authed(request, env)) return Response.json({ ok: false, error: "bad_key" }, { status: 401 });
      return Response.json({ takedowns: await takedownList(env) }, { headers: { "cache-control": "no-store" } });
    }
    const act = request.method === "POST" && pathname.match(/^\/admin\/takedowns\/([\w-]+)\/([\w-]+)$/);
    if (act) return takedownAct(request, env, act[1], act[2]);
    if (pathname === "/admin/data") {
      if (!authed(request, env)) return Response.json({ ok: false, error: "bad_key" }, { status: 401 });
      const mine = (request.headers.get("cookie") || "").match(/(?:^|;\s*)em_v=([\w-]{8,64})/)?.[1];
      if (mine) await env.STATE.put(`own:${mine}`, "1");
      const own = await env.STATE.list({ prefix: "own:" }).then((l) => l.keys.map((k) => k.name.slice(4))).catch(() => []);
      return Response.json(adminView(await load({ ...env, OWN_VISITORS: own.join(",") })), { headers: { "cache-control": "no-store" } });
    }
    return new Response("not found", { status: 404 });
  },
  async email(message, env) {
    await inboundMail(message, env);
  },
  async scheduled(event, env, ctx) {
    if (event.cron === "0 2 * * *") ctx.waitUntil(dailySummary(env));
    else ctx.waitUntil(poll(env));
  },
};
