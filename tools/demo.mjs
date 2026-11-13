#!/usr/bin/env node
// Demo creators and posts in a real database, through the real API: `npm run demo -- on|off|status [local|staging]`.
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = join(ROOT, "apps/api");
const CONTENT = join(ROOT, "brand/content");
const ENVS = {
  local: { api: "http://127.0.0.1:5036", d1: ["--local"] },
  staging: { api: "https://emera-api-staging.techguyver1337.workers.dev", d1: ["--env", "staging", "--remote"] },
};
const DEMO_EMAIL = (handle) => `demo.${handle}@example.com`;
const DEMO_WHERE = "email LIKE 'demo.%@example.com'";

const [cmd = "status", envName = "staging"] = process.argv.slice(2);
if (envName === "production") die("Demo content never goes on production.");
const env = ENVS[envName] ?? die(`Unknown env "${envName}". Use local or staging.`);

const sources = JSON.parse(readFileSync(join(CONTENT, "sources.json"), "utf8"));
const byFile = Object.fromEntries([...sources.founder_work, ...sources.openverse_items].map((s) => [s.file, s]));

const BIOS = {
  Ceramics: "Wheel and kiln, mostly bowls", Architecture: "Buildings, mostly looking up", Food: "Cooking at home, slowly",
  Calligraphy: "Letters by hand, every day", "Street art": "Walls, paint, ladders", Music: "Records, gigs, sound",
  "3D": "Worlds made on a laptop", Fashion: "Cloth, cut and stitch", "Textile craft": "Yarn and natural dye",
  Woodwork: "Wood, hand tools, patience", Painting: "Oils and the paintings that taught me", Dance: "Movement, rehearsals, stages",
  "Street photo": "Strangers and Sunday mornings", Tattoo: "Ink on skin, healed shots only", Jewelry: "Silver, hammered by hand",
  "Paper craft": "One sheet, no scissors", "Night photo": "After the last train", Illustration: "Ink and wash",
  Events: "What is on in the old town this week",
};
const CAPTIONS = {
  "ceramics.jpg": "Thursday night class. Everyone left with something lopsided and proud",
  "stairs.jpg": "Spiral stairs, shot straight down from the top floor",
  "sourdough.jpg": "Sourdough with everything seasoning. Day four of the new starter",
  "ramen.jpg": "Shoyu ramen, broth on since breakfast",
  "lettering.jpg": "Burn the boats. Blackletter with an automatic pen",
  "mural.jpg": "Finished the east wall before the rain came",
  "guitar.jpg": "Soundcheck from the front row",
  "swirl3d.jpg": "Glass swirl render. Four hours of laptop fan",
  "pyramids3d.jpg": "Low poly pyramids, testing a new light setup",
  "kimono.jpg": "Kimono study at the V&A. The stitching up close is unreal",
  "yarn.jpg": "Hand dyed batch for the winter shawls",
  "woodfigure.jpg": "Watchman, carved from one block",
  "watercolor.jpg": "Louveciennes in snow, 1874. The painting I keep coming back to",
  "balletfeet.jpg": "Pointe work, rehearsal three of five",
  "reddance.jpg": "Opening night. Red light, no safety net",
  "ringsbw.jpg": "Venice Beach rings, Sunday morning",
  "tattooleg.jpg": "Healed leg piece, two sessions",
  "records.jpg": "New pressing just arrived. Side A first",
  "jewelry.jpg": "Hammered silver, last of the autumn pieces",
  "origami.jpg": "Origami boxes, one square sheet each",
  "nightstreet.jpg": "Back alleys after the last train",
  "brutalist.jpg": "Old IBM campus in Boca Raton. Concrete that still looks like the future",
  "strawberry.jpg": "First strawberries from the market this year",
  "woodwheel.jpg": "Wheelwright shop in Williamsburg, still done by hand",
  "dress.jpg": "Ballet dancer, ink and wash from an old pattern book",
  "lanterns.jpg": "Labyrinth of Light opened tonight in the old town. Free until Sunday",
};
const FOUNDER = {
  handle: "techguyver", displayName: "TechGuyver", bio: "I build tools for creators and film all of it",
  posts: [
    { files: ["tg-photo-1.jpg", "tg-photo-2.jpg", "tg-photo-3.jpg", "tg-photo-4.jpg"], caption: "On stage at NAS Summit talking about building in the open" },
    { files: ["tg-thumb-1.jpg", "tg-thumb-2.jpg", "tg-thumb-3.jpg"], caption: "Three thumbnails for the MightyMouse video. Which one wins?" },
    { files: ["tg-art-1.jpg", "tg-art-2.jpg", "tg-art-3.jpg", "tg-art-4.jpg", "tg-art-5.jpg"], caption: "Same cat, same tea, five different worlds" },
    { files: ["tg-art-6.jpg", "tg-art-7.jpg", "tg-art-8.jpg", "tg-art-9.jpg", "tg-art-10.jpg"], caption: "Part two. The bauhaus one is my favourite" },
  ],
};
const COMMENTS = [
  "The colours on this", "How long did this take you?", "This made my morning", "Need to see this in person",
  "The detail up close must be wild", "Okay this is beautiful", "More of this please", "What are you working on next?",
  "Love the light here", "This is so calm", "Teach me", "The texture though", "Instant favourite", "Where is this?",
];
const REPLIES = ["Thank you, means a lot", "About two weeks on and off", "More coming this weekend", "Thanks! It was a long one"];

function personas() {
  const list = sources.openverse_items.filter((s) => CAPTIONS[s.file]).map((s) => {
    const credit = s.license === "BY" ? ` · Photo: ${s.original_creator}, CC BY` : "";
    return {
      handle: s.emera_handle.replace(/\.emera\.social$/, "").replace(/\./g, "_").slice(0, 20),
      displayName: s.emera_creator, bio: BIOS[s.kind] ?? "",
      posts: [{ files: [s.file], caption: CAPTIONS[s.file] + credit }],
    };
  });
  return [FOUNDER, ...list];
}

let seed = 20261113;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (arr, n) => [...arr].sort(() => rand() - 0.5).slice(0, n);
const sql = (s) => `'${String(s).replace(/'/g, "''")}'`;

function die(msg) { console.error(msg); process.exit(1); }

function d1(args) {
  return execFileSync("npx", ["wrangler", "d1", "execute", "DB", ...env.d1, ...args], { cwd: API_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function d1Query(q) {
  const out = d1(["--json", "--command", q]);
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
}
function d1File(text) {
  const f = join(mkdtempSync(join(tmpdir(), "emera-demo-")), "demo.sql");
  writeFileSync(f, text);
  d1(["--file", f, "--yes"]);
}

async function api(method, path, { token, json, body, type } = {}) {
  const headers = { "X-TG-Tester": "1" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  if (type) headers["Content-Type"] = type;
  const url = path.startsWith("http") ? path : env.api + path;
  let res;
  for (let tries = 1; ; tries++) {
    try { res = await fetch(url, { method, headers, body: json ? JSON.stringify(json) : body }); break; }
    catch (e) { if (tries >= 4) throw e; await new Promise((r) => setTimeout(r, 500 * tries)); }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await fn(queue.shift()); }));
}

// One fresh session per demo account, written straight to D1: sign-in codes go by email, which demo accounts can't read.
function sessions(people) {
  const now = Date.now();
  const lines = ["DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE " + DEMO_WHERE + ");"];
  people.forEach((p, i) => {
    p.token = randomBytes(32).toString("hex");
    p.id = `demo_${p.handle}`;
    const joined = now - (60 - i) * 86400000;
    lines.push(`INSERT OR IGNORE INTO users (id, email, handle, display_name, bio, created_at) VALUES (${sql(p.id)}, ${sql(DEMO_EMAIL(p.handle))}, ${sql(p.handle)}, ${sql(p.displayName)}, ${sql(p.bio)}, ${joined});`);
    lines.push(`INSERT INTO sessions (token_hash, user_id, created_at, expires_at) SELECT ${sql(createHash("sha256").update(p.token).digest("hex"))}, id, ${now}, ${now + 86400000} FROM users WHERE email = ${sql(DEMO_EMAIL(p.handle))};`);
  });
  d1File(lines.join("\n"));
}

async function upload(token, file) {
  const path = join(CONTENT, file);
  const slot = await api("POST", "/v1/uploads", { token, json: { contentType: "image/jpeg", bytes: statSync(path).size } });
  const { media } = await api("PUT", slot.uploadUrl, { token, body: readFileSync(path), type: "image/jpeg" });
  return media.id;
}

async function on() {
  await api("GET", "/health").catch(() => die(`API not reachable at ${env.api}. Local: npm run api`));
  const people = personas();
  sessions(people);
  const existing = new Set(d1Query(`SELECT u.handle FROM posts p JOIN users u ON u.id = p.user_id WHERE u.${DEMO_WHERE}`).map((r) => r.handle));

  const jobs = [];
  people.forEach((p) => p.posts.forEach((post) => !existing.has(p.handle) && jobs.push({ p, post })));
  const ages = jobs.map((_, i) => 20 + Math.round((i / Math.max(1, jobs.length - 1)) ** 1.6 * 14 * 1440));
  const shuffled = pick(jobs, jobs.length);
  const made = [];
  await pool(shuffled.map((j, i) => ({ ...j, ago: ages[i] })), 4, async ({ p, post, ago }) => {
    const mediaIds = [];
    for (const f of post.files) mediaIds.push(await upload(p.token, f));
    const createdAt = new Date(Date.now() - ago * 60000).toISOString();
    const res = await api("POST", "/v1/posts", { token: p.token, json: { mediaIds, caption: post.caption, createdAt } });
    made.push({ id: res.post.id, author: p });
    console.log(`posted  @${p.handle}  ${post.files.length} file(s)  ${res.post.id}`);
  });

  const follows = [];
  for (const p of people) {
    const others = people.filter((o) => o !== p);
    for (const o of pick(others, 6 + Math.floor(rand() * 7))) follows.push([p, o]);
    if (p !== FOUNDER && rand() < 0.8) follows.push([p, FOUNDER]);
  }
  await pool(follows, 8, ([a, b]) => api("POST", `/v1/follows/${b.handle}`, { token: a.token }).catch(() => {}));
  console.log(`follows ${follows.length}`);

  const allPosts = d1Query(`SELECT p.id, u.handle FROM posts p JOIN users u ON u.id = p.user_id WHERE u.${DEMO_WHERE}`);
  const likes = [];
  for (const post of allPosts) {
    const fans = people.filter((o) => o.handle !== post.handle);
    for (const f of pick(fans, 4 + Math.floor(rand() * 18))) likes.push([f, post.id]);
  }
  await pool(likes, 8, ([f, id]) => api("POST", `/v1/posts/${id}/like`, { token: f.token }));
  console.log(`likes   ${likes.length}`);

  let comments = 0;
  await pool(made, 4, async ({ id, author }) => {
    const fans = people.filter((o) => o !== author);
    for (const f of pick(fans, Math.floor(rand() * 4))) {
      const { comment } = await api("POST", `/v1/posts/${id}/comments`, { token: f.token, json: { body: COMMENTS[Math.floor(rand() * COMMENTS.length)] } });
      comments++;
      if (rand() < 0.4) await api("POST", `/v1/posts/${id}/comments`, { token: author.token, json: { body: REPLIES[Math.floor(rand() * REPLIES.length)], parentId: comment.id } });
    }
  });
  console.log(`comments ${comments}`);
  status();
}

async function off() {
  const people = d1Query(`SELECT handle FROM users WHERE ${DEMO_WHERE} AND handle IS NOT NULL`).map((r) => ({ handle: r.handle, posts: [] }));
  if (people.length) {
    sessions(people.map((p) => Object.assign(p, { displayName: "", bio: "" })));
    const posts = d1Query(`SELECT p.id, u.handle FROM posts p JOIN users u ON u.id = p.user_id WHERE u.${DEMO_WHERE}`);
    const tokenOf = Object.fromEntries(people.map((p) => [p.handle, p.token]));
    await pool(posts, 6, (p) => api("DELETE", `/v1/posts/${p.id}`, { token: tokenOf[p.handle] }));
    console.log(`deleted ${posts.length} posts (files removed from storage)`);
  }
  const D = `(SELECT id FROM users WHERE ${DEMO_WHERE})`;
  d1File([
    `DELETE FROM notifications WHERE user_id IN ${D} OR actor_id IN ${D};`,
    `DELETE FROM comments WHERE user_id IN ${D};`,
    `DELETE FROM likes WHERE user_id IN ${D};`,
    `DELETE FROM follows WHERE follower_id IN ${D} OR followee_id IN ${D};`,
    `DELETE FROM blocks WHERE blocker_id IN ${D} OR blocked_id IN ${D};`,
    `DELETE FROM mutes WHERE muter_id IN ${D} OR muted_id IN ${D};`,
    `DELETE FROM flags WHERE reporter_user_id IN ${D} OR target_id IN ${D};`,
    `DELETE FROM reports WHERE reporter_user_id IN ${D};`,
    `DELETE FROM media WHERE user_id IN ${D};`,
    `DELETE FROM invites WHERE created_by IN ${D};`,
    `DELETE FROM sessions WHERE user_id IN ${D};`,
    `DELETE FROM users WHERE ${DEMO_WHERE};`,
  ].join("\n"));
  status();
}

function status() {
  const [r] = d1Query(`SELECT (SELECT count(*) FROM users WHERE ${DEMO_WHERE}) demo_people,
    (SELECT count(*) FROM posts p JOIN users u ON u.id = p.user_id WHERE u.${DEMO_WHERE}) demo_posts,
    (SELECT count(*) FROM users WHERE NOT ${DEMO_WHERE}) real_people,
    (SELECT count(*) FROM posts p JOIN users u ON u.id = p.user_id WHERE NOT u.${DEMO_WHERE}) real_posts`);
  console.log(`${envName}: demo ${r.demo_people} people / ${r.demo_posts} posts, real ${r.real_people} people / ${r.real_posts} posts`);
}

const run = { on, off, status }[cmd] ?? (() => die("Usage: npm run demo -- on|off|status [local|staging]"));
await run();
