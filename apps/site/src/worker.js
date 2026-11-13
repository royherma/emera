const EMAIL = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const clip = (v, n) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

const BOT = /bot|crawl|spider|slurp|preview|fetch|monitor|uptime|curl|wget|python|axios|node-fetch|go-http|java\/|headless|lighthouse|facebookexternalhit|whatsapp|telegram|discord|slack|scan/i;
const CLOUD = /amazon|aws|google llc|google cloud|microsoft|digitalocean|hetzner|ovh|linode|vultr|oracle|alibaba|tencent|contabo|leaseweb|scaleway|choopa|m247|datacamp|censys|shodan|palo alto/i;

function cookie(request, name) {
  const m = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([\\w-]{8,64})`));
  return m ? m[1] : null;
}

function seen(request) {
  const cf = request.cf || {};
  const ua = clip(request.headers.get("user-agent"), 300) || "";
  const network = typeof cf.asOrganization === "string" ? cf.asOrganization.slice(0, 120) : null;
  return {
    country: typeof cf.country === "string" ? cf.country : null,
    region: typeof cf.region === "string" ? cf.region.slice(0, 80) : null,
    city: typeof cf.city === "string" ? cf.city.slice(0, 80) : null,
    timezone: typeof cf.timezone === "string" ? cf.timezone : null,
    network,
    ua,
    lang: clip((request.headers.get("accept-language") || "").split(",")[0], 20),
    bot: !ua || BOT.test(ua) || (network && CLOUD.test(network)) ? 1 : 0,
    tester: request.headers.get("x-tg-tester") ? 1 : 0,
  };
}

function utmOf(url) {
  const parts = ["utm_source", "utm_medium", "utm_campaign", "ref"].map((k) => url.searchParams.get(k) && `${k}=${url.searchParams.get(k).slice(0, 60)}`).filter(Boolean);
  return parts.length ? parts.join("&") : null;
}

async function logVisit(env, request, url, visitor) {
  const s = seen(request);
  const ref = clip(request.headers.get("referer"), 300);
  const external = ref && !/^https?:\/\/(www\.)?emera\.social(\/|$)/i.test(ref) ? ref : null;
  await env.DB.prepare(
    "INSERT INTO visits (created_at, visitor, path, referrer, utm, country, region, city, timezone, network, ua, lang, bot, tester) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(new Date().toISOString(), visitor, url.pathname.slice(0, 200), external, utmOf(url), s.country, s.region, s.city, s.timezone, s.network, s.ua, s.lang, s.bot, s.tester)
    .run()
    .catch((e) => console.log("[visit]", String(e)));
}

const pageKey = (pathname) => pathname.replace(/\/index\.html$/, "/").replace(/\/+$/, "") || "/";

async function adminToken(env) {
  if (!env.ADMIN_KEY) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`emera-edit:${env.ADMIN_KEY}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function isAdmin(request, env) {
  const token = await adminToken(env);
  return !!token && cookie(request, "em_admin") === token;
}

const liveCache = new Map();

async function overrides(env, page, admin) {
  if (admin) {
    const { results } = await env.DB.prepare("SELECT key, COALESCE(draft, live) AS html FROM copy WHERE page = ?").bind(page).all();
    return results;
  }
  const hit = liveCache.get(page);
  if (hit && hit.at > Date.now() - 15000) return hit.rows;
  const { results } = await env.DB.prepare("SELECT key, live AS html FROM copy WHERE page = ? AND live IS NOT NULL").bind(page).all();
  liveCache.set(page, { at: Date.now(), rows: results });
  return results;
}

async function withCopy(res, env, url, admin) {
  const rows = await overrides(env, pageKey(url.pathname), admin).catch((e) => (console.log("[copy]", String(e)), []));
  if (!rows.length && !admin) return res;
  const map = new Map(rows.map((r) => [r.key, r.html]));
  let rw = new HTMLRewriter().on("[data-e]", {
    element(el) {
      const html = map.get(el.getAttribute("data-e"));
      if (html != null) el.setInnerContent(html, { html: true });
    },
  });
  if (admin) rw = rw.on("body", { element(el) { el.append('<script src="/assets/edit.js" defer></script>', { html: true }); } });
  const out = new Response(rw.transform(res).body, res);
  out.headers.delete("etag");
  out.headers.delete("last-modified");
  if (admin) out.headers.set("cache-control", "no-store");
  return out;
}

async function login(request, env, url) {
  const token = await adminToken(env);
  if (url.searchParams.has("off")) {
    return new Response(null, { status: 302, headers: { location: "/", "set-cookie": "em_admin=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly" } });
  }
  if (!token || url.searchParams.get("key") !== env.ADMIN_KEY) return new Response("Wrong key", { status: 401, headers: { "x-robots-tag": "noindex" } });
  return new Response(null, {
    status: 302,
    headers: { location: "/?edit=1", "set-cookie": `em_admin=${token}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`, "x-robots-tag": "noindex" },
  });
}

const UNSAFE = /<\s*\/?\s*(script|style|iframe|object|embed|form|input|link|meta)\b|\son\w+\s*=|javascript:/i;

async function copyApi(request, env, url) {
  if (!(await isAdmin(request, env))) return json({ ok: false, error: "not_admin" }, 401);
  const now = new Date().toISOString();
  if (request.method === "GET") {
    const { results } = await env.DB.prepare("SELECT page, key, original, draft, live, updated_at FROM copy ORDER BY updated_at DESC").all();
    return json({ ok: true, rows: results, drafts: results.filter((r) => r.draft != null).length });
  }
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }
  const action = url.pathname.slice("/api/copy".length) || "/save";
  if (action === "/publish") {
    const res = await env.DB.prepare("UPDATE copy SET live = draft, draft = NULL, published_at = ?, updated_at = ? WHERE draft IS NOT NULL").bind(now, now).run();
    await env.DB.prepare("DELETE FROM copy WHERE live IS NOT NULL AND live = original AND draft IS NULL").run();
    liveCache.clear();
    return json({ ok: true, published: res.meta?.changes ?? 0 });
  }
  if (action === "/discard") {
    await env.DB.prepare("DELETE FROM copy WHERE live IS NULL").run();
    const res = await env.DB.prepare("UPDATE copy SET draft = NULL, updated_at = ? WHERE draft IS NOT NULL").bind(now).run();
    return json({ ok: true, discarded: res.meta?.changes ?? 0 });
  }
  if (action !== "/save") return json({ ok: false, error: "not_found" }, 404);
  const page = typeof body.page === "string" ? pageKey(body.page.slice(0, 200)) : null;
  const key = typeof body.key === "string" && /^[\w-]{1,20}$/.test(body.key) ? body.key : null;
  const html = typeof body.html === "string" ? body.html.trim() : null;
  const original = typeof body.original === "string" ? body.original.slice(0, 20000) : null;
  if (!page || !key || html == null) return json({ ok: false, error: "missing_fields" }, 400);
  if (html.length > 20000) return json({ ok: false, error: "too_long" }, 400);
  if (UNSAFE.test(html)) return json({ ok: false, error: "unsafe_html" }, 400);
  const row = await env.DB.prepare("SELECT original, live FROM copy WHERE page = ? AND key = ?").bind(page, key).first();
  const base = row ? row.live ?? row.original : original;
  if (html === base) {
    if (row && row.live == null) await env.DB.prepare("DELETE FROM copy WHERE page = ? AND key = ?").bind(page, key).run();
    else if (row) await env.DB.prepare("UPDATE copy SET draft = NULL, updated_at = ? WHERE page = ? AND key = ?").bind(now, page, key).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO copy (page, key, original, draft, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (page, key) DO UPDATE SET draft = excluded.draft, updated_at = excluded.updated_at"
    )
      .bind(page, key, original, html, now)
      .run();
  }
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM copy WHERE draft IS NOT NULL").first();
  return json({ ok: true, drafts: n?.n ?? 0 });
}

async function page(request, env, ctx, url) {
  const plain = new Request(request);
  plain.headers.delete("if-none-match");
  plain.headers.delete("if-modified-since");
  let res = await env.ASSETS.fetch(plain);
  const isDoc = request.method === "GET" && res.status === 200 && (res.headers.get("content-type") || "").includes("text/html");
  if (isDoc) res = fundRewrite(res, env, url);
  if (!isDoc || !env.DB) return res;
  const admin = await isAdmin(request, env);
  res = await withCopy(res, env, url, admin);
  if (admin) return res;
  let visitor = cookie(request, "em_v");
  const fresh = !visitor;
  if (fresh) visitor = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  ctx.waitUntil(logVisit(env, request, url, visitor));
  if (!fresh) return res;
  const out = new Response(res.body, res);
  out.headers.append("set-cookie", `em_v=${visitor}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`);
  return out;
}

async function ops(request, env) {
  if (!env.OPS) return json({ ok: false, error: "ops_not_bound" }, 503);
  return env.OPS.fetch(request);
}

async function readBody(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return request.json();
  if (type.includes("form")) return Object.fromEntries(await request.formData());
  return {};
}

async function signup(request, env) {
  let body;
  try {
    body = await readBody(request);
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }
  if (clip(body.website, 200)) return json({ ok: true, already: false });
  const email = clip(body.email, 254)?.toLowerCase();
  if (!email || !EMAIL.test(email)) return json({ ok: false, error: "invalid_email" }, 400);
  const source = clip(body.source, 80) || "site";
  const referrer = clip(body.referrer, 500) || clip(request.headers.get("referer"), 500);
  const s = seen(request);
  const res = await env.DB.prepare(
    "INSERT OR IGNORE INTO early_access (email, created_at, source, referrer, visitor, country, city, ua, tester) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(email, new Date().toISOString(), source, referrer, cookie(request, "em_v"), s.country, s.city, s.ua, s.tester)
    .run();
  const added = (res.meta?.changes ?? 0) > 0;
  return json({ ok: true, already: !added });
}

const fundingOn = (env) => env.FUNDING === "on";
const FUND_PAGE = /^\/fund(\/(index\.html)?)?$/;

function fundRewrite(res, env, url) {
  if (fundingOn(env) && !FUND_PAGE.test(url.pathname)) return res;
  const rw = fundingOn(env)
    ? new HTMLRewriter().on("[data-api]", { element(el) { el.setAttribute("data-api", env.API_ORIGIN || ""); } })
    : new HTMLRewriter().on("[data-fund]", { element(el) { el.remove(); } });
  return new Response(rw.transform(res).body, res);
}

const notFound = (request, env, url) => env.ASSETS.fetch(new Request(new URL("/__not_found__/", url), { headers: request.headers }));

async function sitemap(request, env) {
  const res = await env.ASSETS.fetch(request);
  if (fundingOn(env) || !res.ok) return res;
  const xml = (await res.text()).replace(/<url><loc>[^<]*\/fund\/<\/loc>.*?<\/url>\n?/g, "");
  return new Response(xml, res);
}

function dollarsToCents(v) {
  const s = String(v ?? "").replace(/[$,\s]/g, "").replace(/(\/|per).*$/i, "");
  if (!s) return null;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return NaN;
  const c = Math.round(Number(s) * 100);
  return c >= 100 ? c : NaN;
}

function linkOf(v) {
  const raw = clip(v, 300);
  if (!raw) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return /^https?:$/.test(u.protocol) && u.hostname.includes(".") ? u.href.slice(0, 300) : NaN;
  } catch {
    return NaN;
  }
}

async function sponsor(request, env) {
  let body;
  try {
    body = await readBody(request);
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }
  if (clip(body.website, 200)) return json({ ok: true });
  const company = clip(body.company, 120);
  if (!company) return json({ ok: false, error: "missing_company" }, 400);
  const email = clip(body.email, 254)?.toLowerCase();
  if (!email || !EMAIL.test(email)) return json({ ok: false, error: "invalid_email" }, 400);
  const monthly = dollarsToCents(body.monthly);
  if (Number.isNaN(monthly)) return json({ ok: false, error: "invalid_amount" }, 400);
  const link = linkOf(body.url);
  if (Number.isNaN(link)) return json({ ok: false, error: "invalid_url" }, 400);
  const visitor = cookie(request, "em_v");
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM sponsor_interest WHERE (email = ? OR visitor = ?) AND created_at > ?").bind(email, visitor, since).first();
  if ((recent?.n ?? 0) >= 3) return json({ ok: false, error: "too_many" }, 429);
  const s = seen(request);
  await env.DB.prepare(
    "INSERT INTO sponsor_interest (created_at, company, email, monthly_cents, url, referrer, visitor, country, city, ua, tester) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(new Date().toISOString(), company, email, monthly, link, clip(body.referrer, 500) || clip(request.headers.get("referer"), 500), visitor, s.country, s.city, s.ua, s.tester)
    .run();
  return json({ ok: true });
}

const REPO = "royherma/emera";

async function stars(ctx) {
  const cache = caches.default;
  const key = new Request(`https://emera.social/__stars/${REPO}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  const gh = await fetch(`https://api.github.com/repos/${REPO}`, { headers: { "user-agent": "emera-site", accept: "application/vnd.github+json" } }).catch(() => null);
  const data = gh?.ok ? await gh.json() : null;
  const res = new Response(JSON.stringify({ stars: data?.stargazers_count ?? null }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${data ? 900 : 60}` },
  });
  if (data) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

async function count(env) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM early_access").first();
  return json({ count: row?.n ?? 0 });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/api/ledger") return ops(request, env);
    if (pathname === "/api/early") {
      if (request.method === "POST") return signup(request, env);
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }
    if (pathname === "/api/early/count") {
      if (request.method === "GET") return count(env);
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }
    if (pathname === "/api/sponsor") {
      if (!fundingOn(env)) return json({ ok: false, error: "not_found" }, 404);
      if (request.method === "POST") return sponsor(request, env);
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }
    if (FUND_PAGE.test(pathname) && !fundingOn(env)) return notFound(request, env, url);
    if (pathname === "/sitemap.xml") return sitemap(request, env);
    if (pathname === "/edit") return login(request, env, url);
    if (pathname === "/api/stars") return stars(ctx);
    if (pathname === "/api/copy" || pathname.startsWith("/api/copy/")) return copyApi(request, env, url);
    if (pathname.startsWith("/api/")) return json({ ok: false, error: "not_found" }, 404);
    return page(request, env, ctx, url);
  },
};
