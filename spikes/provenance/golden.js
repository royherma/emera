import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Lexicons, jsonToLex } from '@atproto/lexicon';
import { schemas } from '@atproto/api';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'lexicons');
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const docs = walk(join(root, 'social')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(f, 'utf8')));
const lex = new Lexicons(docs);
lex.add(schemas.find((s) => s.id === 'com.atproto.repo.strongRef'));

const load = (name) => JSON.parse(readFileSync(join(root, 'golden', name), 'utf8'));
const covered = new Set();
let bad = 0;

for (const [file, expectValid] of [['valid.json', true], ['invalid.json', false]]) {
  for (const { nsid, name, record } of load(file)) {
    covered.add(`${nsid} ${expectValid ? 'valid' : 'invalid'}`);
    let ok = true;
    let why = '';
    try {
      lex.assertValidRecord(nsid, jsonToLex(record));
    } catch (e) {
      ok = false;
      why = e.message;
    }
    const pass = ok === expectValid;
    if (!pass) bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${expectValid ? 'valid  ' : 'invalid'} ${nsid} ${name}${ok ? '' : ` (${why})`}`);
  }
}

for (const nsid of ['social.emera.post', 'social.emera.actor.profile', 'social.emera.provenance']) {
  for (const kind of ['valid', 'invalid']) {
    if (!covered.has(`${nsid} ${kind}`)) {
      bad++;
      console.log(`  FAIL no ${kind} golden record for ${nsid}`);
    }
  }
}

console.log(bad ? 'FAIL' : 'PASS');
process.exit(bad ? 1 : 0);
