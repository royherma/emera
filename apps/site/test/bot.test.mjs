import test from "node:test";
import assert from "node:assert/strict";
import { isBot } from "../src/worker.js";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";

test("real browsers pass", () => {
  assert.equal(isBot(CHROME, "Cloudflare London, LLC"), false);
  assert.equal(isBot("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36", "KT"), false);
});

test("scanner signatures are flagged", () => {
  assert.equal(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1", null), true);
  assert.equal(isBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36", null), true);
  assert.equal(isBot("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36", null), true);
  assert.equal(isBot("Mozilla/5.0", null), true);
  assert.equal(isBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537", null), true);
  assert.equal(isBot("Mozilla/5.0 (compatible; heritrix/3.14.2)", null), true);
  assert.equal(isBot(CHROME, "6 COLLYER QUAY"), true);
  assert.equal(isBot(CHROME, "CustodianDC Limited"), true);
});
