import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [from, to] = process.argv.slice(2);
if (!from || !to) { console.error('usage: node rename-nsid.mjs social.emera org.newname'); process.exit(1); }
const root = dirname(fileURLToPath(import.meta.url));
const dirOf = (a) => a.split('.').reverse().join('/');
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(join(root, dirOf(from))).filter((f) => f.endsWith('.json'));
for (const f of files) {
  const out = join(root, f.slice(root.length + 1).replace(dirOf(from), dirOf(to)));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, readFileSync(f, 'utf8').replaceAll(from, to));
}
rmSync(join(root, dirOf(from).split('/')[0]), { recursive: true });
console.log(`renamed ${files.length} lexicons ${from} -> ${to}`);
