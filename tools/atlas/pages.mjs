import { execSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 5042;
const CREATOR = { email: 'kiln@example.test', handle: 'kiln_studio', name: 'Kiln Studio' };
const PHOTOS = ['ceramics.jpg', 'lanterns.jpg', 'mural.jpg', 'lettering.jpg', 'guitar.jpg', 'kimono.jpg'];
const CAPTIONS = ['Glaze test, second firing', 'Paper lanterns for the night market', 'Wall in progress, day three', 'Brush lettering practice', 'Rebuilt the neck on this one', 'Indigo dye, first try'];

const freePort = () => { for (const pid of execSync(`lsof -ti tcp:${PORT} || true`).toString().split('\n').filter(Boolean)) try { process.kill(Number(pid)); } catch {} };

export async function capturePages({ browser, root, out, viewports, themes, log }) {
  const api = join(root, 'apps/api');
  const work = mkdtempSync(join(tmpdir(), 'atlas-api-'));
  const base = `http://127.0.0.1:${PORT}`;
  const result = { pages: {}, failed: [] };
  freePort();
  const mig = spawnSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', join(work, 'state')], { cwd: api, encoding: 'utf8' });
  if (mig.status !== 0) throw new Error(`api migrations failed: ${(mig.stderr || mig.stdout).slice(-300)}`);
  let logText = '';
  const dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', join(work, 'state'), '--var', 'INVITES_REQUIRED:false'], { cwd: api, stdio: ['ignore', 'pipe', 'pipe'] });
  dev.stdout.on('data', (d) => { logText += d; });
  dev.stderr.on('data', (d) => { logText += d; });
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
    log('api up for web pages');
    const j = async (path, body, token) => {
      const r = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-TG-Tester': '1', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const t = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(t).slice(0, 160)}`);
      return t;
    };
    await j('/v1/auth/start', { email: CREATOR.email });
    await new Promise((r) => setTimeout(r, 600));
    const code = logText.match(new RegExp(`sign-in code for ${CREATOR.email}: (\\d+)`))?.[1];
    if (!code) throw new Error('no sign-in code in the api log');
    const { token } = await j('/v1/auth/verify', { email: CREATOR.email, code });
    await j('/v1/auth/handle', { handle: CREATOR.handle, displayName: CREATOR.name }, token);
    let postId;
    for (const [i, f] of PHOTOS.entries()) {
      const bytes = readFileSync(join(root, 'brand/content', f));
      const slot = await j('/v1/uploads', { contentType: 'image/jpeg', bytes: bytes.length }, token);
      const put = await fetch(slot.uploadUrl.startsWith('http') ? slot.uploadUrl : base + slot.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${token}` }, body: bytes });
      const media = (await put.json()).media;
      const post = await j('/v1/posts', { mediaIds: [media.id], caption: CAPTIONS[i], alt: {} }, token);
      postId ??= post.post?.id ?? post.id;
    }
    const invite = (await j('/v1/invites', {}, token)).code;
    log(`seeded @${CREATOR.handle}, ${PHOTOS.length} posts`);

    const targets = [['/', '/'], ['/invite/:code', `/invite/${invite}`], ['/@:handle', `/@${CREATOR.handle}`], ['/p/:id', `/p/${postId}`]];
    for (const theme of themes) for (const vp of Object.keys(viewports)) {
      const tag = `${vp}-${theme}`;
      const ctx = await browser.newContext({ viewport: viewports[vp], colorScheme: theme === 'night' ? 'dark' : 'light', extraHTTPHeaders: { 'X-TG-Tester': '1' } });
      const page = await ctx.newPage();
      for (const [route, path] of targets) {
        const e = (result.pages[route] ??= { key: `page:${route}`, slug: `page-${route === '/' ? 'home' : route.replace(/^\//, '').replace(/[/:@]+/g, '-').replace(/^-|-$/g, '')}`, route, path, shots: {}, states: [] });
        try {
          const res = await page.goto(base + path, { waitUntil: 'networkidle' });
          if (!res?.ok()) throw new Error(`HTTP ${res?.status()}`);
          mkdirSync(join(out, e.slug), { recursive: true });
          await page.screenshot({ path: join(out, e.slug, `${tag}.png`) });
          e.shots[tag] = `data/atlas-shots/${e.slug}/${tag}.png`;
          if (route === '/@:handle' || route === '/p/:id') {
            const og = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('meta[property^="og:"],meta[name^="twitter:"]')].map((m) => [m.getAttribute('property') || m.getAttribute('name'), m.content])));
            const card = await ctx.newPage();
            const img = og['og:image'] ? og['og:image'].replace(/^https?:\/\/[^/]+/, base) : '';
            await card.setContent(`<body style="margin:0;display:grid;place-items:center;height:100vh;background:${theme === 'night' ? '#000' : '#f4f4f4'};font:15px -apple-system,Helvetica,Arial"><div style="width:min(520px,92vw);border:1px solid #cfd9de;border-radius:16px;overflow:hidden;background:${theme === 'night' ? '#16181c' : '#fff'};color:${theme === 'night' ? '#e7e9ea' : '#0f1419'}">${img ? `<img src="${img}" style="display:block;width:100%;aspect-ratio:1.91/1;object-fit:cover">` : ''}<div style="padding:12px 14px"><div style="color:#536471;font-size:13px">emera.social</div><div style="font-weight:600;margin:2px 0">${(og['og:title'] || '').replace(/</g, '&lt;')}</div><div style="color:#536471;font-size:14px">${(og['og:description'] || '').replace(/</g, '&lt;')}</div></div></div></body>`, { waitUntil: 'networkidle' });
            await card.screenshot({ path: join(out, e.slug, `preview-${tag}.png`) });
            e.states.push({ name: 'preview', tag, file: `data/atlas-shots/${e.slug}/preview-${tag}.png`, note: 'the card a pasted link shows, built from its og tags' });
            await card.close();
          }
        } catch (err) { result.failed.push({ what: `web page ${route} (${tag})`, why: String(err.message ?? err).split('\n')[0].slice(0, 160) }); }
      }
      await ctx.close();
    }
  } finally {
    dev.kill();
    freePort();
    rmSync(work, { recursive: true, force: true });
  }
  return result;
}
