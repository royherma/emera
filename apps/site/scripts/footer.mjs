import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = JSON.parse(readFileSync(join(root, "../../packages/brand/brand.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SHORT = {
  "how-to-tell-if-a-photo-is-ai-generated": "Is this photo AI?",
  "how-to-tell-if-a-video-is-real-or-fake": "Is this video real?",
  "how-to-prevent-people-from-stealing-your-art-online": "Stop creative theft",
  "what-to-do-if-someone-steals-your-artwork": "Your work was copied",
  "how-to-file-a-dmca-takedown-on-instagram": "File a takedown",
  "what-are-content-credentials": "Content credentials",
  "social-media-without-algorithm": "A feed you control",
  "instagram-alternative-for-artists": "For artists",
  "open-source-instagram-alternative": "Open source options",
};

const GH_MARK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
const STAR = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 .25a.75.75 0 01.67.42l1.88 3.81 4.2.61a.75.75 0 01.42 1.28l-3.04 2.96.72 4.19a.75.75 0 01-1.09.79L8 12.33l-3.76 1.98a.75.75 0 01-1.09-.79l.72-4.19L.83 6.37a.75.75 0 01.42-1.28l4.2-.61L7.33.67A.75.75 0 018 .25z"/></svg>';

export const starButton = (github) => `<a class="gh" href="${esc(github)}" rel="noopener" aria-label="Star ${esc(brand.name)} on GitHub">${GH_MARK}<span class="ghl">${STAR}Star</span><span class="ghn" data-stars hidden></span></a>`;

export const starScript = `<script>fetch("/api/stars").then(function(r){return r.json()}).then(function(d){if(!(d.stars>=10))return;var n=d.stars>=1000?(d.stars/1000).toFixed(1).replace(/\\.0$/,"")+"k":String(d.stars);document.querySelectorAll("[data-stars]").forEach(function(e){e.textContent=n;e.hidden=false})}).catch(function(){})</script>`;

export const footerCss = `.gh{display:inline-flex;align-items:stretch;border-radius:999px;border:1px solid var(--gh-line,var(--line));background:var(--gh-bg,color-mix(in srgb,var(--ink) 6%,transparent));color:var(--gh-ink,var(--ink));font:600 .92rem/1 var(--body);text-decoration:none;overflow:hidden;transition:background .15s,border-color .15s}
.gh:hover{background:var(--gh-hover,color-mix(in srgb,var(--ink) 12%,transparent))}
.gh>svg{width:18px;height:18px;margin:0 0 0 14px;align-self:center}
.gh .ghl{display:inline-flex;align-items:center;gap:6px;padding:11px 16px 11px 9px}
.gh .ghl svg{width:14px;height:14px;color:var(--sun)}
.gh .ghn{display:inline-flex;align-items:center;padding:0 14px;border-left:1px solid var(--gh-line,var(--line));font-variant-numeric:tabular-nums}
.gh .ghn[hidden]{display:none}
.ft .gh{margin-top:18px;--gh-line:rgba(255,235,210,.18);--gh-bg:rgba(255,235,210,.06);--gh-hover:rgba(255,235,210,.12);--gh-ink:#fbf3e8}
.ft .gh:hover{color:#fbf3e8}
.ft{background:#0c0a09;color:#f1e7d8;padding:56px 0 36px;font-size:.92rem}
.ft .fw{max-width:1360px;margin:0 auto;padding:0 var(--gutter)}
.ft .cols{display:grid;grid-template-columns:1.4fr repeat(4,1fr);gap:32px 28px}
.ft .fmk{display:inline-flex;align-items:center;gap:10px;font:700 1.35rem var(--disp);letter-spacing:-.04em;color:#fbf3e8;text-decoration:none}
.ft .fmk svg{width:30px;height:30px;color:#fbf3e8;--bg:#0c0a09}
.ft .about{margin-top:12px;max-width:22em;color:rgba(241,231,216,.7);line-height:1.5}
.ft h3{font:600 .74rem var(--body);letter-spacing:.14em;text-transform:uppercase;color:rgba(241,231,216,.5);margin:0}
.ft h3 a{color:inherit;text-decoration:none}
.ft ul{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:10px}
.ft li a{color:rgba(241,231,216,.85);text-decoration:none}
.ft a:hover{color:#ffc24a}
.ft .base{margin-top:44px;padding-top:20px;border-top:1px solid rgba(255,235,210,.12);display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between;font-size:.82rem;color:rgba(241,231,216,.5)}
@media (max-width:900px){.ft .cols{grid-template-columns:1fr 1fr}.ft .brandcol{grid-column:1/-1}}`;

export function footer({ pages, mark, github, year }) {
  const link = (p) => `<li><a href="${p.path}">${esc(SHORT[p.slug] || p.q)}</a></li>`;
  const col = (title, href, items) => `<nav aria-label="${esc(title)}"><h3>${href ? `<a href="${href}">${esc(title)}</a>` : esc(title)}</h3><ul>${items}</ul></nav>`;
  const answers = pages.filter((p) => p.kind === "answer").map(link).join("");
  const compare = pages.filter((p) => p.kind === "compare").map(link).join("");
  return `<footer class="ft"><div class="fw"><div class="cols">
<div class="brandcol"><a class="fmk" href="/" aria-label="${esc(brand.name)}">${mark}${esc(brand.name.toLowerCase())}</a><p class="about">Open source and run as a nonprofit. The code is public and so is the algorithm.</p>${starButton(github)}</div>
${col(brand.name, "", `<li><a href="/#why">Why ${esc(brand.name)}</a></li><li><a href="/#join">Create your account</a></li><li><a href="/costs/">What Emera costs</a></li><li><a href="/brand/">Brand</a></li><li data-fund><a href="/fund/">Fund</a></li><li><a href="/sign-in">Sign in</a></li><li><a href="${esc(github)}" rel="noopener">GitHub</a></li>`)}
${col("Answers", "/answers/", answers)}
${col("Compare", "/compare/", compare)}
${col("Legal", "", `<li><a href="/privacy/">Privacy</a></li><li><a href="/terms/">Terms</a></li><li><a href="/credits/">Image credits</a></li>`)}
</div><div class="base"><span>&copy; ${year} ${esc(brand.name)}</span><span>${esc(brand.name)} comes from hemera, the Greek word for day</span></div></div></footer>${starScript}`;
}
