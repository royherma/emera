#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process';
import { appendFileSync, createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { codeHash } from './codehash.mjs';
import { capturePages } from './pages.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const R = (...p) => join(root, ...p);
const PORT = 5040;
const PW = process.env.PLAYWRIGHT_CORE || 'playwright-core';
const { chromium } = createRequire(import.meta.url)(PW);

const VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.map': 'application/json' };
const slugOf = (s) => (s.surface === 'site' ? 'site-' : '') + (s.route === '/' ? 'home' : s.route.replace(/^\//, '').replace(/[/:]+/g, '-'));
const log = (m) => console.log(`SHOTS ${m}`);
const BY = process.env.ATLAS_SHOTS_BY || 'terminal';
const WHY = process.env.ATLAS_SHOTS_WHY || 'run by hand';
const T0 = Date.now();
const phases = [];
let lap = T0;
const phase = (name) => { const now = Date.now(); phases.push({ name, ms: now - lap }); lap = now; log(`done ${name} in ${((now - T0) / 1000).toFixed(1)}s`); };
const git = () => {
  const run = (c) => { try { return execSync(c, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
  return { sha: run('git rev-parse --short HEAD') || 'none', dirty: !!run('git status --porcelain -- apps/mobile/src apps/site/public') };
};

function serve(dir, port, fallback = true) {
  const server = createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = join(dir, p);
    if (!f.startsWith(dir) || !existsSync(f) || statSync(f).isDirectory()) f = existsSync(join(f, 'index.html')) && p.endsWith('/') ? join(f, 'index.html') : fallback ? join(dir, 'index.html') : null;
    if (!f || !existsSync(f)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
    createReadStream(f).pipe(res);
  });
  return new Promise((ok, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', () => ok(server)); });
}

function exportApp(out) {
  const env = { ...process.env };
  delete env.EXPO_PUBLIC_API_URL;
  delete env.EXPO_PUBLIC_MOCK_INVITES;
  log('exporting the web build (mock mode)');
  const r = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', out], { cwd: R('apps/mobile'), env, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`expo export failed\n${(r.stdout || '').slice(-1500)}\n${(r.stderr || '').slice(-1500)}`);
}

function bundleText(out) {
  const js = join(out, '_expo/static/js/web');
  return existsSync(js) ? readdirSync(js).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(js, f), 'utf8')).join('\n') : '';
}

function mockFacts() {
  const t = readFileSync(R('apps/mobile/src/lib/mock.ts'), 'utf8');
  return {
    invite: t.match(/MOCK_INVITE_CODE\s*=\s*"([^"]+)"/)?.[1] ?? 'DAYLIGHT',
    handle: t.match(/const people[^=]*=\s*\[\s*\[\s*"(\w+)"/)?.[1] ?? 'mina',
    taken: t.match(/const people[^=]*=\s*\[\s*\[\s*"(\w+)"/)?.[1] ?? 'mina',
    postId: (() => { const m = t.match(/const id = `p_\$\{(\d+)\s*\+\s*i\}`/); return m ? `p_${m[1]}` : 'p_100'; })(),
  };
}

const settle = (page, ms = 1300) => page.waitForTimeout(ms);
async function go(page, path) {
  await page.evaluate((p) => { history.pushState(null, '', p); dispatchEvent(new PopStateEvent('popstate', { state: null })); }, path);
  await settle(page);
}

async function run() {
  const tmp = mkdtempSync(join(tmpdir(), 'atlas-shots-'));
  const dist = join(tmp, 'web');
  let appServer, siteServer, index;
  const hash = codeHash(root);
  const g0 = git();
  const runsFile = R('data/atlas-shots/runs.jsonl');
  const record = (extra) => {
    mkdirSync(dirname(runsFile), { recursive: true });
    appendFileSync(runsFile, JSON.stringify({ startedAt: new Date(T0).toISOString(), ms: Date.now() - T0, by: BY, why: WHY, sha: g0.sha, dirty: g0.dirty, codeHash: hash, phases, ...extra }) + '\n');
  };
  log(`start by ${BY}: ${WHY}`);
  try {
    exportApp(dist);
    phase('export web build');
    const bundle = bundleText(dist);
    const themeSwitch = /settings\.theme/.test(bundle);
    const themes = themeSwitch ? ['day', 'night'] : ['day'];
    log(`theme switch ${themeSwitch ? 'found, day and night' : 'not found, day only'}`);

    appServer = await serve(dist, PORT);
    siteServer = await serve(R('apps/site/public'), 0, false);
    const siteUrl = `http://127.0.0.1:${siteServer.address().port}/`;
    const base = `http://127.0.0.1:${PORT}`;

    const atlas = JSON.parse(readFileSync(R('data/atlas.json'), 'utf8'));
    const facts = mockFacts();
    const targets = atlas.screens.filter((s) => !s.shell);
    const forwardsOnly = new Set(targets.filter((s) => s.file && /^\s*return\s*<Redirect\b/m.test(readFileSync(R(s.file), 'utf8')) && !/<(View|Screen|Text)\b/.test(readFileSync(R(s.file), 'utf8'))).map((s) => s.route));
    const shell = atlas.screens.filter((s) => s.shell).map((s) => ({ key: `${s.surface}:${s.route}`, route: s.route, reason: 'no screen of its own, it wraps every route' }));

    const out = R('data/atlas-shots');
    mkdirSync(out, { recursive: true });
    index = { capturedAt: new Date().toISOString(), git: g0, codeHash: hash, by: BY, why: WHY, themeSwitch, viewports: VIEWPORTS, themes, params: {}, screens: {}, shell, failed: [] };
    const entryFor = (s) => (index.screens[`${s.surface}:${s.route}`] ??= { key: `${s.surface}:${s.route}`, slug: slugOf(s), route: s.route, surface: s.surface, access: s.access, shots: {}, states: [] });
    const byRoute = (r) => targets.find((s) => s.surface === 'app' && s.route === r);

    const browser = await chromium.launch({ headless: true });
    const jobs = [];
    for (const theme of themes) for (const vp of Object.keys(VIEWPORTS)) jobs.push((async () => {
      const tag = `${vp}-${theme}`;
      const tagStart = Date.now();
      const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: VIEWPORTS[vp], colorScheme: theme === 'night' ? 'dark' : 'light', deviceScaleFactor: 1, hasTouch: vp === 'phone' });
      if (themeSwitch) await ctx.addInitScript((t) => { try { localStorage.setItem('settings.theme', t); } catch {} }, theme);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => log(`page error (${tag}): ${String(e).slice(0, 120)}`));

      const snap = async (s, name = null, note = null) => {
        const want = new RegExp(`^${s.route.replace(/:\w+/g, '[^/]+')}/?$`);
        const at = new URL(page.url()).pathname;
        const e = entryFor(s);
        if (!want.test(at)) {
          if (!forwardsOnly.has(s.route)) throw new Error(`landed on ${at}, not ${s.route}`);
          e.forwardsTo = at;
        }
        const dir = join(out, e.slug);
        mkdirSync(dir, { recursive: true });
        const file = name ? `${name}-${tag}.png` : `${tag}.png`;
        await page.screenshot({ path: join(dir, file) });
        const rel = `data/atlas-shots/${e.slug}/${file}`;
        if (name) { if (!e.states.some((x) => x.name === name && x.tag === tag)) e.states.push({ name, tag, file: rel, note }); } else e.shots[tag] = rel;
      };
      const attempt = async (label, fn) => {
        try { await fn(); } catch (err) { index.failed.push({ what: `${label} (${tag})`, why: String(err.message ?? err).split('\n')[0].slice(0, 160) }); log(`FAILED ${label} (${tag}): ${String(err.message ?? err).split('\n')[0]}`); }
      };
      const dismiss = async () => {
        await page.getByText('Cancel', { exact: true }).first().click({ timeout: 1500 }).catch(() => {});
        await settle(page, 600);
        if (await page.getByText('Cancel', { exact: true }).first().isVisible().catch(() => false)) {
          await page.mouse.click(4, 4);
          await settle(page, 600);
        }
      };
      const input = (ph) => page.getByPlaceholder(ph, { exact: false }).first();
      const click = (name) => page.getByRole('button', { name }).first().click({ timeout: 4000 });

      await attempt('open app', async () => { await page.goto(`${base}/`, { waitUntil: 'load' }); await settle(page, 2000); });

      const site = targets.find((s) => s.surface === 'site');
      if (site) await attempt('site', async () => {
        const sp = await ctx.newPage();
        await sp.goto(siteUrl, { waitUntil: 'load' });
        await sp.waitForTimeout(1200);
        const e = entryFor(site);
        mkdirSync(join(out, e.slug), { recursive: true });
        await sp.screenshot({ path: join(out, e.slug, `${tag}.png`) });
        e.shots[tag] = `data/atlas-shots/${e.slug}/${tag}.png`;
        await sp.close();
      });

      const home = byRoute('/');
      if (home) await attempt('/', async () => { await go(page, '/'); await snap(home); });
      const welcome = byRoute('/welcome');
      if (welcome) await attempt('/welcome', async () => { await go(page, '/welcome'); await snap(welcome); });
      const inv = byRoute('/invite/:code');
      if (inv) await attempt('/invite/:code', async () => { await go(page, `/invite/${facts.invite}`); await snap(inv); index.params['/invite/:code'] = facts.invite; });

      const signIn = byRoute('/sign-in');
      await attempt('/sign-in', async () => {
        await go(page, '/sign-in');
        if (signIn) await snap(signIn);
        await input('you@').fill('a@b');
        await click(/send my code/i);
        await settle(page, 1200);
        if (signIn) await snap(signIn, 'error', 'a bad email address');
        await input('you@').fill('visitor@example.com');
        await click(/send my code/i);
        await settle(page, 1600);
      });
      const code = byRoute('/code');
      await attempt('/code', async () => {
        if (code) await snap(code);
        await page.keyboard.type('123456', { delay: 60 });
        await settle(page, 2200);
      });
      const handle = byRoute('/handle');
      await attempt('/handle', async () => {
        if (handle) await snap(handle);
        await input('Your name').fill('Visitor Test');
        await input('yourhandle').fill(facts.taken);
        await click(/^(start|finish)$/i);
        await settle(page, 1200);
        if (handle) await snap(handle, 'error', 'a handle that is taken');
        await input('yourhandle').fill('visitor_test');
        await click(/^(start|finish)$/i);
        await settle(page, 2000);
      });

      let postId = facts.postId, postHandle = facts.handle;
      await attempt('read a real post and handle from the feed', async () => {
        await go(page, '/feed');
        const found = await page.evaluate(() => ({
          post: [...document.querySelectorAll('a[href*="/p/"]')].map((a) => a.getAttribute('href').match(/\/p\/([^/?#]+)/)?.[1]).find(Boolean),
          user: [...document.querySelectorAll('a[href*="/u/"]')].map((a) => a.getAttribute('href').match(/\/u\/([^/?#]+)/)?.[1]).find(Boolean),
        }));
        if (found.post) postId = found.post;
        if (found.user) postHandle = found.user;
        index.params['/p/:id'] = postId;
        index.params['/u/:handle'] = postHandle;
      });

      const feed = byRoute('/feed');
      if (feed) await attempt('/feed', async () => {
        await go(page, '/feed');
        await snap(feed);
        await page.getByRole('button', { name: 'More' }).first().click({ timeout: 4000 });
        await settle(page, 700);
        await snap(feed, 'post-menu', 'the "..." menu on a post');
        await dismiss();
      });
      const me = byRoute('/me');
      if (me) await attempt('/me copied', async () => {
        await go(page, '/me');
        await page.getByRole('button', { name: 'Share profile' }).first().click({ timeout: 4000 });
        await page.getByText('Profile link copied').first().waitFor({ timeout: 3000 });
        await page.waitForTimeout(700);
        await snap(me, 'copied', 'Share profile tapped on web, the link is copied');
        await settle(page, 2500);
      });
      for (const [route, path, label] of [['/explore', '/explore'], ['/me', '/me'], ['/settings', '/settings']]) {
        const s = byRoute(route);
        if (s) await attempt(route, async () => { await go(page, path); await snap(s); });
      }
      const up = byRoute('/upload');
      if (up) await attempt('/upload', async () => {
        await go(page, '/upload');
        await snap(up);
        const chooser = page.waitForEvent('filechooser', { timeout: 5000 });
        await page.getByText('Choose photos or video', { exact: true }).first().click({ timeout: 4000 });
        await (await chooser).setFiles([R('brand/content/ceramics.jpg'), R('tools/atlas/fixtures/clip.mp4')]);
        await settle(page, 1500);
        await snap(up, 'picked', 'a photo and a video chosen');
        await page.getByPlaceholder('Tell people about it').first().fill('Glaze test, second firing');
        const posts = page.getByRole('button', { name: /^post$/i });
        const widths = await posts.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
        await posts.nth(widths.indexOf(Math.max(...widths))).click({ timeout: 4000 });
        await page.waitForTimeout(150);
        await snap(up, 'posting', 'the post button while it uploads');
        await page.waitForURL(/\/p\//, { timeout: 15000 });
        await settle(page, 1500);
        const p = byRoute('/p/:id');
        if (p) await snap(p, 'published', 'the post just made');
      });
      const post = byRoute('/p/:id');
      if (post) await attempt('/p/:id', async () => {
        await go(page, `/p/${postId}`);
        await snap(post);
        await page.getByRole('button', { name: 'More' }).first().click({ timeout: 4000 });
        await settle(page, 700);
        await snap(post, 'post-menu', 'the "..." menu open');
        await dismiss();
      });
      const prof = byRoute('/u/:handle');
      if (prof) await attempt('/u/:handle', async () => { await go(page, `/u/${postHandle}`); await snap(prof); });
      const rep = byRoute('/report');
      if (rep) await attempt('/report', async () => {
        await go(page, `/report?id=${postId}`);
        await snap(rep);
        await input('https://').fill('not a link');
        await click(/send report/i);
        await settle(page, 1200);
        await snap(rep, 'error', 'a link that is not a link');
      });
      const fill = (r) => r.replace(':id', postId).replace(':handle', postHandle).replace(':code', facts.invite);
      for (const s of targets.filter((x) => x.surface === 'app' && !index.screens[`app:${x.route}`]?.shots?.[tag])) {
        await attempt(s.route, async () => {
          const path = s.route === '/flag' ? `/flag?id=${postId}` : fill(s.route);
          await go(page, path);
          await snap(s);
          if (/:/.test(s.route)) index.params[s.route] = path;
        });
      }
      await ctx.close();
      tagPhases.push({ name: tag, ms: Date.now() - tagStart });
      log(`done ${tag} in ${((Date.now() - tagStart) / 1000).toFixed(1)}s`);
    })());
    const tagPhases = [];
    const webPages = (async () => {
      const t = Date.now();
      try {
        const r = await capturePages({ browser, root, out, viewports: VIEWPORTS, themes, log });
        index.pages = r.pages;
        index.failed.push(...r.failed);
      } catch (err) { index.pages = {}; index.failed.push({ what: 'web pages (all)', why: String(err.message ?? err).split('\n')[0].slice(0, 160) }); }
      tagPhases.push({ name: 'web pages from the api', ms: Date.now() - t });
    })();
    await Promise.all([...jobs, webPages]);
    phases.push(...tagPhases.sort((a, b) => a.name.localeCompare(b.name)));
    phase('all captures (in parallel)');
    await browser.close();

    let count = 0;
    for (const e of Object.values(index.pages ?? {})) count += Object.keys(e.shots).length + e.states.length;
    for (const e of Object.values(index.screens)) { count += Object.keys(e.shots).length + e.states.length; e.shots = Object.fromEntries(Object.entries(e.shots).sort()); }
    index.count = count;
    index.ms = Date.now() - T0;
    index.phases = phases;
    index.missing = targets.filter((s) => !Object.keys(index.screens[`${s.surface}:${s.route}`]?.shots ?? {}).length).map((s) => `${s.surface}:${s.route}`);
    writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 1) + '\n');
    log(`${count} images, ${Object.keys(index.screens).length} screens, ${index.missing.length} without a capture, ${index.failed.length} failed steps, took ${(index.ms / 1000).toFixed(1)}s`);
    record({ ok: true, images: count, screens: Object.keys(index.screens).length, missing: index.missing, failed: index.failed });
    spawnSync('node', [R('tools/atlas/build.mjs')], { stdio: 'inherit' });
  } catch (e) {
    record({ ok: false, error: String(e.message ?? e).split('\n').slice(0, 3).join(' ').slice(0, 300) });
    throw e;
  } finally {
    appServer?.close();
    siteServer?.close();
    rmSync(tmp, { recursive: true, force: true });
  }
}

run().catch((e) => { console.error(`SHOTS failed: ${e.stack}`); process.exitCode = 1; });
