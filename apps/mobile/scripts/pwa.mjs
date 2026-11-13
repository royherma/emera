import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = process.argv[2];
if (!dist) {
  console.error("usage: node scripts/pwa.mjs <dist dir>");
  process.exit(1);
}
const brand = JSON.parse(readFileSync(join(here, "../../../packages/brand/brand.json"), "utf8"));

const icons = [
  ["icon-192.png", "192x192", "any"],
  ["icon-512.png", "512x512", "any"],
  ["icon-maskable-512.png", "512x512", "maskable"],
];
mkdirSync(join(dist, "pwa"), { recursive: true });
for (const [file] of icons) copyFileSync(join(here, "../assets/pwa", file), join(dist, "pwa", file));

const manifest = {
  name: `${brand.name} - ${brand.line}`,
  short_name: brand.name,
  description: brand.line,
  start_url: "/",
  scope: "/",
  id: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: brand.colors.bg,
  theme_color: brand.colors.bg,
  icons: icons.map(([file, sizes, purpose]) => ({ src: `/pwa/${file}`, sizes, type: "image/png", purpose })),
};
writeFileSync(join(dist, "manifest.webmanifest"), JSON.stringify(manifest, null, 2));

writeFileSync(
  join(dist, "offline.html"),
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${brand.name} is offline</title>
<style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:${brand.colors.bg};color:${brand.colors.ink};font-family:system-ui,sans-serif;text-align:center;padding:0 16px}h1{margin:0;font-size:24px}p{margin:0;opacity:.7}button{margin-top:8px;border:0;border-radius:999px;padding:12px 24px;background:${brand.colors.accent};color:${brand.colors.ink};font-size:16px;font-weight:600}</style>
</head><body><h1>You're offline</h1><p>${brand.name} needs a connection to load new posts.</p><button onclick="location.reload()">Try again</button></body></html>
`,
);

const indexPath = join(dist, "index.html");
let html = readFileSync(indexPath, "utf8");
const assets = [...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css|ico|png))"/g)].map((m) => m[1]);
const walk = (dir) => readdirSync(join(dist, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`/${dir}/${e.name}`]));
const chunks = walk("_expo/static");
const shell = [...new Set(["/", "/offline.html", "/manifest.webmanifest", ...icons.map(([f]) => `/pwa/${f}`), ...assets, ...chunks])];
const version = createHash("sha256").update(html + JSON.stringify(manifest) + shell.join()).digest("hex").slice(0, 12);

writeFileSync(
  join(dist, "sw.js"),
  `const VERSION = "${version}";
const SHELL = "shell-" + VERSION;
const RUNTIME = "runtime";
const SHELL_URLS = ${JSON.stringify(shell)};

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("shell-") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match("/").then((r) => r || caches.match("/offline.html"))),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && /^\\/(_expo|assets)\\//.test(url.pathname)) {
        const copy = res.clone();
        caches.open(RUNTIME).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
`,
);

const head = `<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/pwa/icon-192.png">
<meta name="theme-color" content="${brand.colors.bg}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${brand.name}">
<script>if("serviceWorker"in navigator)addEventListener("load",function(){navigator.serviceWorker.register("/sw.js")})</script>`;
if (!html.includes('rel="manifest"')) {
  html = html.replace(/<meta name="theme-color"[^>]*>\s*/g, "").replace("</head>", `${head}\n</head>`);
  writeFileSync(indexPath, html);
}
console.log(`pwa: ${shell.length} shell urls, version ${version}`);
