import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = JSON.parse(readFileSync(join(root, "../../packages/brand/brand.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SHORT = {
  "how-to-tell-if-a-photo-is-ai-generated": "Is this photo AI?",
  "how-to-tell-if-a-video-is-real-or-fake": "Is this video real?",
  "how-to-prevent-people-from-stealing-your-art-online": "Stop art theft",
  "what-to-do-if-someone-steals-your-artwork": "Your art was stolen",
  "how-to-file-a-dmca-takedown-on-instagram": "File a takedown",
  "what-are-content-credentials": "Content credentials",
  "social-media-without-algorithm": "A feed you control",
  "instagram-alternative-for-artists": "For artists",
  "open-source-instagram-alternative": "Open source options",
};

export const footerCss = `.ft{background:#0c0a09;color:#f1e7d8;padding:56px 0 36px;font-size:.92rem}
.ft .fw{max-width:1180px;margin:0 auto;padding:0 var(--gutter)}
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
<div class="brandcol"><a class="fmk" href="/" aria-label="${esc(brand.name)}">${mark}${esc(brand.name.toLowerCase())}</a><p class="about">Open source and run as a nonprofit. The code is public and so is the algorithm.</p></div>
${col(brand.name, "", `<li><a href="/#why">Why ${esc(brand.name)}</a></li><li><a href="/#join">Create your account</a></li><li><a href="https://app.${brand.domain}/sign-in">Sign in</a></li><li><a href="${esc(github)}" rel="noopener">GitHub</a></li>`)}
${col("Answers", "/answers/", answers)}
${col("Compare", "/compare/", compare)}
${col("Legal", "", `<li><a href="/privacy/">Privacy</a></li><li><a href="/terms/">Terms</a></li><li><a href="/credits/">Image credits</a></li>`)}
</div><div class="base"><span>&copy; ${year} ${esc(brand.name)}</span><span>${esc(brand.name)} comes from hemera, the Greek word for day</span></div></div></footer>`;
}
