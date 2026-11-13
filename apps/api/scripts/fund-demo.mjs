#!/usr/bin/env node
// Demo fund data. Local D1 by default, `--env staging` for remote staging. `--wipe` removes only demo rows.
// Usage: node scripts/fund-demo.mjs [--env staging] [--wipe] [--api <url>] [--key <admin key>]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const envName = opt('env', null);
const wipeOnly = args.includes('--wipe');
const api = (opt('api', process.env.FUND_API ?? (envName ? 'https://emera-api-staging.techguyver1337.workers.dev' : 'http://agora-api.localhost:5036'))).replace(/\/$/, '');
const key = opt('key', process.env.FUND_ADMIN_KEY ?? 'dev-fund-admin');
const where = envName ? ['--env', envName, '--remote'] : ['--local'];
const bucket = envName ? `emera-media-${envName}` : 'emera-media-dev';
const DEMO_EMAIL = '@demo.emera.invalid';
const work = mkdtempSync(join(tmpdir(), 'fund-demo-'));

const bin = join(root, 'node_modules/.bin/wrangler');
const wrangler = (...a) => execFileSync(existsSync(bin) ? bin : 'npx', existsSync(bin) ? a : ['wrangler', ...a], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
const query = (sql) => JSON.parse(wrangler('d1', 'execute', 'DB', ...where, '--json', '--command', sql))[0].results;
const runFile = (sql) => {
  const f = join(work, `run-${Date.now()}.sql`);
  writeFileSync(f, sql);
  wrangler('d1', 'execute', 'DB', ...where, '--file', f);
};
const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

let seed = 20261113;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (list) => list[Math.floor(rand() * list.length)];

const now = new Date();
const monthAt = (by) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + by, 1)).toISOString().slice(0, 7);
const months = [monthAt(-3), monthAt(-2), monthAt(-1), monthAt(0)];

function wipeSql() {
  const demoUsers = `SELECT id FROM users WHERE email LIKE '%${DEMO_EMAIL}'`;
  const demoMonths = `SELECT month FROM sponsorships WHERE demo = 1 UNION SELECT substr(day, 1, 7) FROM fund_watch WHERE demo = 1`;
  return [
    `DELETE FROM fund_shares WHERE month IN (${demoMonths});`,
    `DELETE FROM fund_months WHERE month IN (${demoMonths});`,
    `DELETE FROM fund_watch WHERE demo = 1 OR viewer_id IN (${demoUsers}) OR creator_id IN (${demoUsers});`,
    'DELETE FROM sponsorships WHERE demo = 1;',
    'DELETE FROM sponsors WHERE demo = 1;',
    `DELETE FROM media WHERE user_id IN (${demoUsers});`,
    `DELETE FROM posts WHERE user_id IN (${demoUsers});`,
    `DELETE FROM sessions WHERE user_id IN (${demoUsers});`,
    `DELETE FROM users WHERE email LIKE '%${DEMO_EMAIL}';`,
  ].join('\n');
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function png(width, height, [r1, g1, b1], [r2, g2, b2]) {
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = (x / width + y / height) / 2;
      raw.set([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t].map(Math.round), y * stride + 1 + x * 3);
    }
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const DEMO_CREATORS = [
  ['brannoch_vell', 'Brannoch Vell', 'Ceramics and kiln days'],
  ['isaura_quent', 'Isaura Quent', 'Street photos after rain'],
  ['tamsin_corrow', 'Tamsin Corrow', 'Linocut prints'],
  ['odran_pikewell', 'Odran Pikewell', 'Short films about small towns'],
  ['wrenna_halloway', 'Wrenna Halloway', 'Hand-bound notebooks'],
  ['caspian_ondree', 'Caspian Ondree', 'Synth loops and field recordings'],
  ['milo_ferrant', 'Milo Ferrant', 'Woodwork from scrap'],
  ['sefa_lindqvane', 'Sefa Lindqvane', 'Local news from the harbour'],
];
const DEMO_VIEWERS = ['juno_aldermere', 'piet_varrow', 'noor_tessaly', 'ilse_brackwater', 'tobin_marsk', 'esme_calloway'];
const CAPTIONS = ['First firing of the season', 'Rain on the old market', 'Proof three, finally right', 'Behind the scenes', 'Made this from offcuts', 'Morning on the harbour', 'Still learning this one', 'Four hours, one take'];
const COLORS = [[[236, 112, 76], [246, 196, 120]], [[52, 92, 160], [140, 190, 230]], [[40, 120, 96], [180, 220, 150]], [[120, 60, 140], [230, 150, 200]], [[30, 30, 40], [160, 150, 140]], [[200, 170, 60], [250, 240, 200]]];

const SPONSORS = [
  ['Quillfern Paper Co.', 'https://quillfern.example', 0.26],
  ['Low Tide Lens Shop', 'https://lowtide-lens.example', 0.21],
  ['Marrowbend Studio', 'https://marrowbend.example', 0.17],
  ['Cobalt Kettle Prints', 'https://cobaltkettle.example', 0.14],
  ['Fernhollow Frames', 'https://fernhollow.example', 0.12],
  ['Saltgrass Type Foundry', 'https://saltgrass.example', 0.1],
];
const MONTH_TOTAL_CENTS = [240_000, 310_000, 390_000, 460_000];

function demoPeopleSql(stamp) {
  const out = [];
  const media = [];
  const created = Date.now() - 120 * 86_400_000;
  const people = [...DEMO_CREATORS.map((c) => [...c, true]), ...DEMO_VIEWERS.map((h) => [h, h.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), '', false])];
  for (const [handle, name, bio, makes] of people) {
    const id = `demo${handle}`.slice(0, 24);
    out.push(`INSERT INTO users (id, email, handle, display_name, bio, created_at) VALUES (${q(id)}, ${q(handle + DEMO_EMAIL)}, ${q(handle)}, ${q(name)}, ${q(bio)}, ${created});`);
    if (!makes) continue;
    const n = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const postId = `demo${stamp}${handle.slice(0, 6)}${i}`;
      const mediaId = `${postId}m`;
      const r2 = `demo/${mediaId}.png`;
      const at = Date.now() - Math.floor(rand() * 100) * 86_400_000;
      out.push(`INSERT INTO posts (id, user_id, caption, created_at) VALUES (${q(postId)}, ${q(id)}, ${q(pick(CAPTIONS))}, ${at});`);
      out.push(`INSERT INTO media (id, user_id, kind, content_type, declared_bytes, status, width, height, r2_key, post_id, position, created_at) VALUES (${q(mediaId)}, ${q(id)}, 'image', 'image/png', 0, 'done', 216, 270, ${q(r2)}, ${q(postId)}, 0, ${at});`);
      media.push(r2);
    }
  }
  return { sql: out.join('\n'), media };
}

function sponsorSql(stamp) {
  const out = [];
  const created = Date.now();
  SPONSORS.forEach(([name, url], i) => {
    out.push(`INSERT INTO sponsors (id, name, url, contact_email, demo, created_at) VALUES (${q(`demosp${i}`)}, ${q(name)}, ${q(url)}, ${q(`hello@${new URL(url).hostname}`)}, 1, ${created});`);
  });
  months.forEach((month, m) => {
    SPONSORS.forEach(([, , weight], i) => {
      if (m === 0 && i === SPONSORS.length - 1) return;
      const cents = Math.round(MONTH_TOTAL_CENTS[m] * weight / 100) * 100;
      const at = Date.parse(`${month}-02T09:00:00Z`);
      out.push(`INSERT INTO sponsorships (id, sponsor_id, month, amount_cents, status, demo, created_at, paid_at) VALUES (${q(`demo${stamp}${month}${i}`)}, ${q(`demosp${i}`)}, ${q(month)}, ${cents}, 'paid', 1, ${at}, ${at});`);
    });
  });
  return out.join('\n');
}

function watchSql(users, posts) {
  const byCreator = new Map();
  for (const p of posts) byCreator.set(p.user_id, [...(byCreator.get(p.user_id) ?? []), p]);
  const creators = [...byCreator.keys()].sort();
  const weight = creators.map((_, i) => 1 / (i + 1) ** 1.15);
  const sum = weight.reduce((a, b) => a + b, 0);
  const pickCreator = () => {
    let r = rand() * sum;
    for (let i = 0; i < creators.length; i++) if ((r -= weight[i]) <= 0) return creators[i];
    return creators.at(-1);
  };
  const today = now.toISOString().slice(0, 10);
  const rows = new Map();
  const perViewerCreator = new Map();
  for (const month of months) {
    for (let d = 1; d <= 31; d++) {
      const day = `${month}-${String(d).padStart(2, '0')}`;
      if (Number.isNaN(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day || day > today) continue;
      const visits = 25 + Math.floor(rand() * 30);
      for (let v = 0; v < visits; v++) {
        const creator = pickCreator();
        const viewer = pick(users.filter((u) => u.id !== creator));
        if (!viewer) continue;
        const post = pick(byCreator.get(creator));
        const cap = post.video ? 600 : 60;
        const k = `${day}|${viewer.id}|${post.id}`;
        const vc = `${day}|${viewer.id}|${creator}`;
        const have = rows.get(k)?.seconds ?? 0;
        const room = Math.min(cap - have, 1800 - (perViewerCreator.get(vc) ?? 0));
        const add = Math.min(room, post.video ? 30 + Math.floor(rand() * 400) : 6 + Math.floor(rand() * 50));
        if (add <= 0) continue;
        rows.set(k, { day, viewer: viewer.id, post: post.id, creator, seconds: have + add });
        perViewerCreator.set(vc, (perViewerCreator.get(vc) ?? 0) + add);
      }
    }
  }
  return {
    count: rows.size,
    sql: [...rows.values()].map((r) => `INSERT OR IGNORE INTO fund_watch (day, viewer_id, post_id, creator_id, seconds, demo) VALUES (${q(r.day)}, ${q(r.viewer)}, ${q(r.post)}, ${q(r.creator)}, ${r.seconds}, 1);`).join('\n'),
  };
}

async function closePast() {
  for (const month of months.slice(0, 3)) {
    let res;
    try {
      res = await fetch(`${api}/v1/admin/fund/close`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-TG-Tester': '1' }, body: JSON.stringify({ month }) });
    } catch (e) {
      console.error(`Could not reach ${api} (${e.cause?.code ?? e.message}). Start the API, then run again with --api <url>.`);
      process.exit(1);
    }
    const body = await res.json();
    if (!res.ok) {
      console.error(`close ${month}: ${res.status} ${JSON.stringify(body)}`);
      process.exit(1);
    }
    const s = body.statement;
    console.log(`closed ${month}: sponsored $${(s.sponsoredCents / 100).toFixed(2)}, pool $${(s.creatorPoolCents / 100).toFixed(2)}, ${s.creators} creators, carry $${(s.carryOutCents / 100).toFixed(2)}, sha ${s.sha256.slice(0, 12)}`);
  }
}

console.log(`fund demo on ${envName ?? 'local'} D1`);
runFile(wipeSql());
if (wipeOnly) {
  console.log('demo rows removed');
  process.exit(0);
}

const stamp = Date.now().toString(36).slice(-4);
const counts = query('SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM posts) AS posts')[0];
if (counts.users < 12 || counts.posts < 15) {
  const people = demoPeopleSql(stamp);
  runFile(people.sql);
  people.media.forEach((r2, i) => {
    const f = join(work, `${i}.png`);
    writeFileSync(f, png(216, 270, ...COLORS[i % COLORS.length]));
    wrangler('r2', 'object', 'put', `${bucket}/${r2}`, '--file', f, '--content-type', 'image/png', ...where);
  });
  console.log(`made ${DEMO_CREATORS.length + DEMO_VIEWERS.length} demo people and ${people.media.length} demo posts`);
}

runFile(sponsorSql(stamp));
const users = query('SELECT id FROM users');
const posts = query(`SELECT p.id, p.user_id, EXISTS (SELECT 1 FROM media m WHERE m.post_id = p.id AND m.kind = 'video') AS video FROM posts p`);
const watch = watchSql(users, posts);
runFile(watch.sql);
console.log(`${SPONSORS.length} sponsors, ${months.length} months of sponsorships, ${watch.count} watch rows`);
await closePast();
