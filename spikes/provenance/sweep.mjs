import sharp from 'sharp';
import fs from 'node:fs';
import { syntheticPhoto } from './src/images.js';
import { pdqHash, distance } from './src/pdq.js';
const imgs = { synthetic: await syntheticPhoto(7), real: fs.readFileSync(process.argv[2]) };
for (const [n, b] of Object.entries(imgs)) {
  const m = await sharp(b).metadata(); const h0 = await pdqHash(b);
  const out = [];
  for (const p of [1, 2, 3, 5, 8, 10]) {
    const dx = Math.round(m.width * p / 100), dy = Math.round(m.height * p / 100);
    const c = await sharp(b).extract({ left: dx, top: dy, width: m.width - 2 * dx, height: m.height - 2 * dy }).jpeg({ quality: 85 }).toBuffer();
    out.push(`${p}%:${distance(h0, await pdqHash(c))}`);
  }
  const one = await sharp(b).extract({ left: Math.round(m.width*.1), top: 0, width: Math.round(m.width*.9), height: m.height }).jpeg({quality:85}).toBuffer();
  out.push(`10%oneside:${distance(h0, await pdqHash(one))}`);
  console.log(n, m.width + 'x' + m.height, out.join('  '));
}
