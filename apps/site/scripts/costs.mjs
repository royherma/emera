import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const costs = JSON.parse(readFileSync(join(root, "content/costs.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const usd = (n) => `$${n.toFixed(2)}`;
const src = (s) => `<a href="${esc(s.url)}" rel="noopener">${esc(s.label)}</a>`;
const monthName = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const FILE = "https://github.com/royherma/emera/blob/main/apps/site/content/costs.json";

export const total = costs.lines.reduce((n, l) => n + l.monthly_usd, 0);
export const costsShort = `Emera is a nonprofit built in the open, so the money is open too. Every bill for ${monthName(costs.month)} is below with who pays it and where each number comes from. Total: ${usd(total)} a month.`;

export function costsBody() {
  const m = costs.model;
  const rows = costs.lines
    .map((l) => `<tr><th scope="row">${esc(l.item)}<small>${esc(l.detail)}</small></th><td class="n">${usd(l.monthly_usd)}</td><td>${esc(l.basis)}</td><td>${src(l.source)}</td></tr>`)
    .join("");
  const model = `<div class="tw sm"><table><thead><tr>${m.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead><tbody>${m.rows.map((r) => `<tr><th scope="row">${esc(r[0])}</th>${r.slice(1).map((c) => `<td class="n">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  return `<h2>${esc(monthName(costs.month))}</h2>
<div class="tw"><table><thead><tr><th scope="col">Bill</th><th scope="col">A month</th><th scope="col">How we know</th><th scope="col">Source</th></tr></thead><tbody>${rows}<tr class="tot"><th scope="row">Total</th><td class="n">${usd(total)}</td><td></td><td></td></tr></tbody></table></div>
<h2>Who pays</h2>
<p>${esc(costs.paidBy.who)}, the company that started Emera, pays every bill above (${src(costs.paidBy.source)}). When the network earns more than it costs to run, the surplus goes back to the people who made it worth visiting.</p>
<p class="live">Accounts on Emera right now: <b data-accounts>...</b>, counted in the <a href="/ledger">open ledger</a>.</p>
<h2>${esc(m.title)}</h2>
<p>${esc(m.note)}</p>
${model}
<p class="src">Source: ${src(m.source)}</p>
<p class="src">Every number on this page comes from <a href="${FILE}" rel="noopener">one public file</a>. Spot a wrong one, open an issue on GitHub.</p>
<script>fetch("/api/ledger").then(function(r){return r.json()}).then(function(d){var n=d&&d.totals&&d.totals.accounts;if(typeof n!=="number")throw 0;document.querySelectorAll("[data-accounts]").forEach(function(e){e.textContent=n.toLocaleString("en-US")})}).catch(function(){var p=document.querySelector(".live");if(p)p.hidden=true})</script>`;
}

export const costsCss = `td.n{font-variant-numeric:tabular-nums;white-space:nowrap}
.sm table{min-width:0}
.sm th,.sm td{padding:10px 8px}
tr.tot th,tr.tot td{font-weight:700;background:var(--bg2)}
th small{display:block;margin-top:2px;font-weight:400;font-size:.85rem;color:var(--ink3)}
.body .src{margin-top:12px}`;
