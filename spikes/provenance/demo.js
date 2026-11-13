import sharp from 'sharp';
import { syntheticPhoto } from './src/images.js';
import { pdqHash, distance } from './src/pdq.js';
import { attach, verify } from './src/c2pa.js';
import { testCerts } from './src/certs.js';

const MATCH_MAX = 31;
const original = await syntheticPhoto(7);
const different = await syntheticPhoto(8);
const meta = await sharp(original).metadata();

const variants = {
  'resize 50%': sharp(original).resize(Math.round(meta.width / 2)).jpeg({ quality: 92 }).toBuffer(),
  'resize 25%': sharp(original).resize(Math.round(meta.width / 4)).jpeg({ quality: 92 }).toBuffer(),
  'crop 10% off each edge': sharp(original).extract({ left: 160, top: 120, width: 1280, height: 960 }).jpeg({ quality: 92 }).toBuffer(),
  'recompress q30': sharp(original).jpeg({ quality: 30 }).toBuffer(),
  'resize 50% + crop + q40': sharp(original).resize(800).extract({ left: 80, top: 60, width: 640, height: 480 }).jpeg({ quality: 40 }).toBuffer(),
  'mirror flip': sharp(original).flop().jpeg({ quality: 92 }).toBuffer(),
  'different image': Promise.resolve(different),
};

console.log('PDQ perceptual hash (256 bits, Hamming distance, match if <= ' + MATCH_MAX + ')');
const h0 = await pdqHash(original);
console.log(`  original hash ${h0.hex}  quality ${h0.quality}`);
let failed = 0;
for (const [name, p] of Object.entries(variants)) {
  const d = distance(h0, await pdqHash(await p));
  const isMatch = d <= MATCH_MAX;
  const shouldMatch = name !== 'different image' && name !== 'mirror flip';
  if (shouldMatch !== isMatch && name !== 'mirror flip') failed++;
  console.log(`  ${name.padEnd(26)} distance ${String(d).padStart(3)}  ${isMatch ? 'MATCH' : 'no match'}`);
}

console.log('\nC2PA manifest (c2pa-node, test certificate, ES256)');
const { rootPem } = testCerts();
const signed = await attach(original, { did: 'did:plc:examplecreator123', handle: 'maya.agora.example' });
console.log(`  signed: ${original.length} bytes -> ${signed.length} bytes`);

const ok = await verify(signed);
console.log(`  verify untouched          state ${ok.validationState}, failures ${ok.failures.length}, creator ${ok.author}, signer ${ok.signer}`);

const trusted = await verify(signed, { trustAnchorsPem: rootPem });
console.log(`  verify with our root CA   state ${trusted.validationState}`);

const tampered = Buffer.from(signed);
tampered[Math.floor(tampered.length / 2)] ^= 0xff;
let t;
try { t = await verify(tampered); } catch (e) { t = { validationState: 'threw: ' + e.message.slice(0, 80), failures: [] }; }
console.log(`  verify 1 byte flipped     state ${t.validationState}, failures ${t.failures.map((f) => f.code).join(',') || 'none'}`);

const resigned = await sharp(signed).resize(800).jpeg({ quality: 80 }).toBuffer();
let r;
try { r = await verify(resigned); r = `state ${r.validationState}`; } catch (e) { r = 'no manifest: ' + e.message.slice(0, 60); }
console.log(`  verify after resize+recompress   ${r}`);
const hs = await pdqHash(resigned);
console.log(`  ...but PDQ still links it to the original: distance ${distance(h0, hs)}`);

const pass = failed === 0 && ok.validationState === 'Valid' && ok.failures.length === 0 && t.failures.length > 0;
console.log(`\n${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
