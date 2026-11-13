import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const SKIP = new Set(["script", "style", "svg", "textarea", "select", "noscript", "template", "head"]);
const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)\b([^>]*?)(\/?)>/g;

const textOf = (html) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

function parse(html) {
  const root = { name: "#root", children: [], direct: false };
  const stack = [root];
  let last = 0;
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(html))) {
    const top = stack[stack.length - 1];
    if (/\S/.test(html.slice(last, m.index).replace(/&nbsp;/g, ""))) top.direct = true;
    last = TOKEN.lastIndex;
    if (m[0].startsWith("<!--")) continue;
    const [, close, rawName, attrs, selfClose] = m;
    const name = rawName.toLowerCase();
    if (close) {
      const at = stack.findLastIndex((n) => n.name === name);
      if (at <= 0) continue;
      stack[at].innerEnd = m.index;
      stack.length = at;
      continue;
    }
    const node = { name, insertAt: m.index + 1 + rawName.length, innerStart: TOKEN.lastIndex, children: [], direct: false, tagged: /\sdata-e=/.test(attrs) };
    top.children.push(node);
    if (SKIP.has(name)) {
      const end = html.toLowerCase().indexOf(`</${name}`, TOKEN.lastIndex);
      if (end < 0) break;
      TOKEN.lastIndex = last = html.indexOf(">", end) + 1;
      continue;
    }
    if (!VOID.has(name) && !selfClose) stack.push(node);
  }
  return root;
}

export function tagHtml(html) {
  const clean = html.replace(/ data-e="[\w-]+"/g, "");
  const picks = [];
  const walk = (node) => {
    for (const c of node.children) {
      if (SKIP.has(c.name) || VOID.has(c.name) || c.innerEnd == null) continue;
      if (c.direct) picks.push(c);
      else walk(c);
    }
  };
  const root = parse(clean);
  const body = root.children.find((n) => n.name === "html")?.children.find((n) => n.name === "body") || root;
  walk(body);
  const seen = new Map();
  const inserts = picks.map((n) => {
    const text = textOf(clean.slice(n.innerStart, n.innerEnd));
    const base = createHash("sha1").update(`${n.name}|${text}`).digest("hex").slice(0, 8);
    const k = (seen.get(base) || 0) + 1;
    seen.set(base, k);
    return { at: n.insertAt, key: k === 1 ? base : `${base}-${k}` };
  });
  let out = clean;
  for (const { at, key } of inserts.sort((a, b) => b.at - a.at)) out = `${out.slice(0, at)} data-e="${key}"${out.slice(at)}`;
  return { html: out, count: inserts.length };
}

export function tagAll(dir) {
  let files = 0;
  let total = 0;
  const visit = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (f === "assets") continue;
      if (statSync(p).isDirectory()) visit(p);
      else if (f.endsWith(".html")) {
        const { html, count } = tagHtml(readFileSync(p, "utf8"));
        writeFileSync(p, html);
        files++;
        total += count;
      }
    }
  };
  visit(dir);
  return { files, total };
}
