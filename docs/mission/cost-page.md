# Public cost page

The mission promises "a live page of what running Emera costs this month" (`mission.md`, value on transparency). This is the spec and first version.

## What ships

- URL: `https://emera.social/costs/`, linked from the site footer (Emera column) on every page and listed in `sitemap.xml`.
- Data: one file, `apps/site/content/costs.json`. The page is generated from it by `apps/site/scripts/costs.mjs` during `node apps/site/scripts/build.mjs`. No other numbers are typed into the page.
- Every line carries `monthly_usd`, `basis` (paid, free plan, or free allowance not yet checked against an invoice) and a `source` with a label and URL. A line without a source does not ship.
- Sections: this month's bills with a total (computed from the lines), who pays, and a modelled table (1,000 / 10,000 / 100,000 creators) copied from `docs/architecture.md` section 5 and labelled "a calculation, not a bill".

## Data source decision

`apps/notify` `/api/ledger` (proxied at `emera.social/api/ledger`) counts accounts, posts, early signups and reports. It holds no money figures, so it cannot supply costs. The page reads it only for one live line, accounts on Emera right now (`totals.accounts`), and hides that line if the call fails. A second costs endpoint was not built: costs change monthly and a reviewed JSON file in git gives a public history.

## Monthly update

1. Open each provider invoice (Cloudflare, Resend, registrar).
2. Edit `costs.json`: `month`, `updated`, each `monthly_usd`, `basis`, `source`.
3. Rebuild and deploy the site.

A line moves from "not yet checked against an invoice" to "Paid" only when someone has read the invoice.

## Not in v1

- Income lines (donations, grants, Premium). When the first one exists, add an `income` array in the same shape and a second table.
- Past months. Keep the git history of `costs.json` for now; add an archive list when there are three months.
- People costs. The model table excludes them, as `architecture.md` section 5 does.
