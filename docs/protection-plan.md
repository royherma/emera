# Emera Protect: paid protection, sold now (2026-11-23)

Roy, 2026-11-23: sell content protection end to end now. Creators sign up, upload or connect Instagram, we scan for copies and file the takedowns. Tiers: $10/mo and $100/mo unlimited (the $100 one for bigger names and brands), plus Enterprise / custom sold by Roy. Roy's own account is customer zero and the SEO case study.

This replaces "Protection v1 is manual, no scanning before M3" (CLAUDE.md product rules, master-plan section 1). Steps live in `data/plan.json` phase `protect`; picks for Roy are on the Review screen (`protect-pricing`).

## The loop we sell

```
sign up (email code) -> pick plan (Stripe, Emera acct) -> add work
   add work = upload | connect Instagram | paste links | Bluesky/RSS (exists)
        |
weekly scan per work: Google Lens (SerpAPI) + PDQ hash check + Claude vision judge
        |
"Found copies" inbox -> creator taps Take it down (or auto on $100)
        |
notice built from signed original + creator's sworn statement (signed once at signup)
   -> email to host's DMCA agent | platform form (Meta, TikTok, YouTube, Pinterest, Etsy, Amazon)
        |
recheck URL daily -> Removed -> shareable receipt card -> SEO case page
```

## Tiers (updated 2026-11-26)

Roy, 2026-11-26 9:32 AM Bangkok: anyone gets **free protection** by signing in and turning it on (one tap, no card). Money we recover is split **50/50 on Free** and **80/20 (creator keeps 80%) on every paid plan**. This replaces the 70/30 split for everyone.

| Plan | Price | What | Money recovery, creator keeps |
| --- | --- | --- | --- |
| Free | $0, opt in after sign-in | 10 newest posts scanned every 30 days, one-tap takedowns, fan-spotted copies, own reports | 50% |
| Creator | $10/mo | Up to 100 posts, weekly scan, unlimited takedowns | 80% |
| Pro | $100/mo | Unlimited posts, new posts daily, whole-clip video, fake accounts on name or face, auto-filing, priority desk | 80% |
| Enterprise | custom | Rosters for agencies, labels and brands | 80% (or as quoted) |

- **Opt-in** (`POST /v1/protect/opt-in`, `users.protect_opt_in_at`, `users.protect_terms = "free-2026-11-26"`, migration 0033): the tap is the creator's authorization for Emera to send copyright notices for their posts. Never opted in without the tap; `/protect?optin=1` only focuses the card. Turn off any time (`/v1/protect/opt-out`).
- **ASSUMED: Free = 10 newest posts every 30 days** because scans cost money (Lens via SerpAPI) and Free has to stay cheap; reverse by changing the limit in `apps/api/src/scan.ts`.
- **Route advisor** (`POST /v1/protect/advise`, `apps/api/src/advise.ts`): fixed rules rank the cheapest route that works (free takedown or impersonation report first; claim letter when they made money; US registration when unregistered; Copyright Claims Board for US claims under $30k; partner lawyer only when registered in time) and the cheapest plan that covers the case (Free, Creator for weekly posters or money cases, Pro for fake accounts or daily posters). Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, billed to the Emera Cloudflare account, free daily allowance first) only writes the 2-3 sentence summary from those fixed facts; a template is used when AI fails or after 20 calls per hour per visitor. Every answer is logged as `[advise]`. Shown on `/tools/case-worth/`.

## What already exists (read 2026-11-23)

| Piece | State |
| --- | --- |
| Sign-up, email code, accounts | live on emera.social, prod has 6 users, 11 posts, 0 reports |
| Report a copy + My reports + proof sheet | merged (`be27961`), `apps/api/src/reports.ts` |
| Stripe, own Emera account, live | `apps/api/src/fund.ts` does one-off checkout, no subscriptions yet |
| Instagram sign-in + import reels | branch `feat/instagram-import` (2 commits, unmerged); needs `INSTAGRAM_APP_ID/SECRET` + Meta app review for non-testers |
| Bluesky / Mastodon / RSS import, auto-post | live |
| PDQ hash + C2PA signing | `spikes/provenance`: survives resize/recompress, fails at 2% crop and mirror flip |

## Measured: what the scanner can see

Google Lens via SerpAPI on a heavily copied image (Lenna): 60 visual matches, **0 from Instagram, TikTok, Facebook, Pinterest, X or YouTube** (Reddit, Wikipedia, WIRED, Guardian...). Lens sees the open web, not inside the closed apps. So:

- Open web (Pinterest boards, Etsy / Redbubble / Amazon merch, blogs, Reddit) = Lens scan. This is where stolen work makes money, so it is a real product.
- Inside Instagram / Facebook: apply to **Meta Rights Manager** as an agent for our creators (Meta scans its own apps). Fallback: hashtag / caption-keyword search of the creator's niche + creator-pasted links.
- TikTok / YouTube: no open scanner for third parties `[inferred]`; Pro tier gets caption/keyword search and frame-matching on what it finds; YouTube Content ID through a partner later.
- SerpAPI is on the Free plan (250/mo, 16 left after these tests). Paid starts $75/mo for 5,000 searches.

Copy on the site must say "the open web and what you report" until Rights Manager is approved (master-plan kill-risk line still holds).

## Build order (fast)

| # | Step | Days |
| --- | --- | --- |
| 1 | `/protect` page on emera.social: hook, 3 tiers, Enterprise form -> Slack #emera-events | 0.5 |
| 2 | Stripe subscriptions ($10 / $100 prices on the Emera account), `plan` on users, webhook | 0.5 |
| 3 | Merge Instagram import; bulk upload; "add work" flow ends on "We are watching N works" | 1 |
| 4 | Scanner: cron per work, Lens + PDQ + Claude vision judge, `matches` table, "Found copies" screen | 1.5 |
| 5 | Takedown engine: notice builder, DMCA agent lookup, email via Resend, platform-form desk queue, daily recheck, receipt card | 2 |
| 6 | Desk page in notify `/admin`: every open takedown, one-click file, status | 0.5 |
| 7 | Roy = customer zero: import his IG, scan, file real takedowns, publish receipts | 1 |
| 8 | SEO: answer pages "how to take down a stolen reel / art on Etsy / ..." + case pages from receipts | 1 |

## Blockers and risks

| Risk | Fix |
| --- | --- |
| Acting as the creator's agent needs their sworn statement and authorization | Signup step: one checkbox with the DMCA 512(c)(3) statements, stored with time + IP; counsel review before Brand tier |
| False takedown liability (512(f)) | Human (creator or desk) confirms every Creator-tier notice; auto-file only on PDQ exact match on Pro |
| Meta app review not filed | Draft ready in `docs/meta/instagram-app-review.md`; needs `IG_APP_ID` + Roy's submit |
| Nonprofit + selling | Paid tiers fund the nonprofit; Free tier keeps free filing |
| Closed platforms invisible | Rights Manager application; never claim "we scan Instagram" until it works |

## Sources

- [Pixsy pricing on GetApp](https://www.getapp.com/all-software/a/pixsy/)
- [Ceartas: DMCA services list](https://www.ceartas.io/blog/best-dmca-takedown-services), [Ceartas llms.txt](https://www.ceartas.io/llms.txt)
- [Rulta and others, roundup](https://creatorgrowlabs.pages.dev/tools/dmca-services/)
- [SerpAPI plans, third-party summary](https://scrapegraphai.com/blog/serpapi-pricing)
- [Meta IP Reporting API](https://developers.facebook.com/blog/post/2022/10/25/introducing-intellectual-property-reporting-api/)
