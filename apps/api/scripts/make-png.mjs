import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const [out, w = '64', h = '48'] = process.argv.slice(2);
const width = Number(w);
const height = Number(h);

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr.set([8, 2, 0, 0, 0], 8);
const stride = width * 3 + 1;
const raw = Buffer.alloc(stride * height);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const o = y * stride + 1 + x * 3;
    raw[o] = Math.round((x / width) * 226);
    raw[o + 1] = Math.round((y / height) * 122);
    raw[o + 2] = 90 + ((x + y) % 40);
  }
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(out, png);
