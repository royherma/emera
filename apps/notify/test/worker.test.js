import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyGithub, githubText, poll } from "../src/worker.js";

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

function fakeDb(rows) {
  return {
    prepare: (sql) => ({
      bind: (c) => ({ all: async () => ({ results: rows.filter((r) => r.cursor > c) }) }),
      first: async () => (sql.includes("MAX") ? { m: Math.max(0, ...rows.map((r) => r.cursor)) } : { n: rows.length }),
    }),
  };
}

test("poll: first run sets cursor silently, then only new rows post", async () => {
  const kv = new Map();
  const posted = [];
  globalThis.fetch = async (_u, init) => {
    posted.push(JSON.parse(init.body).text);
    return { json: async () => ({ ok: true }) };
  };
  const rows = [{ cursor: 1, email: "a@x.org", source: "site" }];
  const env = {
    ENVIRONMENT: "production", SLACK_BOT_TOKEN: "t", SLACK_CHANNEL: "C",
    STATE: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => kv.set(k, v) },
    SITE_DB: fakeDb(rows),
  };
  assert.deepEqual(await poll(env), {});
  assert.equal(posted.length, 0);
  rows.push({ cursor: 2, email: "b@x.org", source: "hero" });
  assert.deepEqual(await poll(env), { early: 1 });
  assert.match(posted[0], /Early list join.*b@x\.org.*from hero.*2 on the list/);
  assert.deepEqual(await poll(env), {});
});
