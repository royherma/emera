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

async function page(request, env, ctx, url) {
  const res = await env.ASSETS.fetch(request);
  const isDoc = request.method === "GET" && res.status === 200 && (res.headers.get("content-type") || "").includes("text/html");
  if (!isDoc || !env.DB) return res;
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
    if (pathname.startsWith("/api/")) return json({ ok: false, error: "not_found" }, 404);
    return page(request, env, ctx, url);
  },
};
