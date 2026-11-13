#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://emera.social';
const PROP = 'sc-domain:emera.social';
const STATE = join(ROOT, 'content/index-state.json');
const args = process.argv.slice(2);
const ALL = args.includes('--all');
const NO_INSPECT = args.includes('--no-inspect');
if (args.includes('--help')) {
  console.log(`scripts/index.mjs - tell search engines about emera.social and report what Google has indexed

  1. reads the live sitemap, checks every URL answers 200
  2. IndexNow (Bing, Yandex, Seznam, Naver; ChatGPT search reads Bing): posts URLs whose lastmod changed since the last run
  3. Search Console: resubmits the sitemap
  4. Search Console URL Inspection: coverage + last crawl per URL

  --all          post every URL to IndexNow, not only changed ones
  --no-inspect   skip step 4
State: content/index-state.json`);
  process.exit(0);
}

const sh = (cmd, a) => { try { return execFileSync(cmd, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { submitted: {}, inspected: {} };

const sm = await fetch(`${SITE}/sitemap.xml`, { headers: { 'x-tg-tester': '1' } });
if (!sm.ok) throw new Error(`sitemap ${sm.status}`);
const urls = [...(await sm.text()).matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map(([, loc, lastmod]) => ({ loc, lastmod }));
console.log(`sitemap: ${urls.length} urls`);

const http = await Promise.all(urls.map(async (u) => {
  const r = await fetch(u.loc, { headers: { 'x-tg-tester': '1' }, redirect: 'manual' });
  return [u.loc, r.status];
}));
const status = new Map(http);
const broken = http.filter(([, s]) => s !== 200);
if (broken.length) console.log(`NOT 200: ${broken.map(([u, s]) => `${s} ${u}`).join(', ')}`);

const keyFile = readdirSync(join(ROOT, 'public')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
const key = keyFile.replace('.txt', '');
const fresh = urls.filter((u) => status.get(u.loc) === 200 && (ALL || state.submitted[u.loc] !== u.lastmod));
if (fresh.length) {
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: 'emera.social', key, keyLocation: `${SITE}/${keyFile}`, urlList: fresh.map((u) => u.loc) }),
  });
  console.log(`IndexNow: ${fresh.length} urls posted, HTTP ${r.status}${r.ok ? '' : ` ${await r.text()}`}`);
  if (r.ok) for (const u of fresh) state.submitted[u.loc] = u.lastmod;
} else console.log('IndexNow: nothing changed since last run (--all to force)');

const token = process.env.GSC_TOKEN || sh('gcloud', ['auth', 'application-default', 'print-access-token']);
const adc = (() => { try { return JSON.parse(readFileSync(join(homedir(), '.config/gcloud/application_default_credentials.json'), 'utf8')).quota_project_id; } catch { return ''; } })();
const project = adc || 'creators-of-today-auth';
const gsc = (url, init = {}) => fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, 'x-goog-user-project': project, 'content-type': 'application/json', ...(init.headers || {}) } });

if (!token) console.log('BLOCKED: no Google token. Run: gcloud auth application-default login --scopes=https://www.googleapis.com/auth/webmasters,https://www.googleapis.com/auth/cloud-platform');
else {
  const put = await gsc(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(PROP)}/sitemaps/${encodeURIComponent(`${SITE}/sitemap.xml`)}`, { method: 'PUT' });
  console.log(`Search Console sitemap resubmit: HTTP ${put.status}${put.ok ? '' : ` ${(await put.text()).slice(0, 200)}`}`);

  if (!NO_INSPECT) {
    const rows = [];
    for (const u of urls) {
      const r = await gsc('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { method: 'POST', body: JSON.stringify({ inspectionUrl: u.loc, siteUrl: PROP }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { rows.push({ url: u.loc, coverage: `error ${r.status} ${j.error?.message || ''}`.trim() }); if (r.status === 429) break; continue; }
      const x = j.inspectionResult?.indexStatusResult || {};
      rows.push({ url: u.loc, verdict: x.verdict, coverage: x.coverageState, crawled: x.lastCrawlTime?.slice(0, 10) || '-' });
    }
    const indexed = rows.filter((r) => r.verdict === 'PASS').length;
    console.log(`\nGoogle index: ${indexed}/${rows.length} indexed`);
    const w = Math.max(...rows.map((r) => r.url.length - SITE.length));
    for (const r of rows) console.log(`${(r.verdict === 'PASS' ? 'IN ' : 'OUT')}  ${r.url.replace(SITE, '').padEnd(w)}  ${r.crawled || '-'}  ${r.coverage || ''}`);
    state.inspected = Object.fromEntries(rows.map((r) => [r.url, { verdict: r.verdict, coverage: r.coverage, crawled: r.crawled, at: new Date().toISOString() }]));
  }
}

state.ranAt = new Date().toISOString();
writeFileSync(STATE, JSON.stringify(state, null, 1) + '\n');
