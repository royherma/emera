import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import worker from "../src/worker.js";

const here = new URL("..", import.meta.url).pathname;
function d1(dir) {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(dir + "/" + f, "utf8"));
  const stmt = (sql, args = []) => ({ bind: (...a) => stmt(sql, a), first: async () => db.prepare(sql).get(...args) ?? null, all: async () => ({ results: db.prepare(sql).all(...args) }), run: async () => ({ meta: { changes: db.prepare(sql).run(...args).changes } }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const SITE_DB = d1(here + "../site/migrations");
const API_DB = d1(here + "../api/migrations");
const H = 3_600_000, now = Date.now();
const UA = ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Version/18.1 Mobile Safari/604.1", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/142.0 Safari/537.36", "Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/142.0 Mobile Safari/537.36"];
const PLACES = [["TH", "Bangkok"], ["US", "Austin"], ["DE", "Berlin"], ["BR", "Sao Paulo"], ["GB", "London"], ["JP", "Osaka"]];
const REFS = ["https://www.instagram.com/", null, "https://news.ycombinator.com/", "https://www.google.com/", "https://bsky.app/"];
for (let i = 0; i < 140; i++) {
  const [cc, city] = PLACES[i % PLACES.length];
  SITE_DB.raw.prepare("INSERT INTO visits (created_at, visitor, path, referrer, country, city, ua, bot) VALUES (?, ?, ?, ?, ?, ?, ?, 0)")
    .run(new Date(now - (i * 4.7) * H).toISOString(), `v${i % 70}`, ["/", "/answers/", "/compare/emera-vs-cara/"][i % 3], REFS[i % REFS.length], cc, city, UA[i % 3]);
}
const names = ["ines.makes", "tomas.clay", "ade.frames", "lior.sound", "noor.prints", "kai.wood"];
names.forEach((h, i) => {
  SITE_DB.raw.prepare("INSERT INTO early_access (email, created_at, source, country, city, ua) VALUES (?, ?, 'hero', ?, ?, ?)").run(`${h}@example-mail.org`, new Date(now - (i * 30 + 5) * H).toISOString(), PLACES[i][0], PLACES[i][1], UA[i % 3]);
  if (i < 4) API_DB.raw.prepare("INSERT INTO users (id, email, handle, display_name, created_at) VALUES (?, ?, ?, ?, ?)").run(`u${i}`, `${h}@example-mail.org`, h, h.split(".")[0], now - (i * 30 + 2) * H);
  if (i < 2) API_DB.raw.prepare("INSERT INTO posts (id, user_id, caption, created_at) VALUES (?, ?, ?, ?)").run(`p${i}`, `u${i}`, "First glaze test, the blue came out darker than planned", now - (i * 30 + 1) * H);
});
API_DB.raw.prepare("INSERT INTO users (id, email, handle, created_at) VALUES ('t1', 'smoke@emera.social', 'smoke1', ?)").run(now - 9 * H);
const Q = API_DB.raw;
Q.prepare("UPDATE users SET plan = 'creator', plan_until = ?, stripe_customer_id = 'cus_Qa81xKd02' WHERE id = 'u0'").run(now + 20 * 24 * H);
Q.prepare("UPDATE users SET plan = 'pro', plan_until = ?, stripe_customer_id = 'cus_Qb77zLm91' WHERE id = 'u1'").run(now + 11 * 24 * H);
Q.prepare("UPDATE users SET plan = 'creator', plan_until = ? WHERE id = 'u2'").run(now + 25 * 24 * H);
Q.prepare("UPDATE users SET plan = 'creator', plan_until = ?, stripe_customer_id = 'cus_Qc12abc' WHERE id = 't1'").run(now + 5 * 24 * H);
for (let i = 0; i < 5; i++) Q.prepare("INSERT INTO media (id, user_id, kind, content_type, declared_bytes, r2_key, created_at) VALUES (?, ?, 'image', 'image/jpeg', 1, ?, 1)").run(`m${i}`, `u${i % 3}`, `k${i}`);
for (let i = 0; i < 5; i++) Q.prepare("INSERT INTO scans (media_id, post_id, user_id, media_key, last_scanned_at, next_scan_at) VALUES (?, 'p0', ?, 'k', ?, ?)").run(`m${i}`, `u${i % 3}`, i < 4 ? now - (i + 1) * 5 * H : null, now + 9 * 24 * H);
const SITES = ["pinboard-clone.example", "wallsnap.example.net", "artdump.example.org", "shopfake.example.com"];
for (let i = 0; i < 9; i++) Q.prepare("INSERT INTO matches (id, post_id, user_id, url, page_title, site, thumbnail, found_at, status, reason) VALUES (?, 'p0', ?, ?, 'Glaze blue bowl', ?, NULL, ?, ?, ?)")
  .run(`mt${i}`, `u${i % 3}`, `https://${SITES[i % 4]}/img/${i}1883`, SITES[i % 4], now - i * 7 * H, ["new", "new", "reported", "dismissed"][i % 4], `Lens ${i % 2 ? "exact" : "visual"} match on ${SITES[i % 4]}`);
Q.prepare("INSERT INTO reports (id, post_id, reporter_user_id, copy_url, created_at) VALUES ('rp1', 'p0', 'u0', 'https://shopfake.example.com/img/31883', ?)").run(now);
Q.prepare("INSERT INTO takedowns (id, report_id, user_id, post_id, copy_url, site, method, target, notice, signer_name, auth_version, status, created_at) VALUES ('tdprev1', 'rp1', 'u0', 'p0', 'https://shopfake.example.com/img/31883', 'shopfake.example.com', 'email', 'abuse@shopfake.example.com', 'Notice text', 'Ines', 'v1', 'ready', ?)").run(now);
Q.prepare("INSERT INTO protect_pending (email, plan, plan_until, stripe_customer_id, stripe_subscription_id, created_at) VALUES ('rafa@example-mail.org', 'creator', ?, 'cus_Qd55pen', 'sub_1', ?)").run(now + 28 * 24 * H, now - 3 * H);
Q.prepare("INSERT INTO scan_meta (key, n) VALUES (?, 74)").run("serp:" + new Date().toISOString().slice(0, 7));
SITE_DB.raw.prepare("INSERT INTO enterprise_interest (created_at, name, email, company, creators, country, city) VALUES (?, 'Dana Ruiz', 'dana@studiomaro.example', 'Studio Maro', 120, 'US', 'Austin')").run(new Date(now - 40 * H).toISOString());
const env = { ENVIRONMENT: "dev", ADMIN_KEY: "preview",SITE_URL: "", SITE_DB, API_DB, STATE: { get: async () => null, put: async () => {}, list: async () => ({ keys: [] }) } };
const port = Number(process.argv[2] || 5041);
createServer(async (req, res) => {
  if (req.url.split("?")[0].replace(/\/$/, "") === "/ledger") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(readFileSync(here + "../site/public/ledger/index.html"));
  }
  const headers = new Headers(Object.entries(req.headers).filter(([, v]) => typeof v === "string"));
  const r = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { headers }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log(`http://agora-ops-preview.localhost:${port}/admin#key=preview`));
