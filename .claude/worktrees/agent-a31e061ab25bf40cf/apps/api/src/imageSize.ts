export type ImageInfo = { contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic'; width: number; height: number };

const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));

function jpegOrientation(b: Uint8Array, start: number, end: number): number {
  if (ascii(b, start, 6) !== 'Exif\0\0') return 1;
  const t = start + 6;
  const little = ascii(b, t, 2) === 'II';
  const r16 = (o: number) => (little ? u16le(b, o) : u16be(b, o));
  const r32 = (o: number) => (little ? (u16le(b, o) | (u16le(b, o + 2) << 16)) >>> 0 : u32be(b, o));
  const ifd = t + r32(t + 4);
  if (ifd + 2 > end) return 1;
  const count = r16(ifd);
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > end) break;
    if (r16(e) === 0x0112) return r16(e + 8);
  }
  return 1;
}

function parseJpeg(b: Uint8Array): ImageInfo | null {
  let o = 2;
  let orientation = 1;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) { o++; continue; }
    const m = b[o + 1];
    if (m === 0xff) { o++; continue; }
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { o += 2; continue; }
    const len = u16be(b, o + 2);
    if (m === 0xe1 && orientation === 1) orientation = jpegOrientation(b, o + 4, Math.min(b.length, o + 2 + len));
    const isSof = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    if (isSof) {
      let height = u16be(b, o + 5);
      let width = u16be(b, o + 7);
      if (!width || !height) return null;
      if (orientation >= 5 && orientation <= 8) [width, height] = [height, width];
      return { contentType: 'image/jpeg', width, height };
    }
    o += 2 + len;
  }
  return null;
}

function parsePng(b: Uint8Array): ImageInfo | null {
  if (b.length < 24 || ascii(b, 12, 4) !== 'IHDR') return null;
  const width = u32be(b, 16);
  const height = u32be(b, 20);
  return width && height ? { contentType: 'image/png', width, height } : null;
}

function parseWebp(b: Uint8Array): ImageInfo | null {
  if (b.length < 30) return null;
  const kind = ascii(b, 12, 4);
  let width = 0;
  let height = 0;
  if (kind === 'VP8 ') {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    width = u16le(b, 26) & 0x3fff;
    height = u16le(b, 28) & 0x3fff;
  } else if (kind === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    width = 1 + (b[21] | ((b[22] & 0x3f) << 8));
    height = 1 + ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0x0f) << 10));
  } else if (kind === 'VP8X') {
    width = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    height = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
  }
  return width && height ? { contentType: 'image/webp', width, height } : null;
}

const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']);

function parseHeic(b: Uint8Array): ImageInfo | null {
  if (b.length < 16 || ascii(b, 4, 4) !== 'ftyp' || !HEIC_BRANDS.has(ascii(b, 8, 4))) return null;
  const limit = Math.min(b.length, 1 << 20);
  let best = { width: 0, height: 0 };
  let rotated = false;
  for (let o = 8; o + 12 < limit; o++) {
    if (b[o] === 0x69 && b[o + 1] === 0x73 && b[o + 2] === 0x70 && b[o + 3] === 0x65 && ascii(b, o, 4) === 'ispe') {
      const width = u32be(b, o + 8);
      const height = u32be(b, o + 12);
      if (width * height > best.width * best.height) best = { width, height };
    } else if (b[o] === 0x69 && ascii(b, o, 4) === 'irot' && o + 4 < limit) {
      if ((b[o + 4] & 3) % 2 === 1) rotated = true;
    }
  }
  if (!best.width) return null;
  return { contentType: 'image/heic', ...(rotated ? { width: best.height, height: best.width } : best) };
}

export function readImageInfo(b: Uint8Array): ImageInfo | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return parseJpeg(b);
  if (b.length > 8 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return parsePng(b);
  if (b.length > 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return parseWebp(b);
  return parseHeic(b);
}

export function looksLikeVideo(head: Uint8Array): boolean {
  return head.length >= 12 && ascii(head, 4, 4) === 'ftyp';
}
