#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  note: (plan, f) => { plan.inbox = [...(plan.inbox ?? []), { at: new Date().toISOString(), text: f.text }]; },
};

const clients = new Set();
let ping;
const notify = (msg) => () => { clearTimeout(ping); ping = setTimeout(() => { for (const c of clients) c.write(`data: ${msg}\n\n`); }, 120); };
const changed = notify('reload');
watch(planFile, changed);
watch(pageFile, changed);
const atlasFile = join(root, 'data/atlas.json');
const atlasPage = join(root, 'plan/atlas.html');
const watchIfThere = (f, fn) => { if (existsSync(f)) watch(f, fn); };
watchIfThere(atlasFile, notify('atlas'));
watchIfThere(atlasPage, notify('atlas-page'));

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
