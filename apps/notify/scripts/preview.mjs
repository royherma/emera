import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import worker from "../src/worker.js";

const here = new URL("..", import.meta.url).pathname;
function d1(dir) {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(dir + "/" + f, "utf8"));
  const stmt = (sql, args = []) => ({ bind: (...a) => stmt(sql, a), first: async () => db.prepare(sql).get(...args) ?? null, all: async () => ({ results: db.prepare(sql).all(...args) }), run: async () => db.prepare(sql).run(...args) });
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
const env = { ENVIRONMENT: "dev", ADMIN_KEY: "preview", SITE_URL: "", SITE_DB, API_DB, STATE: { get: async () => null, put: async () => {} } };
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
