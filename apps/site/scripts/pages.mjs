import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = JSON.parse(readFileSync(join(root, "../../packages/brand/brand.json"), "utf8"));
const SITE = `https://${brand.domain}`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const load = (f) => (existsSync(join(root, "content", f)) ? JSON.parse(readFileSync(join(root, "content", f), "utf8")) : []);

export const pages = [...load("answers.json"), ...load("compare.json")].map((p) => ({
  ...p,
  path: `/${p.kind === "compare" ? "compare" : "answers"}/${p.slug}/`,
}));
const bySlug = new Map(pages.map((p) => [p.slug, p]));

const SAFE_TAGS = /<(?!\/?(p|ul|ol|li|strong|em|a)(\s+href="[^"]*"(\s+rel="[^"]*")?)?\s*>)[^>]*>/gi;
const clean = (html) =>
  String(html)
    .replace(SAFE_TAGS, "")
    .replace(/<a href="(https?:[^"]+)">/g, '<a href="$1" rel="noopener">')
    .replace(/<a href="\/(?:answers\/|compare\/)?([a-z0-9-]+)\/?">/g, (m, s) => (bySlug.has(s) ? `<a href="${bySlug.get(s).path}">` : m));

const mark = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc24a"/><stop offset="1" stop-color="#ff6a2b"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="currentColor"/><path d="M4 50a46 46 0 0 1 92 0z" fill="url(#sg)"/><path d="M0 50h100" stroke="var(--bg,#fbf5ea)" stroke-width="6"/></svg>`;

const css = `:root{--sun:#ff8a2b;--sun2:#ffc24a;--bg:#fbf5ea;--bg2:#f3e8d5;--ink:#2a1d14;--ink2:#6b5846;--ink3:#9a8672;--card:#fffaf1;--line:rgba(60,35,10,.12);--sunink:#9a4a00;--disp:"Sora",ui-sans-serif,system-ui,sans-serif;--body:"DM Sans",ui-sans-serif,system-ui,sans-serif;--gutter:clamp(16px,5vw,72px);color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0c0a09;--bg2:#14110f;--ink:#fbf3e8;--ink2:#bcae9d;--ink3:#8a7c6d;--card:#1a1613;--line:rgba(255,235,210,.12);--sunink:#ffc98a;color-scheme:dark}}
:root[data-theme=dark]{--bg:#0c0a09;--bg2:#14110f;--ink:#fbf3e8;--ink2:#bcae9d;--ink3:#8a7c6d;--card:#1a1613;--line:rgba(255,235,210,.12);--sunink:#ffc98a;color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:18px/1.6 var(--body);-webkit-font-smoothing:antialiased}
a{color:inherit;text-underline-offset:3px}
.wrap{max-width:820px;margin:0 auto;padding:0 var(--gutter)}
.nav{display:flex;align-items:center;justify-content:space-between;padding:22px 0}
.mk{display:flex;align-items:center;gap:10px;font:700 1.35rem var(--disp);letter-spacing:-.04em;text-decoration:none}
.mk svg{width:30px;height:30px;color:var(--ink)}
.pill{background:linear-gradient(180deg,var(--sun2),var(--sun));color:#2a1406;font-weight:700;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:.95rem}
.crumbs{margin-top:28px;font-size:.85rem;color:var(--ink3)}
.crumbs a{text-decoration:none}
h1{margin-top:10px;font:700 clamp(2rem,5vw,3.3rem)/1.05 var(--disp);letter-spacing:-.045em;text-wrap:balance}
.short{margin-top:24px;padding:20px 22px;border-radius:20px;background:var(--card);border:1px solid var(--line);font-size:1.08rem}
.short b{display:block;font:600 .74rem var(--body);letter-spacing:.14em;text-transform:uppercase;color:var(--sunink);margin-bottom:6px}
h2{margin-top:44px;font:700 clamp(1.35rem,2.6vw,1.75rem)/1.2 var(--disp);letter-spacing:-.03em}
.body p,.body li{margin-top:12px;color:var(--ink)}
.body ul,.body ol{padding-left:22px}
.tw{margin-top:18px;overflow-x:auto;border-radius:16px;border:1px solid var(--line)}
table{width:100%;border-collapse:collapse;font-size:.92rem;min-width:520px}
th,td{padding:11px 14px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
thead th{background:var(--bg2);font-weight:700}
tbody th{font-weight:600;color:var(--ink2)}
details{margin-top:12px;padding:14px 18px;border-radius:16px;background:var(--card);border:1px solid var(--line)}
summary{cursor:pointer;font-weight:600}
details p{margin-top:8px;color:var(--ink2)}
.src{margin-top:12px;font-size:.88rem;color:var(--ink2)}
.src li{margin-top:6px;word-break:break-word}
.rel{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:14px}
.rel a{display:block;padding:16px 18px;border-radius:16px;border:1px solid var(--line);background:var(--card);text-decoration:none;font-weight:600}
.join{margin:56px 0 0;padding:32px clamp(20px,4vw,36px);border-radius:28px;background:linear-gradient(180deg,#fff2dc,#f8d3a6);color:#2a1d14}
.join h2{margin-top:0}
.join p{margin-top:8px}
.signup{display:flex;gap:8px;margin-top:18px;padding:6px;border-radius:999px;background:#fffaf1;max-width:520px}
.signup input{flex:1;min-width:0;border:0;background:none;padding:10px 14px;font:inherit;color:#2a1d14;outline:none}
.signup button{border:0;border-radius:999px;padding:12px 20px;font:700 1rem var(--body);background:linear-gradient(180deg,var(--sun2),var(--sun));color:#2a1406;cursor:pointer}
.hp{position:absolute;left:-9999px}
.note{margin-top:10px;font-size:.92rem;min-height:1.4em}
.note.err{color:#a3240f}
footer{margin-top:64px;padding:36px 0 44px;border-top:1px solid var(--line);font-size:.92rem;color:var(--ink2)}
footer ul{list-style:none;display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:10px}
.checked{margin-top:22px;font-size:.82rem;color:var(--ink3)}
@media (max-width:560px){.signup{flex-direction:column;border-radius:20px}.signup button{width:100%}}`;

const themeBoot = `<script>(function(){try{var s=localStorage.getItem("emera-theme");if(s)document.documentElement.setAttribute("data-theme",s)}catch(e){}})()</script>`;

const signupJs = `<script>(function(){var f=document.querySelector("[data-signup]");if(!f)return;var n=f.parentElement.querySelector("[data-note]"),b=f.querySelector("button");f.addEventListener("submit",function(e){e.preventDefault();var em=f.email.value.trim();n.className="note";if(!/^[^\\s@]+@[^\\s@.]+(\\.[^\\s@.]+)+$/.test(em)){n.textContent="That email does not look right. Check it and try again.";n.classList.add("err");return}b.disabled=true;fetch("/api/early",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:em,website:f.website.value,source:f.dataset.source,referrer:document.referrer})}).then(function(r){return r.json()}).then(function(j){if(!j.ok)throw 0;n.textContent=j.already?"You are already on the list.":"You are in. We will email you when your account is ready.";f.reset()}).catch(function(){n.textContent="Something went wrong on our side. Try again in a moment.";n.classList.add("err")}).finally(function(){b.disabled=false})})})()</script>`;

const head = ({ title, description, path, ld }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(brand.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/assets/og.png">
<meta name="color-scheme" content="light dark">
${themeBoot}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&display=swap" rel="stylesheet">
<style>${css}</style>
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>`;

const nav = `<nav class="nav"><a class="mk" href="/">${mark}${esc(brand.name.toLowerCase())}</a><a class="pill" href="/#join">Create your account</a></nav>`;

const joinBox = (source) => `<section class="join" id="join">
<h2>Put it out in the daylight</h2>
<p>Your work, your news, your next event, each with proof of who shared it. Join the first people on ${esc(brand.name)}.</p>
<form class="signup" data-signup data-source="${esc(source)}" novalidate><input type="email" name="email" placeholder="you@email.com" autocomplete="email" aria-label="Email address" required><input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><button type="submit">Create your account</button></form>
<p class="note" data-note role="status" aria-live="polite"></p>
</section>`;

export const guideLinks = () => pages.map((p) => `<li><a href="${p.path}">${esc(p.q)}</a></li>`).join("");

const foot = () => `<footer><div><a class="mk" href="/">${mark}${esc(brand.name.toLowerCase())}</a></div><p style="margin-top:12px">${esc(brand.name)} is open source and run as a nonprofit.</p><ul>${guideLinks()}</ul></footer>`;

const crumbsFor = (p) => {
  const sec = p.kind === "compare" ? { name: "Compare", path: "/compare/" } : { name: "Answers", path: "/answers/" };
  return { sec, html: `<div class="crumbs"><a href="/">${esc(brand.name)}</a> / <a href="${sec.path}">${sec.name}</a></div>` };
};

const table = (t) =>
  t ? `<div class="tw"><table><thead><tr>${t.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead><tbody>${t.rows.map((r) => `<tr><th scope="row">${esc(r[0])}</th>${r.slice(1).map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : "";

function page(p) {
  const { sec, html: crumbs } = crumbsFor(p);
  const url = `${SITE}${p.path}`;
  const faqs = [{ q: p.q, a: p.short }, ...(p.faqs || [])];
  const ld = [
    { "@context": "https://schema.org", "@type": "Article", headline: p.q, description: p.description, dateModified: p.checked, datePublished: p.checked, mainEntityOfPage: url, image: `${SITE}/assets/og.png`, author: { "@type": "Organization", name: brand.name, url: SITE }, publisher: { "@type": "Organization", name: brand.name, url: SITE } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: brand.name, item: `${SITE}/` }, { "@type": "ListItem", position: 2, name: sec.name, item: `${SITE}${sec.path}` }, { "@type": "ListItem", position: 3, name: p.q, item: url }] },
  ];
  const related = (p.related || []).map((s) => bySlug.get(s)).filter(Boolean);
  return `${head({ title: p.title, description: p.description, path: p.path, ld })}
<body><div class="wrap">${nav}
<main>
${crumbs}
<h1>${esc(p.q)}</h1>
<div class="short"><b>Short answer</b>${esc(p.short)}</div>
<div class="body">
${p.table ? `<h2>Side by side</h2>${table(p.table)}` : ""}
${p.they_win?.length ? `<h2>Where the others are the better pick</h2><ul>${p.they_win.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
${(p.sections || []).map((s) => `<h2>${esc(s.h)}</h2>${clean(s.html)}`).join("\n")}
${p.faqs?.length ? `<h2>People also ask</h2>${p.faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}` : ""}
${related.length ? `<h2>Related</h2><div class="rel">${related.map((r) => `<a href="${r.path}">${esc(r.q)}</a>`).join("")}</div>` : ""}
${p.sources?.length ? `<h2>Sources</h2><ol class="src">${p.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.label)}</a></li>`).join("")}</ol>` : ""}
<p class="checked">Checked ${esc(p.checked)}.</p>
</div>
${joinBox(`${p.kind}-${p.slug}`)}
</main>
${foot()}</div>${signupJs}</body></html>`;
}

function hub(kind, name, path, intro) {
  const list = pages.filter((p) => p.kind === kind);
  const ld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: `${name} | ${brand.name}`, url: `${SITE}${path}`, hasPart: list.map((p) => ({ "@type": "Article", headline: p.q, url: `${SITE}${p.path}` })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: brand.name, item: `${SITE}/` }, { "@type": "ListItem", position: 2, name, item: `${SITE}${path}` }] },
  ];
  return `${head({ title: `${name} | ${brand.name}`, description: intro, path, ld })}
<body><div class="wrap">${nav}
<main><div class="crumbs"><a href="/">${esc(brand.name)}</a></div>
<h1>${esc(name)}</h1><p class="short">${esc(intro)}</p>
<div class="rel">${list.map((p) => `<a href="${p.path}">${esc(p.q)}</a>`).join("")}</div>
${joinBox(`${kind}-hub`)}</main>
${foot()}</div>${signupJs}</body></html>`;
}

export function writePages(today) {
  const out = join(root, "public");
  const write = (path, html) => {
    const dir = join(out, path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
  };
  for (const p of pages) write(p.path, page(p));
  const hubs = [];
  if (pages.some((p) => p.kind === "answer")) {
    write("/answers/", hub("answer", "Answers", "/answers/", "Plain answers on telling real from fake, protecting your work and finding a feed you control."));
    hubs.push("/answers/");
  }
  if (pages.some((p) => p.kind === "compare")) {
    write("/compare/", hub("compare", "Compare", "/compare/", `How ${brand.name} sits next to the other places people share their work, with where each one is the better pick.`));
    hubs.push("/compare/");
  }
  const urls = [{ loc: "/", lastmod: today }, ...hubs.map((h) => ({ loc: h, lastmod: today })), ...pages.map((p) => ({ loc: p.path, lastmod: p.checked }))];
  writeFileSync(join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE}${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join("\n")}\n</urlset>\n`);
  const bots = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "Google-Extended", "Bingbot"];
  writeFileSync(join(out, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /api/\n\n${bots.map((b) => `User-agent: ${b}`).join("\n")}\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
  writeFileSync(join(out, "llms.txt"), `# ${brand.name}\n\n> ${brand.name} (${brand.domain}) is an open-source, nonprofit social network on the AT Protocol for people who make things and people sharing what is happening around them. Tagline: ${brand.tagline}.\n\n## Facts an assistant can quote\n\n- Every post carries a signed record (C2PA content credentials) of who shared it and when it went up; the badge states only what was checked.\n- People are marked, automated accounts are labeled, and the verified human mark is free.\n- Creators who find a copy of their work can report it, and ${brand.name} helps them file the takedown.\n- Accounts are portable: a member can move their account and followers to another AT Protocol host.\n- ${brand.name} comes from hemera, the Greek word for day.\n\n## Answers\n\n${pages.map((p) => `- [${p.q}](${SITE}${p.path}): ${p.description}`).join("\n")}\n`);
  return urls.length;
}
