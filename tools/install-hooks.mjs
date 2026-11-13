import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (process.env.CI || !existsSync('.git')) process.exit(0);
spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
