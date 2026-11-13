import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
for (const app of ['apps/api', 'apps/site']) {
  const state = mkdtempSync(join(tmpdir(), 'emera-d1-'));
  const run = spawnSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state], {
    cwd: join(root, app),
    stdio: 'inherit',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' },
  });
  rmSync(state, { recursive: true, force: true });
  console.log(`${run.status === 0 ? 'ok  ' : 'FAIL'} ${app} migrations from empty`);
  if (run.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
