#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = process.argv.includes('--json');
const sh = (cmd, args, cwd = root) => {
  try { return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; }
};
const ago = ms => { const m = Math.round((Date.now() - ms) / 60000); return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`; };

function coord() {
  const coordRoot = process.env.MM_COORD_ROOT || join(homedir(), 'MightyMouse Staging');
  const bin = join(coordRoot, 'bin', 'mm-coord');
  if (!existsSync(bin)) return null;
  const session = process.env.CLAUDE_CODE_SESSION_ID || process.env.MM_COORD_SESSION;
  const run = args => sh(process.execPath, [bin, ...args], root);
  const out = (session && run(['status', '{}', '--harness', 'claude', '--session', session])) || run(['overview']);
  try {
    const o = JSON.parse(out);
    const projectId = createHash('sha256').update(realpathSync(root)).digest('hex');
    const ids = new Set([projectId, ...(o.projects || []).filter(p => p.name === 'agora' && p.state === 'active').map(p => p.id)]);
    const sessions = (o.sessions || []).filter(s => ids.has(s.project) && !s.stale && s.state !== 'closed');
    const label = id => sessions.find(s => s.id === id)?.label || (o.sessions || []).find(s => s.id === id)?.label || id.slice(0, 8);
    const work = (o.work || []).filter(w => ids.has(w.project) && !w.expired && !['complete', 'released'].includes(w.state))
      .map(w => ({ ...w, ownerLabel: label(w.owner) }));
    return { sessions, work };
  } catch { return null; }
}

function trees() {
  const list = sh('git', ['worktree', 'list', '--porcelain']).split('\n\n').filter(Boolean).map(b => {
    const path = b.match(/^worktree (.+)$/m)?.[1];
    const branch = b.match(/^branch refs\/heads\/(.+)$/m)?.[1] || '(detached)';
    return { path, branch };
  });
  return list.filter(t => existsSync(t.path)).map(t => {
    const isMain = t.path === root || t.branch === 'main';
    const committed = isMain ? '' : sh('git', ['diff', '--name-only', 'main...HEAD'], t.path);
    const dirty = sh('git', ['status', '--porcelain', '--untracked-files=all'], t.path)
      .split('\n').filter(Boolean).map(l => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop());
    const files = [...new Set([...committed.split('\n').filter(Boolean), ...dirty])];
    const migDir = join(t.path, 'apps/api/migrations');
    const migrations = existsSync(migDir) ? readdirSync(migDir).filter(f => /^\d{4}_.*\.sql$/.test(f)) : [];
    const ahead = isMain ? 0 : Number(sh('git', ['rev-list', '--count', 'main..HEAD'], t.path).trim() || 0);
    return { ...t, name: isMain ? 'main' : t.path.split('/').pop(), isMain, files, migrations, ahead };
  });
}

const GENERATED = /^(data\/atlas(-shots\/|\.json)|\.claude\/|\.playwright-mcp\/)/;
const c = coord();
const t = trees();
const touched = new Map();
for (const tree of t) for (const f of tree.files) {
  if (GENERATED.test(f)) continue;
  touched.set(f, [...(touched.get(f) || []), tree.name]);
}
const overlaps = [...touched].filter(([, who]) => who.length > 1).map(([file, who]) => ({ file, who }));

const mainMig = new Set(t.find(x => x.isMain)?.migrations || []);
const newMig = t.flatMap(x => x.migrations.filter(m => !mainMig.has(m)).map(m => ({ m, num: m.slice(0, 4), tree: x.name })));
const byNum = Object.groupBy(newMig, x => x.num);
const migClash = Object.entries(byNum).filter(([, v]) => new Set(v.map(x => x.m)).size > 1);
const allNums = [...mainMig, ...newMig.map(x => x.m)].map(m => Number(m.slice(0, 4)));
const nextMigration = String(Math.max(0, ...allNums) + 1).padStart(4, '0');

const report = { at: new Date().toISOString(), coord: c, worktrees: t.map(({ files, ...x }) => ({ ...x, fileCount: files.length })), overlaps, migrations: { inFlight: newMig, clashes: migClash, next: nextMigration } };
if (json) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }

console.log('SESSIONS (shared-work board)');
if (!c) console.log('  board unreachable: is MightyMouse running?');
else for (const s of c.sessions) console.log(`  ${s.label.padEnd(18)} seen ${ago(s.lastSeen).padStart(4)} ago  ${s.cwd.replace(root, '.')}`);
console.log('\nCLAIMS');
if (c && !c.work.length) console.log('  none - nobody has claimed anything. Claim before you edit.');
for (const w of c?.work || []) console.log(`  ${(w.emoji || '·')} ${w.id.padEnd(26)} ${w.ownerLabel.padEnd(16)} ${w.state}${w.note ? ' - ' + w.note.slice(0, 60) : ''}`);
console.log('\nWORKTREES');
for (const x of t) console.log(`  ${x.name.padEnd(28)} ${x.branch.slice(0, 34).padEnd(34)} ${x.isMain ? '' : `+${x.ahead} commits, `}${x.files.filter(f => !GENERATED.test(f)).length} files changed${!x.isMain && !x.ahead && !x.files.length ? ' (merged, safe to remove)' : ''}`);
console.log('\nSAME FILE IN MORE THAN ONE PLACE (merge one at a time)');
if (!overlaps.length) console.log('  none');
for (const o of overlaps) console.log(`  ${o.file.padEnd(46)} ${o.who.join(', ')}`);
console.log('\nMIGRATIONS');
for (const x of newMig) console.log(`  ${x.m.padEnd(36)} ${x.tree}`);
for (const [num, v] of migClash) console.log(`  CLASH ${num}: ${v.map(x => `${x.m} (${x.tree})`).join(' vs ')}`);
console.log(`  next free number: ${nextMigration} (claim it: work "migration-${nextMigration}")`);
