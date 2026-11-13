import { describe, expect, it } from 'vitest';
import { readImageInfo } from '../src/imageSize';
import { pngBytes } from './helpers';

describe('image header parsing', () => {
  it('reads png', () => {
    expect(readImageInfo(pngBytes(31, 17))).toEqual({ contentType: 'image/png', width: 31, height: 17 });
  });

  it('reads jpeg and swaps for exif rotation', () => {
    const sof = [0xff, 0xc0, 0, 17, 8, 0x01, 0xe0, 0x03, 0x20, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
    const plain = new Uint8Array([0xff, 0xd8, ...sof, 0xff, 0xd9]);
    expect(readImageInfo(plain)).toEqual({ contentType: 'image/jpeg', width: 800, height: 480 });
    const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0];
    const app1 = [0xff, 0xe1, 0, exif.length + 2, ...exif];
    const rotated = new Uint8Array([0xff, 0xd8, ...app1, ...sof, 0xff, 0xd9]);
    expect(readImageInfo(rotated)).toEqual({ contentType: 'image/jpeg', width: 480, height: 800 });
  });

  it('reads webp VP8X and VP8L', () => {
    const riff = (chunk: number[]) => new Uint8Array([...'RIFF'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'WEBP'].map((c) => c.charCodeAt(0)), chunk));
    const tag = (s: string) => [...s].map((c) => c.charCodeAt(0));
    const vp8x = riff([...tag('VP8X'), 10, 0, 0, 0, 0, 0, 0, 0, 0x1f, 0x03, 0, 0xef, 0x01, 0, 0, 0, 0, 0]);
    expect(readImageInfo(vp8x)).toEqual({ contentType: 'image/webp', width: 800, height: 496 });
    const w = 99, h = 49;
    const bits = (w - 1) | ((h - 1) << 14);
    const vp8l = riff([...tag('VP8L'), 5, 0, 0, 0, 0x2f, bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >> 24) & 255, 0, 0, 0, 0, 0, 0]);
    expect(readImageInfo(vp8l)).toEqual({ contentType: 'image/webp', width: 99, height: 49 });
  });

  it('reads heic ispe', () => {
    const t = (s: string) => [...s].map((c) => c.charCodeAt(0));
    const be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const file = new Uint8Array([0, 0, 0, 24, ...t('ftyp'), ...t('heic'), 0, 0, 0, 0, ...t('mif1'), ...t('heic'), 0, 0, 0, 20, ...t('ispe'), 0, 0, 0, 0, ...be(4032), ...be(3024), 0, 0, 0, 0]);
    expect(readImageInfo(file)).toEqual({ contentType: 'image/heic', width: 4032, height: 3024 });
  });

  it('rejects junk', () => {
    expect(readImageInfo(new TextEncoder().encode('hello hello hello hello'))).toBeNull();
  });
});
