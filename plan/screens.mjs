import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = 'royherma/emera';
let token;
const gh = async (path) => {
  token ??= execSync('gh auth token').toString().trim();
  const r = await fetch(`https://api.github.com/${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'emera-plan' } });
  if (!r.ok) throw new Error(`GitHub ${r.status} on ${path}`);
  return r.json();
};

const cache = new Map();
const SECTIONS = [
  ['Sign up', ['welcome', 'sign-in', 'code', 'handle']],
  ['Main tabs', ['feed', 'explore', 'upload', 'me', 'notifications', 'search']],
  ['A post and its people', ['p-p_100', 'comments-p_100', 'u-mina', 'followers-mina', 'following-mina']],
  ['Settings', ['settings', 'edit-profile', 'invites', 'blocked']],
  ['Safety', ['report', 'flag']],
];
const shotsOf = (tree, id) => {
  const pre = `runs/${id}/`;
  return tree
    .filter((t) => t.type === 'blob' && t.path.startsWith(pre) && t.path.endsWith('.png'))
    .map((t) => {
      const [platform, file] = t.path.slice(pre.length).split('/');
      return { platform, file, name: file.replace(/^\d+-/, '').replace(/\.png$/, ''), url: `https://raw.githubusercontent.com/${REPO}/ci-shots/${t.path}` };
    })
    .sort((a, b) => a.file.localeCompare(b.file));
};

async function build(root, runId) {
  const names = [...readFileSync(join(root, 'apps/mobile/e2e/walk.yaml'), 'utf8').matchAll(/takeScreenshot:\s*(\S+)/g)].map((m) => m[1]);
  const { workflow_runs: runs } = await gh(`repos/${REPO}/actions/workflows/native.yml/runs?per_page=6`);
  const run = runId ? (runs.find((r) => String(r.id) === runId) ?? (await gh(`repos/${REPO}/actions/runs/${runId}`))) : runs[0];
  const { jobs } = await gh(`repos/${REPO}/actions/runs/${run.id}/jobs`);
  let shots = [], prev = null;
  try {
    const { tree } = await gh(`repos/${REPO}/git/trees/ci-shots?recursive=1`);
    shots = shotsOf(tree, run.id);
    const ids = [...new Set(tree.map((t) => /^runs\/(\d+)\//.exec(t.path)?.[1]).filter(Boolean))].map(Number).filter((x) => x < run.id).sort((a, b) => b - a);
    if (ids[0]) prev = { id: ids[0], shots: shotsOf(tree, ids[0]) };
  } catch {}
  const known = new Set(SECTIONS.flatMap(([, n]) => n));
  const sections = [...SECTIONS.map(([title, n]) => ({ title, names: n.filter((x) => names.includes(x)) })), { title: 'Other', names: names.filter((x) => !known.has(x)) }].filter((x) => x.names.length);
  return {
    run: { id: run.id, status: run.status, conclusion: run.conclusion, branch: run.head_branch, sha: run.head_sha.slice(0, 7), created: run.created_at, url: run.html_url },
    jobs: jobs.map((j) => {
      const step = j.steps?.find((s) => s.status === 'in_progress');
      return { name: j.name, status: j.status, conclusion: j.conclusion, step: step?.name ?? null, stepStarted: step?.started_at ?? null, started: j.started_at, completed: j.completed_at, url: j.html_url };
    }),
    names,
    sections,
    shots,
    prev,
    runs: runs.map((r) => ({ id: r.id, branch: r.head_branch, status: r.status, conclusion: r.conclusion, created: r.created_at })),
    at: new Date().toISOString(),
  };
}

export async function screensApi(root, url, res) {
  const runId = url.searchParams.get('run') || '';
  const hit = cache.get(runId);
  try {
    if (!hit || Date.now() - hit.t > 4000) cache.set(runId, { t: Date.now(), body: await build(root, runId) });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(cache.get(runId).body));
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: String(e.message || e) }));
  }
}
