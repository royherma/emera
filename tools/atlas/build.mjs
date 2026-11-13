#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, watch, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { codeHash } from './codehash.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const R = (...p) => join(root, ...p);
const read = (p) => readFileSync(R(p), 'utf8');
const SKIP = /(^|\/)(node_modules|dist|\.wrangler|\.expo|\.turbo)(\/|$)/;

function walk(dir, test = () => true) {
  const out = [];
  if (!existsSync(R(dir))) return out;
  for (const name of readdirSync(R(dir))) {
    const rel = `${dir}/${name}`;
    if (SKIP.test(rel)) continue;
    if (statSync(R(rel)).isDirectory()) out.push(...walk(rel, test));
    else if (test(rel)) out.push(rel);
  }
  return out.sort();
}

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;
const stripJsonc = (s) => {
  let out = '';
  let str = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (str) { out += c; if (c === '\\') out += s[++i]; else if (c === '"') str = false; continue; }
    if (c === '"') { str = true; out += c; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && s[i + 1] === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i++; continue; }
    out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
};

function tables() {
  const out = [];
  for (const [app, db] of [['api', 'emera-api DB'], ['site', 'emera-site DB']]) {
    for (const f of walk(`apps/${app}/migrations`, (p) => p.endsWith('.sql'))) {
      const sql = read(f);
      for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\);/g)) {
        const cols = [];
        let depth = 0, cur = '';
        for (const ch of m[2]) {
          if (ch === '(') depth++;
          if (ch === ')') depth--;
          if (ch === ',' && depth === 0) { cols.push(cur.trim()); cur = ''; } else cur += ch;
        }
        if (cur.trim()) cols.push(cur.trim());
        const columns = cols.filter((c) => !/^(PRIMARY|UNIQUE|FOREIGN|CHECK|CONSTRAINT)/i.test(c)).map((c) => {
          const [name, type] = c.split(/\s+/);
          const fk = c.match(/REFERENCES\s+(\w+)/i);
          return { name, type, pk: /PRIMARY KEY/i.test(c), unique: /\bUNIQUE\b/i.test(c), fk: fk ? fk[1] : null };
        });
        out.push({ name: m[1], db, app, file: f, line: lineOf(sql, m.index), columns });
      }
    }
  }
  return out;
}

function chunks(file) {
  const text = read(file);
  const re = /^(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\b[^=\n]*=)|^(\w+)\.(get|post|put|delete|patch|on)\(/gm;
  const marks = [...text.matchAll(re)].map((m) => ({ idx: m.index, name: m[1] || m[2] || null, route: !!m[3] }));
  return marks.map((m, i) => ({ ...m, text: text.slice(m.idx, marks[i + 1]?.idx ?? text.length), line: lineOf(text, m.idx) }));
}

function sqlUse(text, tableNames) {
  const reads = new Set(), writes = new Set();
  const add = (set, t) => tableNames.has(t) && set.add(t);
  for (const m of text.matchAll(/\b(?:FROM|JOIN)\s+(\w+)/g)) add(reads, m[1]);
  for (const m of text.matchAll(/\bINSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/g)) add(writes, m[1]);
  for (const m of text.matchAll(/\bUPDATE\s+(\w+)\s+SET/g)) add(writes, m[1]);
  for (const m of text.matchAll(/\bDELETE\s+FROM\s+(\w+)/g)) add(writes, m[1]);
  return { reads, writes };
}

function apiEndpoints(tableNames) {
  const files = walk('apps/api/src', (p) => p.endsWith('.ts'));
  const all = files.flatMap((f) => chunks(f).map((c) => ({ ...c, file: f })));
  const named = new Map(all.filter((c) => c.name).map((c) => [c.name, c]));
  const middleware = new Set(['requireAuth', 'requireHandle']);
  const expand = (chunk) => {
    const seen = new Set();
    const queue = [chunk];
    while (queue.length) {
      const c = queue.pop();
      if (seen.has(c)) continue;
      seen.add(c);
      for (const [n, target] of named) if (!middleware.has(n) && target !== c && new RegExp(`\\b${n}\\(`).test(c.text)) queue.push(target);
    }
    return [...seen];
  };
  const eps = [];
  for (const c of all.filter((x) => x.route)) {
    const head = c.text.match(/^(\w+)\.(get|post|put|delete|patch|on)\(\s*(\[[^\]]*\]\s*,\s*)?'([^']+)'((?:\s*,\s*\w+)*)/);
    if (!head) continue;
    const methods = head[3] ? [...head[3].matchAll(/'(\w+)'/g)].map((m) => m[1]) : [head[2].toUpperCase()];
    const mws = [...head[5].matchAll(/\w+/g)].map((m) => m[0]);
    const params = Object.fromEntries([...c.text.matchAll(/const\s+(\w+)\s*=\s*c\.req\.param\('(\w+)'\)/g)].map((m) => [m[2], m[1]]));
    const path = head[4].replace(/\/:(\w+)\{@[^}]*\}/, (_, p) => `/@:${params[p] || p}`).replace(/\{[^}]*\}/g, '');
    const parts = expand(c);
    const text = parts.map((p) => p.text).join('\n');
    const reads = new Set(), writes = new Set();
    for (const p of parts) { const u = sqlUse(p.text, tableNames); u.reads.forEach((t) => reads.add(t)); u.writes.forEach((t) => writes.add(t)); }
    const r2 = [...new Set([...text.matchAll(/\bMEDIA\.(get|put|delete|head)\(/g)].map((m) => m[1]))];
    for (const method of methods) {
      eps.push({
        method, path, file: c.file, line: c.line,
        kind: path.startsWith('/v1/') ? 'api' : 'page',
        auth: mws.includes('requireAuth'), needsHandle: mws.includes('requireHandle'),
        reads: [...reads].filter((t) => !writes.has(t)), writes: [...writes], tables: [...new Set([...reads, ...writes])],
        r2, bodyFields: [...new Set([...c.text.matchAll(/\bbody\.(\w+)/g)].map((m) => m[1]))],
        og: /layout\(/.test(text) && /og:image/.test(parts.map((p) => p.text).join('') + read('apps/api/src/pages.ts')) && /layout\(/.test(c.text),
        twitter: /layout\(/.test(c.text) && /twitter:card/.test(read('apps/api/src/pages.ts')),
        text, app: 'api',
      });
    }
  }
  return eps;
}

function siteEndpoints(tableNames) {
  const file = 'apps/site/src/worker.js';
  const text = read(file);
  const fns = new Map(chunks(file).filter((c) => c.name).map((c) => [c.name, c]));
  const eps = [];
  const re = /if \(pathname === "([^"]+)"\) \{([\s\S]*?)(?=\n\s*if \(pathname|\n\s*if \(pathname\.startsWith)/g;
  for (const m of text.matchAll(re)) {
    for (const mm of m[2].matchAll(/request\.method === "(\w+)"\)\s*return\s+(\w+)\(/g)) {
      const fn = fns.get(mm[2]);
      const u = sqlUse(fn?.text ?? '', tableNames);
      eps.push({
        method: mm[1], path: m[1], file, line: lineOf(text, m.index), kind: 'api', auth: false, needsHandle: false,
        reads: [...u.reads].filter((t) => !u.writes.has(t)), writes: [...u.writes], tables: [...new Set([...u.reads, ...u.writes])],
        r2: [], bodyFields: [...new Set([...(fn?.text ?? '').matchAll(/\bbody\.(\w+)/g)].map((x) => x[1]))], og: false, twitter: false,
        text: fn?.text ?? '', app: 'site',
      });
    }
  }
  return eps;
}

function clientMethods() {
  const file = 'apps/mobile/src/lib/http.ts';
  const text = read(file);
  const start = text.indexOf('export const http');
  const body = text.slice(start);
  const ifaceText = read('apps/mobile/src/lib/types.ts');
  const iface = ifaceText.slice(ifaceText.indexOf('interface Backend'));
  const mockNames = new Set([...read('apps/mobile/src/lib/mock.ts').matchAll(/^\s{2}(?:async\s+)?(\w+)\s*(?::|\()/gm)].map((m) => m[1]));
  const marks = [...body.matchAll(/^ {2}(\w+):/gm)];
  const out = {};
  marks.forEach((m, i) => {
    const block = body.slice(m.index, marks[i + 1]?.index ?? body.length);
    const calls = [];
    for (const s of block.matchAll(/send(?:<[\s\S]*?>)?\(\s*"(\w+)",\s*[`"](\/[^`"?$]*)((?:\$\{encodeURIComponent\((\w+)\)\}[^`"?$]*)?)/g)) {
      calls.push({ method: s[1], path: s[2] + (s[4] ? `:${s[4]}` : '') });
    }
    if (/method:\s*"PUT"/.test(block) && calls[0]) calls.push({ method: 'PUT', path: `${calls[0].path}/:id` });
    const lit = block.match(/send(?:<[\s\S]*?>)?\(\s*"[A-Z]+",\s*[^,]+,\s*\{([^}]*)\}/);
    let fields = lit ? lit[1].split(',').map((x) => x.trim().split(':')[0].trim()).filter(Boolean) : null;
    if (!fields && /send(?:<[\s\S]*?>)?\([^)]*,\s*input\b/.test(block)) {
      const sig = iface.match(new RegExp(`${m[1]}\\(input:\\s*\\{([^}]*)\\}`));
      fields = sig ? sig[1].split(';').map((x) => x.trim().split(/[?:]/)[0].trim()).filter(Boolean) : [];
    }
    out[m[1]] = { name: m[1], calls, fields: fields ?? [], mock: mockNames.has(m[1]), file, line: lineOf(text, start + m.index) };
  });
  return out;
}

function screens(client) {
  const base = 'apps/mobile/src/app';
  const files = walk(base, (p) => /\.tsx$/.test(p));
  const layoutText = read(`${base}/_layout.tsx`);
  const access = {};
  for (const m of layoutText.matchAll(/<Stack\.Protected guard=\{([^}]*)\}>([\s\S]*?)<\/Stack\.Protected>/g)) {
    const who = /!==\s*"in"/.test(m[1]) ? 'signed out' : /===\s*"in"/.test(m[1]) ? 'signed in' : 'conditional';
    for (const s of m[2].matchAll(/name="([^"]+)"/g)) access[s[1].replace(/\/index$/, '')] = who;
  }
  const resolveImport = (from, spec) => {
    let p = null;
    if (spec.startsWith('@/')) p = `apps/mobile/src/${spec.slice(2)}`;
    else if (spec.startsWith('.')) p = join(dirname(from), spec);
    if (!p) return null;
    p = relative(root, join(root, p));
    return ['.tsx', '.ts', '/index.tsx', '/index.ts'].map((e) => p + e).find((x) => existsSync(R(x))) ?? null;
  };
  const follow = (file, isRoot) => {
    const seen = new Map();
    const queue = [file];
    while (queue.length) {
      const f = queue.pop();
      if (seen.has(f)) continue;
      const t = read(f);
      seen.set(f, t);
      for (const m of t.matchAll(/from\s+"([^"]+)"/g)) {
        const r = resolveImport(f, m[1]);
        if (!r || /lib\/(api|mock|http|config|types|theme|brand|storage|format)\.ts$/.test(r)) continue;
        if (/\/src\/state\//.test(r) && !isRoot) continue;
        if (/\/src\/app\//.test(r)) continue;
        queue.push(r);
      }
    }
    return seen;
  };
  const out = [];
  for (const f of files) {
    const name = f.slice(base.length + 1).replace(/\.tsx$/, '');
    if (name.endsWith('_layout') && name !== '_layout') continue;
    const isShell = name === '_layout';
    let route = '/' + name.replace(/\(\w+\)\//g, '').replace(/\/index$/, '').replace(/^index$/, '').replace(/\[(\w+)\]/g, ':$1');
    if (route === '/') route = '/';
    const group = (name.match(/^\((\w+)\)/) || [])[1];
    const srcs = follow(f, isShell);
    const all = [...srcs.values()].join('\n');
    const apiCalls = [...new Set([...all.matchAll(/\bapi\.(\w+)\(/g)].map((m) => m[1]))];
    if (/\bsignOut\b/.test(read(f)) && !apiCalls.includes('logout') && client.logout) apiCalls.push('logout');
    const notes = [];
    const w = read('apps/mobile/src/lib/layout.ts').match(/width\s*>=\s*(\d+)/)?.[1];
    if (/useLayout\(/.test(all) || /tabBarPosition/.test(all)) notes.push({ platform: 'web', text: `wide layout at >= ${w}px${/tabBarPosition:\s*wide\s*\?\s*"left"/.test(read(`${base}/(tabs)/_layout.tsx`)) && group === 'tabs' ? ', tabs become a left sidebar' : ''}` });
    if (/Platform\.OS\s*===\s*"web"/.test(all) && /shareLink/.test(all)) notes.push({ platform: 'web', text: 'share copies the link' });
    if (/Platform\.OS\s*!==\s*"web"/.test(all) && /shareLink/.test(all)) notes.push({ platform: 'ios', text: 'share opens the native share sheet' }, { platform: 'android', text: 'share opens the native share sheet' });
    if (/KeyboardAvoidingView/.test(all) && /Platform\.OS\s*===\s*"ios"/.test(all)) notes.push({ platform: 'ios', text: 'keyboard-avoiding padding' });
    const nav = [...new Set([...read(f).matchAll(/(?:pathname:|router\.(?:push|replace)\(|href=)\s*\{?\s*"(\/[^"]*)"/g)].map((m) => m[1].replace(/\[(\w+)\]/g, ':$1')))];
    out.push({
      surface: 'app', route: isShell ? 'shell' : route, file: f, group: group ?? null, shell: isShell,
      access: access[name.replace(/\/index$/, '')] ?? access[group ? `(${group})` : name] ?? (isShell ? 'always' : 'any'),
      notes, apiCalls, nav, text: all.toLowerCase(),
    });
  }
  const site = 'apps/site/src/index.template.html';
  const st = read(site);
  out.push({
    surface: 'site', route: '/', file: site, group: null, shell: false, access: 'public',
    notes: [{ platform: 'browser', text: 'plain HTML, any browser' }],
    apiCalls: [], siteCalls: [...new Set([...st.matchAll(/fetch\("(\/[^"]+)"(?:,\s*\{method:"(\w+)")?/g)].map((m) => `${m[2] || 'GET'} ${m[1]}`))],
    nav: [], text: st.toLowerCase(),
  });
  return out;
}

function lexicons() {
  const files = walk('lexicons', (p) => p.endsWith('.json'));
  const keys = (o, acc = new Set()) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'properties') Object.keys(v).forEach((x) => acc.add(x)); keys(v, acc); } return acc; };
  const refs = (o, acc = new Set()) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'ref' && typeof v === 'string') acc.add(v.split('#')[0]); if (k === 'refs') v.forEach((x) => acc.add(x.split('#')[0])); refs(v, acc); } return acc; };
  return files.map((f) => {
    const j = JSON.parse(read(f));
    const main = j.defs?.main ?? {};
    return { id: j.id, file: f, type: main.type ?? 'defs', description: main.description ?? '', fields: [...keys(j)], refs: [...refs(j)].filter((x) => x && x !== j.id && !x.startsWith('com.atproto') || x?.startsWith('com.atproto')) };
  });
}

function environments() {
  const claude = read('CLAUDE.md');
  const sec = claude.split(/^## Environments/m)[1]?.split(/^## /m)[0] ?? '';
  const rows = sec.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*(Env|---)/.test(l)).map((l) => l.split('|').slice(1, -1).map((x) => x.trim()));
  const ports = Object.fromEntries([...claude.matchAll(/(agora(?:-[\w-]+)?)[\s ]+(\d{4,5})/g)].map((m) => [m[1], m[2]]));
  const wr = { api: stripJsonc(read('apps/api/wrangler.jsonc')), site: stripJsonc(read('apps/site/wrangler.jsonc')) };
  const pick = (cfg, env) => (env === 'local' ? cfg : cfg.env?.[env] ?? {});
  return rows.map(([env, api, site, data]) => {
    const key = env.toLowerCase().replace('production', 'production');
    const k = key === 'local' ? 'local' : key;
    const urls = (cell) => [...cell.matchAll(/https?:\/\/[^\s,)]+/g)].map((m) => m[0]);
    const svc = (app, cell) => {
      const cfg = pick(wr[app], k);
      return {
        app, urls: urls(cell), note: (cell.match(/\(([^)]*)\)/) || [])[1] ?? null,
        worker: cfg.name ?? wr[app].name,
        d1: (cfg.d1_databases ?? wr[app].d1_databases ?? [])[0]?.database_name ?? null,
        r2: (cfg.r2_buckets ?? (k === 'local' ? wr[app].r2_buckets : []) ?? []).map((b) => b.bucket_name),
        routes: (cfg.routes ?? []).map((r) => r.pattern),
        invitesRequired: cfg.vars?.INVITES_REQUIRED ?? wr[app].vars?.INVITES_REQUIRED ?? null,
      };
    };
    const deployed = !/not deployed/i.test(api);
    return { env: k, deployed, services: [svc('api', api), svc('site', site)], data, appWeb: k === 'local' && ports['agora-app'] ? [`http://agora-app.localhost:${ports['agora-app']}`] : [] };
  });
}

function git() {
  const run = (c) => { try { return execSync(c, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
  return { sha: run('git rev-parse --short HEAD') || 'none', dirty: !!run('git status --porcelain -- apps lexicons docs/stories.yaml tools'), branch: run('git rev-parse --abbrev-ref HEAD') };
}

const normPath = (p) => p.replace(/\[(\w+)\]/g, ':$1');

function evaluate(stories, atlas) {
  const epKey = (e) => `${e.method} ${e.path}`;
  const eps = new Map(atlas.endpoints.map((e) => [epKey(e), e]));
  const scr = new Map(atlas.screens.map((s) => [`${s.surface}:${s.route}`, s]));
  const methodByEp = new Map();
  for (const m of Object.values(atlas.client)) for (const c of m.calls) methodByEp.set(`${c.method} ${c.path}`, m);
  const missing = new Map();
  const bump = (key, kind, label, story, step) => {
    if (!missing.has(key)) missing.set(key, { key, kind, label, stories: new Set(), steps: [] });
    const m = missing.get(key);
    m.stories.add(story.id);
    m.steps.push(`${story.id}#${step}`);
  };
  return stories.map((st) => {
    let score = 0, counted = 0;
    const steps = st.steps.map((s, i) => {
      const surface = s.site ? 'site' : 'app';
      const routeRef = s.screen ?? s.site;
      const screen = routeRef ? scr.get(`${surface}:${normPath(routeRef)}`) : null;
      const ep = s.endpoint ? eps.get(s.endpoint.replace(/\s+/g, ' ').trim()) : null;
      const problems = [];
      let screenState = routeRef ? (screen ? 'ok' : 'missing') : null;
      let epState = s.endpoint ? (ep ? 'ok' : 'missing') : null;
      if (routeRef && !screen) bump(`screen:${surface}:${routeRef}`, 'screen', `screen ${routeRef}`, st, i);
      if (s.endpoint && !ep) bump(`endpoint:${s.endpoint}`, 'endpoint', `endpoint ${s.endpoint}`, st, i);
      if (screen && ep && screen.apiCalls.length + (screen.siteCalls?.length ?? 0) >= 0 && !s.server) {
        const m = methodByEp.get(epKey(ep));
        const wired = screen.surface === 'site' ? screen.siteCalls.includes(epKey(ep)) : m && screen.apiCalls.includes(m.name);
        if (!wired) { problems.push(`${routeRef} never calls ${s.endpoint}`); bump(`wire:${routeRef}>${s.endpoint}`, 'wiring', `${routeRef} calling ${s.endpoint}`, st, i); epState = 'unwired'; }
      }
      for (const x of s.expect ?? []) {
        let ok = true, label = x;
        if (x === 'auth') ok = !ep || ep.auth;
        else if (x === 'public') ok = !ep || !ep.auth;
        else if (x.startsWith('table:')) ok = !ep || ep.tables.includes(x.slice(6));
        else if (x === 'r2') ok = !ep || ep.r2.length > 0;
        else if (x === 'og') { ok = !ep || (ep.og && ep.twitter); label = 'og and twitter tags'; }
        else if (x.startsWith('shows:')) { ok = !screen || screen.text.includes(x.slice(6).toLowerCase()); label = `screen shows "${x.slice(6)}"`; }
        else if (x.startsWith('contains:')) { ok = !ep || ep.text.toLowerCase().includes(x.slice(9).toLowerCase()); label = `"${x.slice(9)}" in the response`; }
        else if (x.startsWith('sends:')) {
          const f = x.slice(6);
          const m = ep && methodByEp.get(epKey(ep));
          ok = !ep || !m || (m.fields.includes(f) && ep.bodyFields.includes(f));
          label = `${f} sent by the app and read by the API`;
        }
        if (!ok) { problems.push(`missing: ${label}`); bump(`expect:${s.endpoint ?? routeRef}:${x}`, 'detail', `${label} on ${s.endpoint ?? routeRef}`, st, i); }
      }
      let status;
      const named = [screenState, epState].filter(Boolean);
      if (!named.length) status = 'human';
      else if (named.every((x) => x === 'ok') && !problems.length) status = 'built';
      else if (named.every((x) => x === 'missing')) status = 'missing';
      else status = 'partial';
      if (status === 'human') problems.length = 0;
      if (status !== 'human') { counted++; score += status === 'built' ? 1 : status === 'partial' ? 0.5 : 0; }
      return { ...s, i, status, screenState, epState, problems, data: ep ? { tables: ep.tables, r2: ep.r2 } : { tables: [], r2: [] }, platforms: s.platforms ?? ['ios', 'android', 'web'] };
    });
    const coverage = counted ? Math.round((score / counted) * 100) : 100;
    const platforms = [...new Set(steps.flatMap((s) => s.platforms))];
    return { id: st.id, title: st.title, actor: st.actor, goal: st.goal, planned: !!st.planned, note: st.note ?? null, platforms, steps, coverage, built: steps.filter((s) => s.status === 'built').length, counted };
  }).concat([{ _missing: [...missing.values()].map((m) => ({ ...m, stories: [...m.stories], blocks: m.stories.size })).sort((a, b) => b.blocks - a.blocks || a.label.localeCompare(b.label)) }]);
}

function build() {
  const tbl = tables();
  const names = new Set(tbl.map((t) => t.name));
  const endpoints = [...apiEndpoints(names), ...siteEndpoints(names)];
  const client = clientMethods();
  const scr = screens(client);
  const lex = lexicons();
  const lexLinks = [];
  const camel = (s) => s.replace(/_(\w)/g, (_, c) => c.toUpperCase());
  for (const l of lex.filter((x) => x.type === 'record')) {
    const last = l.id.split('.').pop();
    for (const t of tbl.filter((x) => x.app === 'api')) {
      const overlap = t.columns.filter((c) => l.fields.includes(camel(c.name))).length;
      if (t.name === `${last}s` || t.name === last || overlap >= 2) lexLinks.push({ lexicon: l.id, table: t.name, overlap });
    }
  }
  const atlas = { screens: scr.map(({ text, ...s }) => ({ ...s, _text: undefined, text })), endpoints, tables: tbl, lexicons: lex, lexLinks, client, environments: environments() };
  const storiesRaw = YAML.parse(read('docs/stories.yaml'));
  const ev = evaluate(storiesRaw, atlas);
  const missingPieces = ev.pop()._missing;
  const stories = ev;
  const used = { eps: new Set(), screens: new Set(), tables: new Set() };
  for (const s of stories) for (const st of s.steps) {
    if (st.endpoint) used.eps.add(st.endpoint);
    const sr = st.screen ?? st.site;
    if (sr) used.screens.add(`${st.site ? 'site' : 'app'}:${normPath(sr)}`);
    st.data.tables.forEach((t) => used.tables.add(t));
  }
  const edges = [];
  const mByCall = new Map();
  for (const m of Object.values(client)) for (const c of m.calls) mByCall.set(`${c.method} ${c.path}`, m.name);
  for (const s of scr) {
    const id = `screen:${s.surface}:${s.route}`;
    for (const name of s.apiCalls) for (const c of client[name]?.calls ?? []) if (eps(endpoints, c)) edges.push({ from: id, to: `ep:${c.method} ${c.path}`, kind: 'calls' });
    for (const c of s.siteCalls ?? []) if (endpoints.some((e) => `${e.method} ${e.path}` === c)) edges.push({ from: id, to: `ep:${c}`, kind: 'calls' });
    for (const n of s.nav) if (scr.some((x) => x.route === n && x.surface === 'app')) edges.push({ from: id, to: `screen:app:${n}`, kind: 'navigates' });
  }
  for (const e of endpoints) {
    const id = `ep:${e.method} ${e.path}`;
    for (const t of e.reads) edges.push({ from: id, to: `table:${t}`, kind: 'reads' });
    for (const t of e.writes) edges.push({ from: id, to: `table:${t}`, kind: 'writes' });
    if (e.r2.length) edges.push({ from: id, to: 'r2:MEDIA', kind: e.r2.includes('put') || e.r2.includes('delete') ? 'writes' : 'reads' });
  }
  for (const l of lexLinks) edges.push({ from: `table:${l.table}`, to: `lex:${l.lexicon}`, kind: 'mirrors' });
  for (const l of lex) for (const r of l.refs) if (lex.some((x) => x.id === r)) edges.push({ from: `lex:${l.id}`, to: `lex:${r}`, kind: 'refs' });

  const drift = [];
  for (const m of Object.values(client)) for (const c of m.calls.slice(0, 1).filter((x) => ['POST', 'PUT', 'PATCH'].includes(x.method))) {
    const ep = endpoints.find((e) => e.method === c.method && e.path === c.path);
    if (!ep || ep.bodyFields.length === 0 && m.fields.length === 0) continue;
    const unread = m.fields.filter((f) => !ep.bodyFields.includes(f));
    const unsent = ep.bodyFields.filter((f) => !m.fields.includes(f));
    if (unread.length || unsent.length) drift.push({ method: m.name, endpoint: `${c.method} ${c.path}`, sentButIgnored: unread, readButNeverSent: unsent, file: m.file, line: m.line });
  }
  const unmapped = {
    endpoints: endpoints.filter((e) => !used.eps.has(`${e.method} ${e.path}`)).map((e) => `${e.method} ${e.path}`),
    screens: scr.filter((s) => !s.shell && !used.screens.has(`${s.surface}:${s.route}`)).map((s) => s.route),
    tables: tbl.filter((t) => !used.tables.has(t.name)).map((t) => t.name),
  };
  const overall = stories.length ? Math.round(stories.reduce((a, s) => a + s.coverage, 0) / stories.length) : 0;
  const stepsCounted = stories.reduce((a, s) => a + s.counted, 0);
  const stepsBuilt = stories.reduce((a, s) => a + s.built, 0);
  let platforms = null;
  if (existsSync(R('data/platforms.json'))) { try { platforms = JSON.parse(read('data/platforms.json')); } catch { platforms = { error: 'data/platforms.json is not valid JSON' }; } }
  const shots = loadShots(scr);
  const feats = features(atlas, stories);
  const slim = (e) => { const { text, ...rest } = e; return rest; };
  const out = {
    builtAt: new Date().toISOString(), git: git(),
    summary: { screens: scr.length, endpoints: endpoints.length, tables: tbl.length, lexicons: lex.length, stories: stories.length, edges: edges.length, coverage: overall, stepsBuilt, stepsCounted },
    screens: scr.map(({ text, ...s }) => s), endpoints: endpoints.map(slim), tables: tbl, lexicons: lex, client, environments: atlas.environments,
    edges, stories, missing: missingPieces, drift, unmapped, platforms, shots, features: feats,
  };
  mkdirSync(R('data'), { recursive: true });
  writeFileSync(R('data/atlas.json'), JSON.stringify(out, null, 1) + '\n');
  return out;
}

function loadShots(screens) {
  const f = 'data/atlas-shots/index.json';
  if (!existsSync(R(f))) return null;
  let idx;
  try { idx = JSON.parse(read(f)); } catch { return null; }
  for (const s of screens) {
    const e = idx.screens?.[`${s.surface}:${s.route}`];
    s.shots = e?.shots ?? {};
    s.states = e?.states ?? [];
    s.slug = e?.slug ?? null;
    s.forwardsTo = e?.forwardsTo ?? null;
  }
  const now = codeHash(root);
  const missing = screens.filter((s) => !s.shell && !Object.keys(s.shots).length).map((s) => `${s.surface}:${s.route}`);
  const runsFile = R('data/atlas-shots/runs.jsonl');
  const runs = existsSync(runsFile) ? readFileSync(runsFile, 'utf8').split('\n').filter(Boolean).slice(-40).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
  return { pages: idx.pages ?? {}, capturedAt: idx.capturedAt, git: idx.git, count: idx.count, ms: idx.ms ?? null, phases: idx.phases ?? [], by: idx.by ?? null, why: idx.why ?? null, themeSwitch: idx.themeSwitch, themes: idx.themes, params: idx.params, failed: idx.failed ?? [], shell: idx.shell ?? [], missing, codeHash: idx.codeHash ?? null, codeHashNow: now, stale: idx.codeHash !== now, runs };
}

function features(atlas, stories) {
  const file = process.env.ATLAS_FEATURES || R('docs/features.yaml');
  if (!existsSync(file)) return null;
  let raw;
  try { raw = YAML.parse(readFileSync(file, 'utf8')); } catch (e) { return { error: `docs/features.yaml is not valid YAML: ${String(e.message).split('\n')[0]}` }; }
  const scr = new Map(atlas.screens.map((s) => [`${s.surface}:${s.route}`, s]));
  const eps = new Set(atlas.endpoints.map((e) => `${e.method} ${e.path}`));
  const sto = new Set(stories.map((s) => s.id));
  const items = (raw?.features ?? []).map((f) => {
    const m = f.emera?.maps_to ?? {};
    const screens = (m.screens ?? []).map((r) => {
      const site = /^site[\s:]/.test(r);
      const route = normPath(r.replace(/^(app|site)[\s:]\s*/, ''));
      return { ref: r, ok: scr.has(`${site ? 'site' : 'app'}:${route}`), key: `${site ? 'site' : 'app'}:${route}` };
    });
    const endpoints = (m.endpoints ?? []).map((e) => ({ ref: e, ok: eps.has(e.replace(/\s+/g, ' ').trim()) }));
    const st = (m.stories ?? []).map((id) => ({ ref: id, ok: sto.has(id) }));
    const code = [...screens, ...endpoints];
    let status;
    if (code.length) status = code.every((x) => x.ok) ? 'built' : code.some((x) => x.ok) ? 'partial' : st.some((x) => x.ok) ? 'partial' : 'not built';
    else status = st.some((x) => x.ok) ? 'partial' : 'not built';
    return { ...f, status, mapped: { screens, endpoints, stories: st } };
  });
  const pts = (list) => list.length ? Math.round((list.reduce((a, f) => a + (f.status === 'built' ? 1 : f.status === 'partial' ? 0.5 : 0), 0) / list.length) * 100) : 0;
  const core = items.filter((f) => f.tier === 'core');
  const count = (list) => ({ built: list.filter((f) => f.status === 'built').length, partial: list.filter((f) => f.status === 'partial').length, missing: list.filter((f) => f.status === 'not built').length, total: list.length });
  return { platforms: raw?.platforms ?? [], items, coverage: { core: pts(core), all: pts(items), coreCounts: count(core), allCounts: count(items) } };
}

function eps(list, c) { return list.some((e) => e.method === c.method && e.path === c.path); }

function print(o) {
  const s = o.summary;
  console.log(`ATLAS built from ${o.git.sha}${o.git.dirty ? '+dirty' : ''}`);
  console.log(`  ${s.screens} screens, ${s.endpoints} endpoints, ${s.tables} tables, ${s.lexicons} lexicons, ${s.edges} edges`);
  console.log(`  ${s.stories} stories, ${s.stepsBuilt}/${s.stepsCounted} steps built, coverage ${s.coverage}%`);
  for (const st of o.stories) console.log(`    ${String(st.coverage).padStart(3)}%  ${st.id}`);
  console.log('  missing, by stories blocked:');
  for (const m of o.missing.slice(0, 8)) console.log(`    ${m.blocks}  ${m.label}`);
  console.log(`  drift: ${o.drift.length}  unmapped: ${o.unmapped.endpoints.length} endpoints, ${o.unmapped.screens.length} screens, ${o.unmapped.tables.length} tables`);
  const pl = Array.isArray(o.platforms) ? o.platforms : o.platforms?.items ?? o.platforms?.platforms;
  console.log(`  screenshots: ${o.shots ? `${o.shots.count} images, ${o.shots.missing.length} screens without a capture${o.shots.stale ? ', older than the code' : ''}` : 'none yet, run node tools/atlas/shots.mjs'}`);
  console.log(`  features: ${o.features ? (o.features.error ?? `${o.features.items.length} rows, core coverage ${o.features.coverage.core}%`) : 'waiting for docs/features.yaml'}`);
  console.log(`  platforms: ${pl ? `${pl.filter((p) => p.status === 'live').length} of ${pl.length} live` : 'waiting for data/platforms.json'}`);
}

function once() {
  try { print(build()); } catch (e) { console.error(`ATLAS build failed: ${e.stack}`); process.exitCode = 1; }
}

once();
if (process.argv.includes('--watch')) {
  let t;
  const kick = (_, f) => {
    if (!f || SKIP.test(f) || /atlas\.json$/.test(f)) return;
    clearTimeout(t);
    t = setTimeout(() => spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { stdio: 'inherit' }), 300);
  };
  for (const p of ['apps', 'lexicons', 'docs/stories.yaml', 'docs/features.yaml', 'data/platforms.json', 'data/atlas-shots/index.json', 'tools/atlas/build.mjs', 'CLAUDE.md']) if (existsSync(R(p))) watch(R(p), { recursive: true }, kick);
  console.log('ATLAS watching apps/, lexicons/, docs/stories.yaml, data/platforms.json');
}
