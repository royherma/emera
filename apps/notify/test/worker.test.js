import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyGithub, githubText, poll, slackPost } from "../src/worker.js";
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
    run: async () => db.prepare(sql).run(...args),
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

test("visit opens a thread, the early-list join lands in it with place, device and a real count", async () => {
  const h = harness();
  await poll(h.env);
  const now = new Date().toISOString();
  h.env.SITE_DB.raw.prepare("INSERT INTO visits (created_at, visitor, path, referrer, country, city, region, ua, bot) VALUES (?, 'v1', '/', 'https://www.instagram.com/', 'TH', 'Bangkok', 'Bangkok', ?, 0)").run(now, IPHONE);
  h.env.SITE_DB.raw.prepare("INSERT INTO visits (created_at, visitor, path, ua, bot) VALUES (?, 'b1', '/', 'curl/8', 1)").run(now);
  h.env.SITE_DB.raw.prepare("INSERT INTO early_access (email, created_at, source, visitor, country, city, ua) VALUES ('owner@gmail.com', ?, 'hero', 'v0', 'TH', 'Bangkok', ?)").run(now, IPHONE);
  h.env.SITE_DB.raw.prepare("INSERT INTO early_access (email, created_at, source, visitor, country, city, ua) VALUES ('maya@paint.org', ?, 'hero', 'v1', 'TH', 'Bangkok', ?)").run(now, IPHONE);
  assert.deepEqual(await poll(h.env), { visits: 1, early: 2 });
  const [visit, own, join] = h.posted;
  assert.match(JSON.stringify(visit.blocks), /New visitor.*Bangkok, TH.*Instagram.*phone · iPhone iOS 18\.1/);
  assert.match(JSON.stringify(own.blocks), /Test - Early list join/);
  assert.equal(join.thread_ts, "ts1");
  assert.equal(join.reply_broadcast, true);
  assert.match(JSON.stringify(join.blocks), /maya@paint\.org.*Bangkok, TH.*\*1\* on the list.*Bangkok.*emera\.social\/admin/);
});

test("new account waits for a handle, then posts with early-list match and profile link", async () => {
  const h = harness();
  await poll(h.env);
  const t = Date.now();
  h.env.SITE_DB.raw.prepare("INSERT INTO early_access (email, created_at) VALUES ('maya@paint.org', ?)").run(new Date(t - 3600_000).toISOString());
  h.env.API_DB.raw.prepare("INSERT INTO users (id, email, created_at) VALUES ('u1', 'maya@paint.org', ?)").run(t);
  assert.deepEqual(await poll(h.env, t + 60_000), { early: 1 });
  h.env.API_DB.raw.prepare("UPDATE users SET handle = 'maya', display_name = 'Maya' WHERE id = 'u1'").run();
  assert.deepEqual(await poll(h.env, t + 120_000), { users: 1 });
  assert.match(h.text(), /New account.*@maya.*Maya.*maya@paint\.org.*on the early list since.*\*1\* accounts.*emera\.social\/@maya/);
});

test("ledger has no emails and leaves out test accounts", async () => {
  const h = harness();
  const t = Date.now();
  h.env.API_DB.raw.prepare("INSERT INTO users (id, email, handle, created_at) VALUES ('u1', 'maya@paint.org', 'maya', ?), ('u2', 'owner@gmail.com', 'roy', ?)").run(t, t);
  h.env.API_DB.raw.prepare("INSERT INTO posts (id, user_id, caption, created_at) VALUES ('p1', 'u1', 'hi', ?), ('p2', 'u2', 'test', ?)").run(t, t);
  const l = ledgerView(await load(h.env));
  assert.deepEqual(l.totals, { accounts: 1, posts: 1, early: 0, reports: 0 });
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
