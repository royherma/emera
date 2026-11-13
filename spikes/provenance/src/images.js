import sharp from 'sharp';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

export async function syntheticPhoto(seed, w = 1600, h = 1200) {
  const r = rng(seed);
  const shapes = [];
  for (let i = 0; i < 40; i++) {
    const c = `rgb(${(r() * 255) | 0},${(r() * 255) | 0},${(r() * 255) | 0})`;
    const x = r() * w, y = r() * h, s = 60 + r() * 360;
    shapes.push(i % 2 ? `<circle cx="${x}" cy="${y}" r="${s / 2}" fill="${c}" fill-opacity="0.8"/>` : `<rect x="${x}" y="${y}" width="${s}" height="${s * (0.4 + r())}" fill="${c}" fill-opacity="0.8" transform="rotate(${r() * 90} ${x} ${y})"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="rgb(${(r() * 255) | 0},${(r() * 255) | 0},${(r() * 255) | 0})"/>${shapes.join('')}</svg>`;
  return sharp(Buffer.from(svg)).blur(2).jpeg({ quality: 92 }).toBuffer();
}
