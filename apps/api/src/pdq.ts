import type { Env } from './env';

export const PDQ_BITS = 256;
export const PDQ_MAX_DISTANCE = 31;
const N = 64;
const K = 16;

type Gray = { w: number; h: number; data: Float32Array };

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as unknown as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function decodePng(b: Uint8Array): Promise<Gray | null> {
  if (b.length < 33 || b[0] !== 0x89 || b[1] !== 0x50) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  let palette: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  for (let o = 8; o + 12 <= b.length;) {
    const len = dv.getUint32(o);
    const type = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
    const body = b.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = dv.getUint32(o + 8); h = dv.getUint32(o + 12); depth = b[o + 16]; ctype = b[o + 17]; interlace = b[o + 20]; }
    else if (type === 'PLTE') palette = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[ctype];
  if (!w || !h || depth !== 8 || interlace || !channels || (ctype === 3 && !palette) || w * h > 64_000_000) return null;
  const joined = new Uint8Array(idat.reduce((n, p) => n + p.length, 0));
  let p = 0;
  for (const part of idat) { joined.set(part, p); p += part.length; }
  const raw = await inflate(joined);
  const stride = w * channels;
  if (raw.length < (stride + 1) * h) return null;
  const px = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[y * stride + x - channels] : 0;
      const up = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= channels && y ? px[(y - 1) * stride + x - channels] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const pp = a + up - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      } else if (f > 4) return null;
      px[y * stride + x] = v & 255;
    }
  }
  const data = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const s = i * channels;
    let r: number, g: number, bl: number;
    if (ctype === 0 || ctype === 4) r = g = bl = px[s];
    else if (ctype === 3) { const e = px[s] * 3; r = palette![e]; g = palette![e + 1]; bl = palette![e + 2]; }
    else { r = px[s]; g = px[s + 1]; bl = px[s + 2]; }
    data[i] = 0.299 * r + 0.587 * g + 0.114 * bl;
  }
  return { w, h, data };
}

function boxTo64(g: Gray): Float32Array {
  const out = new Float32Array(N * N);
  for (let oy = 0; oy < N; oy++) {
    const y0 = Math.floor((oy * g.h) / N), y1 = Math.max(y0 + 1, Math.floor(((oy + 1) * g.h) / N));
    for (let ox = 0; ox < N; ox++) {
      const x0 = Math.floor((ox * g.w) / N), x1 = Math.max(x0 + 1, Math.floor(((ox + 1) * g.w) / N));
      let sum = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) sum += g.data[y * g.w + x];
      out[oy * N + ox] = sum / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

const DCT = (() => {
  const m = new Float32Array(K * N);
  for (let k = 0; k < K; k++) for (let n = 0; n < N; n++) m[k * N + n] = Math.cos((Math.PI / N) * (n + 0.5) * k);
  return m;
})();

export function pdqFromGray(g: Gray): Uint8Array {
  const img = boxTo64(g);
  const rows = new Float32Array(N * K);
  for (let y = 0; y < N; y++) for (let k = 0; k < K; k++) {
    let s = 0;
    for (let x = 0; x < N; x++) s += DCT[k * N + x] * img[y * N + x];
    rows[y * K + k] = s;
  }
  const coef = new Float32Array(K * K);
  for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) {
    let s = 0;
    for (let y = 0; y < N; y++) s += DCT[j * N + y] * rows[y * K + i];
    coef[j * K + i] = s;
  }
  const sorted = Float32Array.from(coef).sort();
  const median = (sorted[127] + sorted[128]) / 2;
  const bits = new Uint8Array(32);
  for (let i = 0; i < PDQ_BITS; i++) if (coef[i] > median) bits[i >> 3] |= 1 << (i & 7);
  return bits;
}

export function pdqDistance(a: Uint8Array, b: Uint8Array): number {
  let d = 0;
  for (let i = 0; i < 32; i++) {
    let x = a[i] ^ b[i];
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

export async function pdqOf(env: Pick<Env, 'IMAGES'>, bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    if (env.IMAGES) {
      try {
        const out = await env.IMAGES.input(new Blob([bytes as unknown as ArrayBuffer]).stream()).transform({ width: N, height: N, fit: 'squeeze' }).output({ format: 'image/png' });
        const small = await decodePng(new Uint8Array(await out.response().arrayBuffer()));
        if (small) return pdqFromGray(small);
      } catch {}
    }
    const g = await decodePng(bytes);
    return g ? pdqFromGray(g) : null;
  } catch {
    return null;
  }
}
