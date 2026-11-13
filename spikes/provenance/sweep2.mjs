import sharp from 'sharp';
import fs from 'node:fs';
import { syntheticPhoto } from './src/images.js';
import { pdqHash, distance } from './src/pdq.js';
const real = fs.readFileSync(process.argv[2]);
async function crops(b, scales, grid) {
  const m = await sharp(b).metadata(); const out = [];
  for (const s of scales) {
    const w = Math.round(m.width * s), h = Math.round(m.height * s);
    const n = s === 1 ? 1 : grid;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const left = n === 1 ? 0 : Math.round((m.width - w) * i / (n - 1)), top = n === 1 ? 0 : Math.round((m.height - h) * j / (n - 1));
      out.push(await sharp(b).extract({ left, top, width: w, height: h }).raw().toBuffer({ resolveWithObject: true }).then(async ({data, info}) => sharp(data,{raw:info}).jpeg({quality:90}).toBuffer()));
    }
  }
  return out;
}
let seed = 5; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
for (const [scales, grid] of [[[1,.85,.7],3],[[1,.9,.8,.7,.6],3],[[1,.9,.8,.7,.6],5]]) {
  const t0 = Date.now();
  const reg = await Promise.all((await crops(real, scales, grid)).map(pdqHash));
  const regMs = Date.now() - t0;
  const m = await sharp(real).metadata();
  let hit = 0, N = 40;
  for (let k = 0; k < N; k++) {
    const s = 0.65 + rnd() * 0.35; const w = Math.round(m.width * s), h = Math.round(m.height * s);
    const q = await sharp(real).extract({ left: Math.round(rnd() * (m.width - w)), top: Math.round(rnd() * (m.height - h)), width: w, height: h }).resize(400).jpeg({ quality: 70 }).toBuffer();
    const qh = await pdqHash(q);
    if (Math.min(...reg.map(r => distance(r, qh))) <= 31) hit++;
  }
  let fp = 0, M = 150;
  for (let k = 0; k < M; k++) { const qh = await pdqHash(await syntheticPhoto(1000 + k, 800, 600)); if (Math.min(...reg.map(r => distance(r, qh))) <= 31) fp++; }
  console.log(`scales ${scales} grid ${grid}: ${reg.length} hashes (${reg.length*32} B), build ${regMs} ms; random crops 65-100% matched ${hit}/${N}; false matches vs ${M} other images ${fp}`);
}
