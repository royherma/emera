import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import worker, { verifyGithub, githubText, poll, slackPost, inboundMail } from "../src/worker.js";
import { adminView, ledgerView, load } from "../src/stats.js";
import { device, source } from "../src/people.js";

test("github signature: good passes, tampered fails", async () => {
  const body = '{"zen":"hi"}';
  const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
  assert.equal(await verifyGithub("s3cret", body, sig), true);
  assert.equal(await verifyGithub("s3cret", body + " ", sig), false);
  assert.equal(await verifyGithub("other", body, sig), false);
  assert.equal(await verifyGithub("s3cret", body, null), false);
});

test("github text: fork and star post, unstar and label do not", () => {
  const repository = { html_url: "https://github.com/royherma/emera", full_name: "royherma/emera", stargazers_count: 3, forks_count: 1 };
  const sender = { html_url: "https://github.com/ada", login: "ada" };
  assert.match(githubText("fork", { repository, sender, forkee: { html_url: "https://github.com/ada/emera", full_name: "ada/emera" } }), /New fork.*ada\/emera.*3 stars, 1 forks/);
  assert.match(githubText("watch", { action: "started", repository, sender }), /New star/);
  assert.equal(githubText("star", { action: "deleted", repository, sender }), null);
  assert.equal(githubText("label", { action: "created", repository, sender }), null);
});

function d1(dir) {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(join(dir, f), "utf8"));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => ({ meta: { changes: db.prepare(sql).run(...args).changes } }),
  });
  return { prepare: (sql) => stmt(sql), raw: db };
}

function harness(environment = "production") {
  const kv = new Map();
  const posted = [];
  globalThis.fetch = async (_u, init) => {
    posted.push(JSON.parse(init.body));
    return { json: async () => ({ ok: true, ts: `ts${posted.length}` }) };
  };
  const env = {
    ENVIRONMENT: environment, SLACK_BOT_TOKEN: "t", SLACK_CHANNEL: "C", SITE_URL: "https://emera.social", OWN_EMAILS: "owner@gmail.com",
    STATE: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => kv.set(k, v) },
    SITE_DB: d1(new URL("../../site/migrations", import.meta.url).pathname),
    API_DB: d1(new URL("../../api/migrations", import.meta.url).pathname),
  };
  return { env, kv, posted, text: () => posted.map((p) => JSON.stringify(p.blocks || p.text)).join("\n") };
}

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1";

test("staging never posts unless SLACK_NON_PROD=1", async () => {
  const h = harness("staging");
  assert.equal(await slackPost(h.env, { text: "hi" }), null);
  assert.equal(h.posted.length, 0);
  h.env.SLACK_NON_PROD = "1";
  assert.equal(await slackPost(h.env, { text: "hi" }), "ts1");
});

test("visit opens a thread, the started sign-up lands in it with place, device and a real count", async () => {
  const h = harness();
  await poll(h.env);
  const now = new Date().toISOString();
  h.env.SITE_DB.raw.prepare("INSERT INTO visits (created_at, visitor, path, referrer, country, city, region, ua, bot, screen) VALUES (?, 'v1', '/', 'https://www.instagram.com/', 'TH', 'Bangkok', 'Bangkok', ?, 0, '{\"sw\":393}')").run(now, IPHONE);
  h.env.SITE_DB.raw.prepare("INSERT INTO visits (created_at, visitor, path, ua, bot) VALUES (?, 'b1', '/', 'curl/8', 1)").run(now);
  h.env.SITE_DB.raw.prepare("INSERT INTO early_access (email, created_at, source, visitor, country, city, ua) VALUES ('owner@gmail.com', ?, 'hero', 'v0', 'TH', 'Bangkok', ?)").run(now, IPHONE);
  h.env.SITE_DB.raw.prepare("INSERT INTO early_access (email, created_at, source, visitor, country, city, ua) VALUES ('maya@paint.org', ?, 'hero', 'v1', 'TH', 'Bangkok', ?)").run(now, IPHONE);
  assert.deepEqual(await poll(h.env), { visits: 1, early: 2 });
  const [visit, own, join] = h.posted;
  assert.match(JSON.stringify(visit.blocks), /New visitor.*Bangkok, TH.*Instagram.*phone · iPhone iOS 18\.1/);
  assert.match(JSON.stringify(own.blocks), /Test - Started sign-up/);
  assert.equal(join.thread_ts, "ts1");
  assert.equal(join.reply_broadcast, true);
  assert.match(JSON.stringify(join.blocks), /maya@paint\.org.*Bangkok, TH.*\*1\* started so far.*Bangkok.*emera\.social\/admin/);
});

test("sponsor interest posts company, amount and their link", async () => {
  const h = harness();
  await poll(h.env);
  h.env.SITE_DB.raw.prepare("INSERT INTO sponsor_interest (created_at, company, email, monthly_cents, url, country, city, ua) VALUES (?, 'Daylight Paint Co', 'hi@daylight.example', 150000, 'https://daylight.example/', 'TH', 'Bangkok', ?)").run(new Date().toISOString(), IPHONE);
  assert.deepEqual(await poll(h.env), { sponsors: 1 });
  assert.match(h.text(), /Sponsor interest.*Daylight Paint Co.*hi@daylight\.example.*\$1,500\/mo.*Bangkok, TH.*daylight\.example/);
});

test("enterprise lead posts company, contact and creator count", async () => {
  const h = harness();
  await poll(h.env);
  h.env.SITE_DB.raw.prepare("INSERT INTO enterprise_interest (created_at, name, email, company, creators, country, city, ua) VALUES (?, 'Ana', 'ana@studio.example', 'North Studio', 1200, 'TH', 'Bangkok', ?)").run(new Date().toISOString(), IPHONE);
  assert.deepEqual(await poll(h.env), { enterprise: 1 });
  assert.match(h.text(), /Enterprise Protect lead.*North Studio.*Ana.*ana@studio\.example.*1,200 creators.*Bangkok, TH/);
});

test("protect events: new plan, copies found, takedown waiting, sent, removed", async () => {
  const h = harness();
  await poll(h.env);
  const t = Date.now();
  const db = h.env.API_DB.raw;
  db.exec("PRAGMA foreign_keys = OFF");
  db.prepare("INSERT INTO users (id, email, handle, created_at, plan, plan_until) VALUES ('u9', 'maya@paint.org', 'maya', ?, 'pro', ?)").run(t - 1000, t + 30 * 86400000);
  db.prepare("INSERT INTO plan_events (user_id, plan, plan_until, kind, created_at) VALUES ('u9', 'pro', ?, 'active', ?)").run(t + 30 * 86400000, t);
  db.prepare("INSERT INTO scans (media_id, post_id, user_id, media_key, last_scanned_at, next_scan_at) VALUES ('m1', 'p1', 'u9', 'k.webp', ?, ?)").run(t, t + 86400000);
  db.prepare("INSERT INTO matches (id, post_id, user_id, url, site, found_at, reason) VALUES ('x1', 'p1', 'u9', 'https://cheapprints.example/a', 'cheapprints.example', ?, 'Lens visual match')").run(t);
  db.prepare("INSERT INTO reports (id, post_id, reporter_user_id, copy_url, created_at) VALUES ('r1', 'p1', 'u9', 'https://cheapprints.example/a', ?)").run(t);
  db.prepare("INSERT INTO takedowns (id, report_id, user_id, post_id, copy_url, site, method, target, notice, signer_name, auth_version, status, created_at, sent_at, sent_via, removed_at, check_reason) VALUES ('t1', 'r1', 'u9', 'p1', 'https://cheapprints.example/a', 'cheapprints.example', 'email', 'abuse@host.example', 'notice', 'Maya Paint', 'v1', 'removed', ?, ?, 'email', ?, 'HTTP 404')").run(t, t + 1, t + 2 * 86400000);
  const sent = await poll(h.env, t + 3 * 86400000);
  assert.deepEqual(sent, { users: 1, plans: 1, scans: 1, takedown_ready: 1, takedown_sent: 1, takedown_removed: 1, reports: 1 });
  const text = h.text();
  assert.match(text, /New Protect Pro plan.*maya.*\$100\/mo/);
  assert.match(text, /1 possible copy found.*cheapprints\.example/);
  assert.match(text, /Takedown waiting for your OK.*Maya Paint.*abuse@host\.example/);
  assert.match(text, /Copy removed.*cheapprints\.example.*HTTP 404.*2 days after filing/);
});

test("new account waits for a handle, then posts with sign-up thread and profile link", async () => {
  const h = harness();
  await poll(h.env);
  const t = Date.now();
  h.env.SITE_DB.raw.prepare("INSERT INTO early_access (email, created_at) VALUES ('maya@paint.org', ?)").run(new Date(t - 3600_000).toISOString());
  h.env.API_DB.raw.prepare("INSERT INTO users (id, email, created_at) VALUES ('u1', 'maya@paint.org', ?)").run(t);
  assert.deepEqual(await poll(h.env, t + 60_000), { early: 1 });
  h.env.API_DB.raw.prepare("UPDATE users SET handle = 'maya', display_name = 'Maya' WHERE id = 'u1'").run();
  assert.deepEqual(await poll(h.env, t + 120_000), { users: 1 });
  assert.match(h.text(), /New account.*@maya.*Maya.*maya@paint\.org.*\*1\* accounts.*emera\.social\/@maya/);
});

test("ledger has no emails and leaves out test accounts", async () => {
  const h = harness();
  const t = Date.now();
  h.env.API_DB.raw.prepare("INSERT INTO users (id, email, handle, created_at) VALUES ('u1', 'maya@paint.org', 'maya', ?), ('u2', 'owner@gmail.com', 'roy', ?)").run(t, t);
  h.env.API_DB.raw.prepare("INSERT INTO posts (id, user_id, caption, created_at) VALUES ('p1', 'u1', 'hi', ?), ('p2', 'u2', 'test', ?)").run(t, t);
  const l = ledgerView(await load(h.env));
  assert.deepEqual(l.totals, { accounts: 1, posts: 1, reports: 0 });
  assert.doesNotMatch(JSON.stringify(l), /@paint|gmail/);
  assert.equal(l.cumulative.accounts.at(-1), 1);
  const a = adminView(await load(h.env));
  assert.equal(a.totals.accountsTest, 1);
  assert.equal(a.accounts.find((x) => x.handle === "roy").test, true);
});

test("source and device read the referrer, utm and user agent", () => {
  assert.equal(source({ utm: "utm_source=tiktok" }), "🎵 TikTok");
  assert.equal(source({ referrer: "https://news.ycombinator.com/item?id=1" }), "🟧 Hacker News");
  assert.equal(source({}), "⌨️ Direct");
  assert.equal(device("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/142.0 Safari/537.36"), "💻 desktop · Mac · Chrome 142");
});

test("our own domain as referrer is not a source", () => {
  assert.equal(source({ referrer: "https://emera.social/" }), "⌨️ Direct");
  assert.equal(source({ referrer: "https://www.emera.social/answers/" , utm: "utm_source=ig" }), "📸 Instagram");
});

test("inbound mail forwards, then posts who wrote and the subject", async () => {
  const h = harness();
  h.env.MAIL_FORWARD_TO = "inbox@example.org";
  const forwardedTo = [];
  const message = { from: "a@b.org", to: "hello@emera.social", rawSize: 4096, headers: new Map([["subject", "Takedown help"], ["from", "Ada <a@b.org>"]]), forward: async (to) => forwardedTo.push(to) };
  assert.equal(await inboundMail(message, h.env), "forwarded to the inbox");
  assert.deepEqual(forwardedTo, ["inbox@example.org"]);
  assert.match(h.text(), /Email to hello@emera\.social.*Takedown help.*Ada &lt;a@b\.org&gt;.*forwarded to the inbox/);
});

test("hosting networks, old Chrome and Roy's own browser never post as visitors", async () => {
  const h = harness();
  await poll(h.env);
  const now = new Date().toISOString();
  const old = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";
  const fresh = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/157.0 Safari/537.36";
  const add = (visitor, ua, network) => h.env.SITE_DB.raw.prepare("INSERT INTO visits (created_at, visitor, path, ua, network, bot, screen) VALUES (?, ?, '/', ?, ?, 0, '{}')").run(now, visitor, ua, network);
  add("k1", fresh, "Virtual Systems LLC");
  add("k2", old, "Some Home ISP");
  add("me", fresh, "TOT Public Company Limited Bangkok");
  h.kv.set("own:me", "1");
  add("q1", fresh, "QuickPacket, LLC");
  add("q2", fresh, "HostRoyale Technologies Pvt Ltd");
  add("q3", fresh, "Driftnet Ltd");
  add("f1", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:70.0) Gecko/20100101 Firefox/70.0", "Some Home ISP");
  add("p1", fresh, "TOT Public Company Limited Bangkok");
  assert.deepEqual(await poll(h.env), { visits: 1 });
  assert.equal(h.posted.length, 1);
});

test("visit waits for the page script, then shows screen, connection, their time and languages", async () => {
  const h = harness();
  await poll(h.env);
  const now = Date.now();
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/157.0 Safari/537.36";
  const add = h.env.SITE_DB.raw.prepare("INSERT INTO visits (created_at, visitor, path, country, city, region, timezone, network, ua, lang, bot) VALUES (?, ?, '/', 'SE', 'Lulea', 'Norrbotten', 'Europe/Stockholm', 'Telia Company AB', ?, 'en-US', 0)");
  add.run(new Date(now).toISOString(), "s1", mac);
  assert.deepEqual(await poll(h.env, now + 30_000), {});
  const screen = { sw: 1512, sh: 982, dpr: 2, vw: 1512, vh: 860, dark: true, touch: false, type: "wifi", speed: "4g", mbps: 10, rtt: 50, tz: "Europe/Berlin", langs: ["sv-SE", "en-US"], pv: "15.2.0", mem: 8, cores: 10 };
  h.env.SITE_DB.raw.prepare("UPDATE visits SET screen = ? WHERE visitor = 's1'").run(JSON.stringify(screen));
  assert.deepEqual(await poll(h.env, now + 30_000), { visits: 1 });
  const t = h.text();
  assert.match(t, /screen\* 1512×982 @2x · window 1512×860 · dark mode · mouse · 8 GB memory, 10 cores/);
  assert.match(t, /desktop · macOS 15\.2 · Chrome 157/);
  assert.match(t, /connection\* Wi-Fi · fast speed · ~10 Mbps · 50 ms ping/);
  assert.match(t, /Europe\/Berlin  ·  network says Europe\/Stockholm/);
  assert.match(t, /`sv-SE` `en-US`/);
  assert.doesNotMatch(t, /no JavaScript/);
  assert.match(t, /network\* `residential` · Telia Company AB/);
  const before = h.posted.length;
  add.run(new Date(now).toISOString(), "s2", mac);
  await poll(h.env, now + 3 * 60_000);
  assert.equal(h.posted.length, before, "a visit where no JavaScript ran is a bot and never posts");
});

test("visit alert: their time is the visit's time, languages once each, 1 core", async () => {
  const h = harness();
  await poll(h.env);
  const at = Date.UTC(2026, 10, 15, 20, 32);
  const ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36";
  const screen = { sw: 1920, sh: 1080, vw: 1920, vh: 1080, dpr: 1, dark: false, touch: false, tz: "UTC", langs: ["en-US", "en", "en"], mem: 4, cores: 1 };
  h.env.SITE_DB.raw.prepare("INSERT INTO visits (created_at, visitor, path, country, city, timezone, network, ua, lang, bot, screen) VALUES (?, 'c1', '/', 'GB', 'London', 'Europe/London', 'Some Home ISP', ?, 'en-US', 0, ?)").run(new Date(at).toISOString(), ua, JSON.stringify(screen));
  assert.deepEqual(await poll(h.env, at + 60_000), { visits: 1 });
  const t = h.text();
  assert.match(t, /their time\* 8:32 PM · UTC/);
  assert.match(t, /language\* `en-US` `en`"/);
  assert.match(t, /4 GB memory, 1 core\\n/);
});

test("admin takedowns: lists ready and sent with the full notice, actions go through the API with the key", async () => {
  const h = harness();
  const db = h.env.API_DB.raw;
  db.prepare("INSERT INTO users (id, email, handle, display_name, created_at) VALUES ('u1', 'a@example.test', 'ada', 'Ada', 1)").run();
  db.prepare("INSERT INTO reports (id, post_id, reporter_user_id, copy_url, created_at) VALUES ('r1', 'p1', 'u1', 'https://blog.example.net/x', 1)").run();
  db.prepare("INSERT INTO takedowns (id, report_id, user_id, post_id, copy_url, site, method, target, notice, signer_name, auth_version, status, created_at) VALUES ('tdone1', 'r1', 'u1', 'p1', 'https://blog.example.net/x', 'example.net', 'email', 'abuse@host.example', 'FULL NOTICE TEXT', 'Ada Lovelace', 'v1', 'ready', 5)").run();
  const env = { ...h.env, ADMIN_KEY: "k", FUND_ADMIN_KEY: "fk", API_URL: "https://api.test" };
  const get = (key) => worker.fetch(new Request("https://n.test/admin/takedowns", { headers: key ? { "x-admin-key": key } : {} }), env);
  assert.equal((await get(null)).status, 401);
  const list = await (await get("k")).json();
  assert.equal(list.takedowns.length, 1);
  assert.match(list.takedowns[0].notice, /FULL NOTICE TEXT/);
  assert.equal(list.takedowns[0].handle, "ada");

  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return Response.json({ takedown: { status: "sent" } });
  };
  const post = (action, key = "k", body) => worker.fetch(new Request(`https://n.test/admin/takedowns/tdone1/${action}`, { method: "POST", headers: { "x-admin-key": key }, body }), env);
  assert.equal((await post("send-email", "bad")).status, 401);
  assert.equal((await post("delete")).status, 400);
  assert.equal(calls.length, 0);
  const ok = await (await post("send-email")).json();
  assert.deepEqual(ok, { ok: true, status: "sent" });
  assert.equal(calls[0].url, "https://api.test/v1/admin/takedowns/tdone1/send-email");
  assert.equal(calls[0].init.headers.authorization, "Bearer fk");
  await post("reject", "k", JSON.stringify({ reason: "own shop" }));
  assert.equal(JSON.parse(calls[1].init.body).reason, "own shop");
});

test("admin protect: tiles, creators, actions write plan_events and are key-guarded", async () => {
  const h = harness();
  const db = h.env.API_DB.raw;
  const now = Date.now();
  db.prepare("INSERT INTO users (id, email, handle, created_at, plan, plan_until, stripe_customer_id) VALUES ('u1', 'ada@example.test', 'ada', 1, 'creator', ?, 'cus_1'), ('u2', 'bo@example.test', 'bo', 1, 'free', NULL, NULL)").run(now + 86_400_000);
  db.prepare("INSERT INTO media (id, user_id, kind, content_type, declared_bytes, r2_key, created_at) VALUES ('m1', 'u1', 'image', 'image/jpeg', 1, 'k', 1)").run();
  db.prepare("INSERT INTO scans (media_id, post_id, user_id, media_key, last_scanned_at, next_scan_at) VALUES ('m1', 'p1', 'u1', 'k', 5, ?)").run(now + 1e9);
  db.prepare("INSERT INTO matches (id, post_id, user_id, url, site, found_at, status, reason) VALUES ('mt1', 'p1', 'u1', 'https://x.example/a', 'x.example', 5, 'new', 'r')").run();
  db.prepare("INSERT INTO scan_meta (key, n) VALUES (?, 7)").run(`serp:${new Date(now).toISOString().slice(0, 7)}`);
  db.prepare("INSERT INTO protect_pending (email, plan, plan_until, stripe_subscription_id, created_at) VALUES ('new@example.test', 'pro', NULL, 'sub_1', 1)").run();
  h.env.SITE_DB.raw.prepare("INSERT INTO enterprise_interest (created_at, name, email, company, creators) VALUES (?, 'Dee', 'dee@corp.example', 'Corp', 50)").run(new Date().toISOString());
  const env = { ...h.env, ADMIN_KEY: "k", SCAN_MONTHLY_LIMIT: "50" };
  const get = (key) => worker.fetch(new Request("https://n.test/admin/protect", { headers: key ? { "x-admin-key": key } : {} }), env);
  assert.equal((await get(null)).status, 401);
  const v = await (await get("k")).json();
  assert.deepEqual([v.tiles.creator, v.tiles.pro, v.tiles.revenue, v.tiles.pending, v.tiles.scans, v.tiles.scanLimit, v.tiles.leads], [1, 0, 10, 1, 7, 50, 1]);
  assert.deepEqual(v.tiles.copies, { new: 1, reported: 0, dismissed: 0 });
  assert.deepEqual([v.creators[0].works, v.creators[0].scanned, v.creators[0].found, v.matches[0].handle], [1, 1, 1, "ada"]);

  const act = (path, body, key = "k") => worker.fetch(new Request(`https://n.test/admin/protect/${path}`, { method: "POST", headers: { "x-admin-key": key }, body: JSON.stringify(body) }), env);
  assert.equal((await act("scan-now", { id: "u1" }, "bad")).status, 401);
  assert.equal((await act("give-plan", { id: "u2", plan: "gold" })).status, 400);
  assert.equal((await act("give-plan", { id: "nobody1", plan: "pro" })).status, 404);
  assert.equal((await act("scan-now", { id: "u1" })).status, 200);
  assert.equal(db.prepare("SELECT next_scan_at FROM scans WHERE media_id = 'm1'").get().next_scan_at, 0);
  assert.equal((await act("give-plan", { id: "u2", plan: "pro" })).status, 200);
  assert.equal(db.prepare("SELECT plan FROM users WHERE id = 'u2'").get().plan, "pro");
  assert.equal((await act("end-plan", { id: "u1" })).status, 200);
  assert.equal(db.prepare("SELECT plan FROM users WHERE id = 'u1'").get().plan, "free");
  assert.deepEqual(db.prepare("SELECT kind, plan FROM plan_events ORDER BY id").all().map((r) => `${r.kind}:${r.plan}`), ["admin_comp:pro", "admin_end:free"]);
  assert.equal((await act("dismiss", { id: "mt1" })).status, 200);
  assert.equal(db.prepare("SELECT status FROM matches WHERE id = 'mt1'").get().status, "dismissed");
});
