import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};
function png(w, h, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const ig = join(root, 'instagram-export');
mkdirSync(join(ig, 'media/posts/202501'), { recursive: true });
mkdirSync(join(ig, 'your_instagram_activity/media'), { recursive: true });
const colors = { red: [220, 60, 60], green: [60, 180, 90], blue: [60, 100, 220], gold: [230, 190, 50] };
for (const [name, c] of Object.entries(colors)) writeFileSync(join(ig, `media/posts/202501/${name}.png`), png(80, 60, c));
writeFileSync(join(ig, 'media/posts/202501/clip.gif'), Buffer.from('GIF89a'));

const utf8AsLatin1 = (s) => Buffer.from(s, 'utf8').toString('latin1');
const posts = [
  { media: [{ uri: 'media/posts/202501/red.png', creation_timestamp: 1634564885, title: 'First solid red' }] },
  {
    media: [
      { uri: 'media/posts/202501/green.png', creation_timestamp: 1629985612 },
      { uri: 'media/posts/202501/blue.png', creation_timestamp: 1629985613 },
    ],
    title: utf8AsLatin1('Carousel of two café colors ☕'),
    creation_timestamp: 1629985612,
  },
  { media: [{ uri: 'media/posts/202501/gold.png', creation_timestamp: 1700000000, title: 'Gold, no post-level date' }] },
  { media: [{ uri: 'media/posts/202501/clip.gif', creation_timestamp: 1700000100, title: 'A gif' }] },
  { media: [{ uri: 'media/posts/202501/gone.png', creation_timestamp: 1700000200, title: 'File missing' }] },
];
writeFileSync(join(ig, 'your_instagram_activity/media/posts_1.json'), JSON.stringify(posts, null, 2));

const plain = join(root, 'plain-folder');
mkdirSync(plain, { recursive: true });
writeFileSync(join(plain, 'violet.png'), png(64, 64, [140, 80, 200]));
writeFileSync(join(plain, 'violet.txt'), 'Plain folder caption\n');
writeFileSync(join(plain, 'teal.png'), png(64, 64, [40, 170, 170]));
console.log('fixtures written to', root);
