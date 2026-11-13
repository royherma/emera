import sharp from 'sharp';
import { createRequire } from 'node:module';
const { PDQ } = createRequire(import.meta.url)('pdq-wasm');

let ready;
export async function pdqHash(buf) {
  ready ??= PDQ.init();
  await ready;
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const r = PDQ.hash({ data: new Uint8Array(data), width: info.width, height: info.height, channels: 3 });
  return { hash: r.hash, hex: PDQ.toHex(r.hash), quality: r.quality };
}

export const distance = (a, b) => PDQ.hammingDistance(a.hash, b.hash);
