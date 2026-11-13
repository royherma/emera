const EMAIL = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const clip = (v, n) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

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
  const res = await env.DB.prepare(
    "INSERT OR IGNORE INTO early_access (email, created_at, source, referrer) VALUES (?, ?, ?, ?)"
  )
    .bind(email, new Date().toISOString(), source, referrer)
    .run();
  const added = (res.meta?.changes ?? 0) > 0;
  return json({ ok: true, already: !added });
}

async function count(env) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM early_access").first();
  return json({ count: row?.n ?? 0 });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/early") {
      if (request.method === "POST") return signup(request, env);
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }
    if (pathname === "/api/early/count") {
      if (request.method === "GET") return count(env);
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }
    if (pathname.startsWith("/api/")) return json({ ok: false, error: "not_found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
