const enc = new TextEncoder();

export function esc(t) {
  return String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function slack(env, text) {
  const tag = env.ENVIRONMENT === "production" ? "" : `  ·  \`${env.ENVIRONMENT}\``;
  if (!env.SLACK_BOT_TOKEN) {
    console.log("[slack:noop]", text);
    return false;
  }
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` },
    body: JSON.stringify({ channel: env.SLACK_CHANNEL, text: text + tag, unfurl_links: false }),
  });
  const d = await r.json();
  if (!d.ok) console.log("[slack:fail]", d.error);
  return d.ok;
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
  if (text) await slack(env, text);
  return new Response("ok");
}

const FEEDS = [
  {
    key: "early",
    db: "SITE_DB",
    sql: "SELECT id AS cursor, email, source, referrer FROM early_access WHERE id > ? ORDER BY id LIMIT 20",
    max: "SELECT COALESCE(MAX(id), 0) AS m FROM early_access",
    text: (r, n) => `:wave: *Early list join*  ·  ${esc(r.email)}  ·  from ${esc(r.source || "site")}${r.referrer ? ` via ${esc(r.referrer)}` : ""}  ·  ${n} on the list`,
    total: "SELECT COUNT(*) AS n FROM early_access",
  },
  {
    key: "users",
    db: "API_DB",
    sql: "SELECT created_at AS cursor, email, handle, invited_by FROM users WHERE created_at > ? ORDER BY created_at LIMIT 20",
    max: "SELECT COALESCE(MAX(created_at), 0) AS m FROM users",
    text: (r, n) => `:bust_in_silhouette: *New account*  ·  ${r.handle ? `@${esc(r.handle)}` : "(no handle yet)"}  ·  ${esc(r.email)}${r.invited_by ? "  ·  invited" : ""}  ·  ${n} accounts`,
    total: "SELECT COUNT(*) AS n FROM users",
  },
  {
    key: "posts",
    db: "API_DB",
    sql: "SELECT p.created_at AS cursor, p.id, u.handle FROM posts p JOIN users u ON u.id = p.user_id WHERE p.created_at > ? ORDER BY p.created_at LIMIT 20",
    max: "SELECT COALESCE(MAX(created_at), 0) AS m FROM posts",
    text: (r, n, env) => `:frame_with_picture: *New post*  ·  @${esc(r.handle)}  ·  ${link(`${env.API_URL}/p/${r.id}`, "open")}  ·  ${n} posts`,
    total: "SELECT COUNT(*) AS n FROM posts",
  },
  {
    key: "reports",
    db: "API_DB",
    sql: "SELECT r.created_at AS cursor, r.post_id, r.copy_url, r.note, u.handle FROM reports r JOIN users u ON u.id = r.reporter_user_id WHERE r.created_at > ? ORDER BY r.created_at LIMIT 20",
    max: "SELECT COALESCE(MAX(created_at), 0) AS m FROM reports",
    text: (r, n, env) => `:rotating_light: *Copy reported*  ·  @${esc(r.handle)} found ${link(r.copy_url, "a copy")} of ${link(`${env.API_URL}/p/${r.post_id}`, "their post")}${r.note ? `\n>${esc(r.note).slice(0, 500)}` : ""}  ·  ${n} open`,
    total: "SELECT COUNT(*) AS n FROM reports WHERE status = 'new'",
  },
  {
    key: "flags",
    db: "API_DB",
    sql: "SELECT f.created_at AS cursor, f.target_type, f.target_id, f.reason, f.note, u.handle FROM flags f JOIN users u ON u.id = f.reporter_user_id WHERE f.created_at > ? ORDER BY f.created_at LIMIT 20",
    max: "SELECT COALESCE(MAX(created_at), 0) AS m FROM flags",
    text: (r, n) => `:triangular_flag_on_post: *Flagged ${esc(r.target_type)}*  ·  ${esc(r.reason)}  ·  ${esc(r.target_id)} by @${esc(r.handle)}${r.note ? `\n>${esc(r.note).slice(0, 500)}` : ""}  ·  ${n} open`,
    total: "SELECT COUNT(*) AS n FROM flags WHERE status = 'new'",
  },
];

export async function poll(env) {
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
      if (!results.length) continue;
      const { n } = await db.prepare(f.total).first();
      for (const r of results) {
        await slack(env, f.text(r, n, env));
        await env.STATE.put(`cursor:${f.key}`, String(r.cursor));
      }
      sent[f.key] = results.length;
    } catch (e) {
      console.log(`[poll:${f.key}]`, String(e));
    }
  }
  return sent;
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && pathname === "/github") return github(request, env);
    if (pathname === "/health") return Response.json({ ok: true, env: env.ENVIRONMENT });
    return new Response("not found", { status: 404 });
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(poll(env));
  },
};
