import { bangkok, device, isTest, place, source, theirTime, toMs } from "./people.js";
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
  if (r.bot || r.tester || !r.visitor) return false;
  const prior = await env.SITE_DB.prepare("SELECT COUNT(*) AS n, MAX(created_at) AS last FROM visits WHERE visitor = ? AND id < ? AND bot = 0").bind(r.visitor, r.id).first();
  const thread = await threadFor(env, r.visitor);
  const at = toMs(r.created_at);
  if (thread && prior?.last && at - toMs(prior.last) < 30 * MIN) {
    await slackPost(env, { thread_ts: thread, text: `➡️ \`${esc(r.path)}\`  ·  ${stamp(at)}` });
    return;
  }
  const visits = await env.SITE_DB.prepare("SELECT COUNT(DISTINCT substr(created_at, 1, 10)) AS d FROM visits WHERE visitor = ? AND id < ? AND bot = 0").bind(r.visitor, r.id).first();
  const ts = await slack(env, {
    icon: "👀",
    title: prior?.n ? `Returning visitor (day ${(visits?.d ?? 0) + 1})` : "New visitor",
    detail: place(r) || "somewhere",
    rows: [
      `🔗 *from* ${source(r)}${r.referrer ? `  _${esc(r.referrer.slice(0, 120))}_` : ""}`,
      `🛬 *landed* \`${esc(r.path)}\`${r.utm ? `  ·  \`${esc(r.utm)}\`` : ""}`,
      device(r.ua) && `*device* ${device(r.ua)}`,
      r.network && `📡 *network* ${esc(r.network)}`,
      r.lang && `🗣️ *language* \`${esc(r.lang)}\``,
    ],
    facts: [stamp(at), theirTime(r.timezone)],
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
    title: "Early list join",
    detail: esc(r.email),
    facts: [place(r), device(r.ua), `from ${source(first || r)}`, r.source && r.source !== "site" ? `form \`${esc(r.source)}\`` : null, `*${n}* on the list`, stamp(toMs(r.created_at))],
    links: [adminLink(env)],
    test,
  }, thread ? { ts: thread, broadcast: true } : null);
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
      early ? `on the early list since ${bangkok(toMs(early.created_at), true)}` : "not on the early list",
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
  { key: "visits", db: "SITE_DB", sql: "SELECT *, id AS cursor FROM visits WHERE id > ? ORDER BY id LIMIT 40", max: "SELECT COALESCE(MAX(id), 0) AS m FROM visits", send: sendVisit },
  { key: "early", db: "SITE_DB", sql: "SELECT *, id AS cursor FROM early_access WHERE id > ? ORDER BY id LIMIT 20", max: "SELECT COALESCE(MAX(id), 0) AS m FROM early_access", send: sendEarly },
  {
    key: "users", db: "API_DB",
    sql: "SELECT id, email, handle, display_name, invited_by, created_at, created_at AS cursor FROM users WHERE created_at > ? ORDER BY created_at LIMIT 20",
    max: "SELECT COALESCE(MAX(created_at), 0) AS m FROM users",
    ready: (r, now) => !!r.handle || now - r.created_at > 10 * MIN,
    send: sendUser,
  },
  { key: "posts", db: "API_DB", sql: "SELECT id, user_id, caption, created_at, created_at AS cursor FROM posts WHERE created_at > ? ORDER BY created_at LIMIT 20", max: "SELECT COALESCE(MAX(created_at), 0) AS m FROM posts", send: sendPost },
  { key: "reports", db: "API_DB", sql: "SELECT *, created_at AS cursor FROM reports WHERE created_at > ? ORDER BY created_at LIMIT 20", max: "SELECT COALESCE(MAX(created_at), 0) AS m FROM reports", send: sendReport },
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
      `👀 *${s.visitors}* visitors  ·  👋 *${s.early}* early list joins  ·  🎉 *${s.accounts}* accounts  ·  🖼️ *${s.posts}* posts${s.reports ? `  ·  🚨 *${s.reports}* copy reports` : ""}`,
      `All time: *${s.totals.early}* on the list, *${s.totals.accounts}* accounts, *${s.totals.posts}* posts`,
    ],
    facts: ["test accounts left out", stamp(now)],
    links: [adminLink(env), ["Public ledger", `${site(env)}/ledger`]],
  });
}

function authed(request, env) {
  return !!env.ADMIN_KEY && request.headers.get("x-admin-key") === env.ADMIN_KEY;
}

const cors = { "access-control-allow-origin": "*", "cache-control": "public, max-age=60" };

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && pathname === "/github") return github(request, env);
    if (pathname === "/health") return Response.json({ ok: true, env: env.ENVIRONMENT, silent: silent(env) });
    if (pathname === "/api/ledger") return Response.json(ledgerView(await load(env, { visitDays: 1 })), { headers: cors });
    if (pathname === "/admin" || pathname === "/admin/") return new Response(ADMIN_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
    if (pathname === "/admin/data") {
      if (!authed(request, env)) return Response.json({ ok: false, error: "bad_key" }, { status: 401 });
      return Response.json(adminView(await load(env)), { headers: { "cache-control": "no-store" } });
    }
    return new Response("not found", { status: 404 });
  },
  async scheduled(event, env, ctx) {
    if (event.cron === "0 2 * * *") ctx.waitUntil(dailySummary(env));
    else ctx.waitUntil(poll(env));
  },
};
