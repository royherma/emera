# Emera fund rules

Version 1.1.0 · 2026-11-13 · changed only through [how-values-change.md](how-values-change.md). The numbers live in one file, `apps/api/src/fundRules.ts`, and every screen reads them from `GET /v1/fund`.

## The deal in one line

Companies sponsor Emera. Every sponsor dollar is split in half: 50 cents goes to the creators people watched that month, 50 cents runs Emera. Every dollar in and out is on the public fund page.

## 1. Who pays in

| Rule | Detail |
| --- | --- |
| Sponsors | A company or person pays an amount for a month. One payment can cover several months; it is booked to each month in equal parts. |
| What a sponsor gets | Its name and link on the fund page, sorted by amount, the month's statement showing where its money went, and a one-line banner marked "Sponsor" at the top of the app feed once we approve its words. |
| In-feed sponsor cards | Only once the network has 1,000 posts (`FEED_CARD_MIN_POSTS`), one card after every 12 posts (`FEED_CARD_EVERY`), always marked "Sponsor". Until then sponsors get the banner only, so the first sponsors fund the early network instead of crowding it. |
| How a sponsor pays | Through Stripe on the fund page: a monthly amount (at least $10, `MIN_MONTHLY_CENTS`) times 1 to 12 months (`MAX_CHECKOUT_MONTHS`), paid once, booked to each month in equal parts. |
| What a sponsor never gets | No boost for any post, no say in ranking, moderation or takedowns, no badge for anyone, no targeting and no viewer data. Every viewer sees the same banner and cards. Sponsors see the same public numbers everyone sees. |
| Who can't sponsor | Anyone a creator here has an open copy report against, and anyone whose money we would have to hide. The board can refuse or return any sponsorship, and the refusal is logged on the fund page. |
| Refunds | A refunded sponsorship comes out of the month it was booked to, before that month closes. After close, it comes out of the next open month and the statement says so. |

## 2. The split

| Rule | Detail |
| --- | --- |
| Creator half | 50% of each month's sponsored money (`CREATOR_SHARE = 0.5`) goes to the creator pool. |
| Emera half | 50% runs Emera: servers, the takedown desk, moderation, staff. It is spent in the open, on the cost page. |
| Who decides the split | Members vote on it each January (the payout-split vote in how-values-change.md). The creator share can go up by a vote; going below 50% is a major change. |

## 3. How the creator half is shared: watch time

Each creator gets the creator pool times their share of the month's counted watch time.

```
your amount = creator pool x (your counted seconds / everyone's counted seconds)
```

Example: sponsors put in $10,000 in March. The creator pool is $5,000. Viewers spent 2,000,000 counted seconds on posts that month and 40,000 of them were on yours (2%). You get $100.

What counts as a watched second:

| Rule | Why |
| --- | --- |
| Only signed-in viewers count | A crowd of logged-out bots counts zero. |
| Your own views never count | You cannot watch yourself into money. |
| A viewer counts at most 60 seconds per photo post and 10 minutes per video post per day (`PHOTO_CAP_S`, `VIDEO_CAP_S`) | Leaving a post open overnight earns nothing extra. |
| A viewer counts at most 30 minutes across all of one creator's posts per day (`CREATOR_CAP_S`) | One superfan or one farm account can't decide who gets paid. |
| A viewer's account must be at least 24 hours old (`MIN_VIEWER_AGE_H`) | Fresh sign-ups made to farm views count zero. |
| Seconds only count while the post is on screen and the app is open | The app reports in 10-second steps (`HEARTBEAT_MAX_S`), never more than 30 at a time. |
| Removed posts lose their seconds | A post taken down as a copy or for breaking the rules earns nothing for that month, and the seconds are given back to everyone else's share. |

Viewer weight by trust tier (values: Real people) replaces the flat rules above once trust tiers ship. Until then every counted second weighs the same.

## 4. Closing a month

| Rule | Detail |
| --- | --- |
| When | Months run in UTC. A month closes on the 3rd of the next month, so late reports and refunds land first. |
| What closing does | Freezes the month: sponsorships, each creator's counted seconds, share and amount. Writes a statement and its SHA-256 fingerprint. A closed month never changes; corrections go into a later month and name the one they fix. |
| Rounding | Each creator's amount is rounded down to the cent. The leftover cents roll into next month's creator pool (`carry`), shown on both statements. Nothing is lost. |
| Months with no watch time | The whole creator pool rolls into next month. |

## 5. Getting paid

| Rule | Detail |
| --- | --- |
| Balance | Your closed-month amounts add up to your balance. |
| Payout | Every quarter (January, April, July, October), to your bank through Stripe, once your balance is at least $10 (`PAYOUT_MIN_CENTS`). Below that it waits for the next quarter and is never lost. |
| Tax | Stripe collects what tax law asks for before the first payout. |

## 6. What is public

| Public on the fund page | Private |
| --- | --- |
| Every sponsor name, link and amount per month | Sponsor contact emails |
| Each month's pool, the 50/50 split, carry, total counted seconds, the statement fingerprint | Who watched what. Viewer ids never leave the database. |
| Each creator's handle, counted seconds, share and amount for every closed month | Bank and tax details |

A creator can ask to be listed as "a creator" instead of their handle on public statements. Their numbers stay in the totals.

## 7. Changing these rules

A change to a number in section 2 or 3 is a minor change (vote). A change that lets money buy ranking, badges, targeting or viewer data is a "never" and cannot pass. 1.1.0 (Roy, 2026-11-13) added the marked banner and the in-feed card gate. Every version of this file stays in git, and each closed statement records the rules version it was computed under.
