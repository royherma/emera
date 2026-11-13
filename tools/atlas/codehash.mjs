import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const CAPTURED = ['apps/mobile/src', 'apps/mobile/assets', 'apps/mobile/app.config.js', 'apps/mobile/app.json', 'apps/site/public'];

// Hash of what the pictures show: committed trees + uncommitted edits + new files, so wip autocommits elsewhere don't mark captures stale.
export function codeHash(root) {
  const run = (c) => { try { return execSync(c, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }).toString(); } catch { return ''; } };
  const paths = CAPTURED.join(' ');
  const h = createHash('sha1');
  for (const p of CAPTURED) h.update(run(`git rev-parse HEAD:${p}`));
  h.update(run(`git diff HEAD -- ${paths}`));
  for (const f of run(`git ls-files --others --exclude-standard -- ${paths}`).split('\n').filter(Boolean)) {
    try { h.update(f).update(readFileSync(join(root, f))); } catch { h.update(f + String(statSync(join(root, f), { throwIfNoEntry: false })?.mtimeMs)); }
  }
  return h.digest('hex').slice(0, 12);
}
