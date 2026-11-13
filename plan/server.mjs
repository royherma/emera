#!/usr/bin/env node
import { execSync, spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPTURED, codeHash } from '../tools/atlas/codehash.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5035;
const planFile = join(root, 'data/plan.json');
const pageFile = join(root, 'plan/index.html');
const logFile = join(root, 'data/feedback.jsonl');
const readPlan = () => JSON.parse(readFileSync(planFile, 'utf8'));

const task = (plan, id) => plan.phases.flatMap((p) => p.tasks).find((t) => t.id === id);
const apply = {
  'task-toggle': (plan, f) => { task(plan, f.id).done = f.done; },
  'task-edit': (plan, f) => { task(plan, f.id).text = f.text; },
  'task-add': (plan, f) => {
    const phase = plan.phases.find((p) => p.id === f.phase);
    f.id = `${phase.id}${phase.tasks.length + 1}-${Date.now() % 1000}`;
    phase.tasks.push({ id: f.id, text: f.text, who: 'roy', added: true });
  },
  pick: (plan, f) => { plan.decisions.find((d) => d.id === f.id).pick = f.pick; },
  'decision-note': (plan, f) => { plan.decisions.find((d) => d.id === f.id).note = f.note; },
  'name-vote': (plan, f) => { plan.names.items.find((n) => n.id === f.id).vote = f.vote; },
  'brand-vote': (plan, f) => { plan.brand.items.find((n) => n.id === f.id).vote = f.vote; },
  'name-add': (plan, f) => { f.id = `n${Date.now() % 100000}`; plan.names.items.push({ id: f.id, name: f.name, why: 'Roy added', added: true }); },
  review: (plan, f) => {
    const r = plan.review.find((x) => x.id === f.id);
    Object.assign(r, { answer: f.answer ?? null, text: 'text' in f ? f.text : r.text, at: f.answer ? new Date().toISOString() : null });
    const t = r.task && task(plan, r.task);
    if (t && r.kind === 'do') t.done = f.answer === 'done';
  },
  note: (plan, f) => { plan.inbox = [...(plan.inbox ?? []), { at: new Date().toISOString(), text: f.text }]; },
};

const clients = new Set();
const pings = {};
const notify = (msg) => () => { clearTimeout(pings[msg]); pings[msg] = setTimeout(() => { for (const c of clients) c.write(`data: ${msg}\n\n`); }, 120); };
const changed = notify('reload');
watch(planFile, changed);
watch(pageFile, changed);
const atlasFile = join(root, 'data/atlas.json');
const atlasPage = join(root, 'plan/atlas.html');
const watchIfThere = (f, fn) => { if (existsSync(f)) watch(f, fn); };
watchIfThere(atlasFile, notify('atlas'));
watchIfThere(atlasPage, notify('atlas-page'));

const shotsIndex = join(root, 'data/atlas-shots/index.json');
const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
let building = false, buildAgain = false, buildTimer, lastAppEdit = 0;
function build() {
  if (building) { buildAgain = true; return; }
  building = true;
  const t = Date.now();
  const p = spawn(process.execPath, [join(root, 'tools/atlas/build.mjs')], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => {
    building = false;
    console.log(code ? `ATLAS build failed: ${err.slice(-300)}` : `ATLAS rebuilt in ${Date.now() - t} ms`);
    if (buildAgain) { buildAgain = false; build(); }
  });
}
const kickBuild = (_, f) => {
  if (f && /node_modules|\.wrangler|\.expo|dist/.test(f)) return;
  clearTimeout(buildTimer);
  buildTimer = setTimeout(build, 400);
};
for (const p of ['apps', 'lexicons', 'docs/stories.yaml', 'docs/features.yaml', 'data/platforms.json', 'tools/atlas/build.mjs', 'data/atlas-shots/index.json', 'CLAUDE.md']) {
  const f = join(root, p);
  if (existsSync(f)) watch(f, { recursive: true }, (e, name) => {
    if (p === 'apps' && name && CAPTURED.some((c) => join('apps', name).startsWith(c))) lastAppEdit = Date.now();
    kickBuild(e, name);
  });
}
build();

const QUIET_MS = 90_000, COOLDOWN_MS = 5 * 60_000;
const shots = { running: false, startedAt: null, by: null, why: null, lines: [], last: null, autoAt: 0 };
const shotsState = () => ({ ...shots, elapsedMs: shots.running ? Date.now() - Date.parse(shots.startedAt) : null, lastMs: readJson(shotsIndex)?.ms ?? null });
function startShots(by, why) {
  if (shots.running) return false;
  Object.assign(shots, { running: true, startedAt: new Date().toISOString(), by, why, lines: [] });
  console.log(`SHOTS start by ${by}: ${why}`);
  const p = spawn(process.execPath, [join(root, 'tools/atlas/shots.mjs')], { cwd: root, env: { ...process.env, ATLAS_SHOTS_BY: by, ATLAS_SHOTS_WHY: why }, stdio: ['ignore', 'pipe', 'pipe'] });
  const take = (d) => {
    for (const l of String(d).split('\n').filter((x) => x.startsWith('SHOTS '))) { shots.lines.push({ at: Date.now(), text: l.slice(6) }); if (shots.lines.length > 60) shots.lines.shift(); }
    notify('shots')();
  };
  p.stdout.on('data', take);
  p.stderr.on('data', take);
  p.on('close', (code) => {
    Object.assign(shots, { running: false, last: { ok: code === 0, at: new Date().toISOString(), ms: Date.now() - Date.parse(shots.startedAt) } });
    console.log(`SHOTS ${code === 0 ? 'done' : 'failed'} in ${shots.last.ms} ms`);
    notify('shots')();
    build();
  });
  notify('shots')();
  return true;
}
function changedSince(sha) {
  const run = (c) => { try { return execSync(c, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n').filter(Boolean); } catch { return []; } };
  return [...new Set([...run(`git diff --name-only ${sha} -- ${CAPTURED.join(' ')}`), ...run(`git ls-files --others --exclude-standard -- ${CAPTURED.join(' ')}`)])];
}
setInterval(() => {
  if (shots.running || Date.now() - lastAppEdit < QUIET_MS || Date.now() - shots.autoAt < COOLDOWN_MS) return;
  const idx = readJson(shotsIndex);
  const now = codeHash(root);
  if (idx?.codeHash === now) return;
  const runs = existsSync(join(root, 'data/atlas-shots/runs.jsonl')) ? readFileSync(join(root, 'data/atlas-shots/runs.jsonl'), 'utf8').trim().split('\n') : [];
  const lastRun = runs.length ? JSON.parse(runs.at(-1)) : null;
  if (lastRun && !lastRun.ok && lastRun.codeHash === now) return;
  const files = idx?.git?.sha ? changedSince(idx.git.sha) : [];
  const why = idx ? `app code changed: ${files.slice(0, 3).map((f) => f.replace(/^apps\/(mobile\/src\/)?/, '')).join(', ')}${files.length > 3 ? ` +${files.length - 3} more` : ''}` : 'no captures yet';
  shots.autoAt = Date.now();
  startShots('auto', why);
}, 30_000);

function feedback(req, res) {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const f = JSON.parse(body || '{}');
    if (!apply[f.kind]) { res.writeHead(400).end('unknown kind'); return; }
    const plan = readPlan();
    apply[f.kind](plan, f);
    writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);
    const row = { at: new Date().toISOString(), ...f };
    appendFileSync(logFile, `${JSON.stringify(row)}\n`);
    console.log(`DECISION ${JSON.stringify(row)}`);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, id: f.id }));
  });
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/plan.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(readFileSync(planFile));
    return;
  }
  if (url.pathname === '/atlas.json') {
    res.writeHead(existsSync(atlasFile) ? 200 : 404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(existsSync(atlasFile) ? readFileSync(atlasFile) : '{}');
    return;
  }
  if (url.pathname === '/atlas') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(readFileSync(atlasPage));
    return;
  }
  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write('retry: 1000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname === '/api/feedback' && req.method === 'POST') { feedback(req, res); return; }
  if (url.pathname === '/api/atlas/shots') {
    if (req.method === 'POST') {
      const by = (url.searchParams.get('by') || 'Capture button').slice(0, 40);
      const started = startShots(by, url.searchParams.get('why')?.slice(0, 120) || 'Capture now on the Atlas page');
      res.writeHead(started ? 202 : 409, { 'Content-Type': 'application/json' }).end(JSON.stringify(shotsState()));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(shotsState()));
    return;
  }
  const file = url.pathname.startsWith('/file/') && join(root, decodeURIComponent(url.pathname.slice(6)));
  if (file && /^(\.claude\/artifacts|brand|docs|data\/atlas-shots)\/|^README\.md$|^CONTRIBUTING\.md$/.test(decodeURIComponent(url.pathname.slice(6))) && !file.includes('..') && existsSync(file)) {
    const type = { '.png': 'image/png', '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.md': 'text/plain; charset=utf-8', '.json': 'application/json' }[extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(readFileSync(file));
    return;
  }
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(readFileSync(pageFile));
    return;
  }
  res.writeHead(404).end('not found');
}).listen(PORT, '127.0.0.1', () => console.log(`LIVE http://agora.localhost:${PORT}/`));
