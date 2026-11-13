import { readFileSync, writeFileSync } from 'node:fs';
import brand from '../../packages/brand/brand.json' with { type: 'json' };

const file = process.argv[2];
const title = `${brand.name}, the open source social network`;
const description = 'AI is breaking the internet. Emera uses it to build the fix: real people, proof on every post, rules anyone can read.';
const image = `https://app.${brand.domain}/og.jpg`;
const tags = [
  ['property', 'og:type', 'website'], ['property', 'og:site_name', brand.name], ['property', 'og:title', title],
  ['property', 'og:description', description], ['property', 'og:url', `https://app.${brand.domain}/`],
  ['property', 'og:image', image], ['property', 'og:image:width', '2560'], ['property', 'og:image:height', '1280'],
  ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', title],
  ['name', 'twitter:description', description], ['name', 'twitter:image', image],
].map(([k, n, v]) => `<meta ${k}="${n}" content="${v.replace(/"/g, '&quot;')}">`).join('\n');
const html = readFileSync(file, 'utf8');
if (html.includes('og:image')) process.exit(0);
writeFileSync(file, html.replace('</head>', `${tags}\n</head>`));
