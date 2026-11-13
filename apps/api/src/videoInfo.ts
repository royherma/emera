export type VideoInfo = { width: number; height: number; seconds: number };

const MAX_MOOV = 16 * 1024 * 1024;
const u32 = (b: DataView, o: number) => b.getUint32(o);
const type = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

async function readRange(bucket: R2Bucket, key: string, offset: number, length: number): Promise<Uint8Array | null> {
  const obj = await bucket.get(key, { range: { offset, length } });
  return obj ? new Uint8Array(await obj.arrayBuffer()) : null;
}

function children(b: Uint8Array, start: number, end: number): Array<{ type: string; start: number; end: number }> {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out = [];
  let o = start;
  while (o + 8 <= end) {
    let size = u32(dv, o);
    let header = 8;
    if (size === 1 && o + 16 <= end) { size = Number(dv.getBigUint64(o + 8)); header = 16; }
    if (size === 0) size = end - o;
    if (size < header || o + size > end) break;
    out.push({ type: type(b, o + 4), start: o + header, end: o + size });
    o += size;
  }
  return out;
}

export function parseMoov(moov: Uint8Array): VideoInfo | null {
  const dv = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
  let seconds = 0;
  let best: { width: number; height: number } | null = null;
  for (const box of children(moov, 0, moov.length)) {
    if (box.type === 'mvhd') {
      const v = moov[box.start];
      const scale = v === 1 ? u32(dv, box.start + 20) : u32(dv, box.start + 12);
      const dur = v === 1 ? Number(dv.getBigUint64(box.start + 24)) : u32(dv, box.start + 16);
      if (scale) seconds = dur / scale;
    }
    if (box.type !== 'trak') continue;
    const tkhd = children(moov, box.start, box.end).find((x) => x.type === 'tkhd');
    if (!tkhd) continue;
    const base = tkhd.start + (moov[tkhd.start] === 1 ? 52 : 40);
    if (base + 44 > tkhd.end) continue;
    const a = dv.getInt32(base);
    const d = dv.getInt32(base + 16);
    let width = Math.round(u32(dv, base + 36) / 65536);
    let height = Math.round(u32(dv, base + 40) / 65536);
    if (!width || !height) continue;
    if (a === 0 && d === 0) [width, height] = [height, width];
    if (!best || width * height > best.width * best.height) best = { width, height };
  }
  return best ? { ...best, seconds } : null;
}

type ReadAt = (offset: number, length: number) => Promise<Uint8Array | null>;

export async function readVideoInfoFrom(read: ReadAt, size: number): Promise<VideoInfo | null> {
  let o = 0;
  for (let i = 0; i < 64 && o + 8 <= size; i++) {
    const head = await read(o, 16);
    if (!head || head.length < 8) return null;
    const dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
    let boxSize = u32(dv, 0);
    let header = 8;
    if (boxSize === 1 && head.length >= 16) { boxSize = Number(dv.getBigUint64(8)); header = 16; }
    if (boxSize === 0) boxSize = size - o;
    if (boxSize < header) return null;
    if (type(head, 4) === 'moov') {
      if (boxSize > MAX_MOOV) return null;
      const moov = await read(o + header, boxSize - header);
      return moov ? parseMoov(moov) : null;
    }
    o += boxSize;
  }
  return null;
}

export const readVideoInfo = (bucket: R2Bucket, key: string, size: number) =>
  readVideoInfoFrom((offset, length) => readRange(bucket, key, offset, Math.min(length, size - offset)), size);
