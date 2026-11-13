import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Lexicons } from '@atproto/lexicon';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'lexicons');
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const docs = walk(root).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(f, 'utf8')));
const lex = new Lexicons(docs);
console.log(`loaded ${docs.length} lexicons: ${docs.map((d) => d.id).join(', ')}`);

const cid = 'bafkreibme22gw2h7y2h7tg2fhqotaqjucnbc24deqo72b6mkl2egezxhvy';
const blob = (mimeType, size) => ({ $type: 'blob', ref: { $link: cid }, mimeType, size });
const strong = { uri: 'at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/social.emera.post/3kabc', cid };
const hex = 'a'.repeat(64);
const now = new Date().toISOString();

const cases = [
  ['social.emera.post', 'image post', true, { $type: 'social.emera.post', text: 'sunrise', createdAt: now, license: 'cc-by-nc', provenance: strong, media: { $type: 'social.emera.post#images', images: [{ image: blob('image/jpeg', 120000), alt: 'orange sky', pdq: hex, aspectRatio: { width: 4, height: 3 } }] } }],
  ['social.emera.post', 'video post', true, { $type: 'social.emera.post', createdAt: now, media: { $type: 'social.emera.post#videoMedia', video: { video: blob('video/mp4', 9000000), durationMs: 30000 } } }],
  ['social.emera.post', 'no media', false, { $type: 'social.emera.post', createdAt: now }],
  ['social.emera.post', 'gif blob', false, { $type: 'social.emera.post', createdAt: now, media: { $type: 'social.emera.post#images', images: [{ image: blob('image/gif', 10), alt: '' }] } }],
  ['social.emera.actor.profile', 'profile', true, { $type: 'social.emera.actor.profile', craft: ['photography'], copyWatch: { enabled: true, grantedAt: now, autoFile: 'ask-each-time' } }],
  ['social.emera.provenance', 'provenance', true, { $type: 'social.emera.provenance', subject: strong, signedAt: now, signer: 'Emera Test Signer', items: [{ sha256: hex, pdq: hex, origin: 'captured', c2pa: { state: 'valid' } }] }],
  ['social.emera.provenance', 'short sha256', false, { $type: 'social.emera.provenance', subject: strong, signedAt: now, items: [{ sha256: 'abc' }] }],
];

let bad = 0;
for (const [nsid, name, expectValid, rec] of cases) {
  let ok = true, why = '';
  try { lex.assertValidRecord(nsid, rec); } catch (e) { ok = false; why = e.message; }
  const good = ok === expectValid;
  if (!good) bad++;
  console.log(`  ${good ? 'ok  ' : 'FAIL'} ${nsid} ${name}: ${ok ? 'valid' : 'rejected (' + why + ')'}`);
}
console.log(bad ? 'FAIL' : 'PASS');
process.exit(bad ? 1 : 0);
