# Video views

Snapshot 2026-11-13. How the big platforms count a view, and the rule Emera uses.

## How others count

| Platform | What the public number counts | Real-watch number | Who the views came from |
| --- | --- | --- | --- |
| YouTube Shorts | Every start or replay, no minimum, since 2025-03-31 ([TechCrunch](https://techcrunch.com/2025/03/26/youtube-is-changing-how-youtube-shorts-views-are-counted)) | "Engaged views" (the old rule, a few seconds) hidden in Analytics; pay still uses it | Not shown |
| YouTube long videos | About 30 s of watching, never published by YouTube ([mediacube](https://mediacube.io/en/blog/how-does-youtube-count-views)); counts freeze and get re-checked, fake views removed in waves without telling the creator | Same | Not shown |
| Instagram Reels | Every start or replay; "plays" were renamed "views" 2025-04-21 ([SocialPilot](https://www.socialpilot.co/instagram-marketing/instagram-views-metrics-changes)) | None public | Not shown |
| Facebook | Unified "views" since 2025; 3-second and 1-minute views kept in Insights ([Meta](https://creators.facebook.com/introducing-views-to-simplify-content)) | 3 s views | Not shown |
| TikTok | Each time play starts; sources disagree on replays and the maker's own plays ([admanage](https://admanage.ai/blog/how-does-tiktok-count-views)) | None public | Not shown |
| Ad industry (MRC) | A video counts when half of it is on screen for 2 seconds in a row ([publift](https://publift.com/blog/mrc-viewability)) | That is the rule | - |

What they share: the headline number grew in 2025 because replays and zero-second plays count, the stricter number is hidden in analytics, the cleaning of fake views is secret, and no creator can see where a view came from.

## Emera's rule

`A view is one signed-in person who watched at least 2 seconds with half the video on screen. Each person counts once and the maker's own plays don't count.`

| Choice | Why |
| --- | --- |
| 2 s with half on screen, in a row | The ad industry's own standard (MRC), the only public one; stricter than a zero-second play |
| One person counts once | A replay loop or a refresh script cannot grow the number. The number means "people", not "plays" |
| Only signed-in accounts | A logged-out play is one curl away from a fake view |
| The maker never counts | Your own plays are not reach |
| Public ledger per post (`GET /v1/posts/:id/views`) | Anyone can check the count: one row per view with a code that changes per post (so nobody can follow a person across posts), the hour, follower or not, account age. Totals match the rows |

The app starts the 2 s timer only while the video plays and at least 60% of it is on screen (`apps/mobile/src/components/Media.tsx`), and sends the view once per post per app session (`apps/mobile/src/state/views.ts`).

## Next

- Weight each view by the viewer's trust tier once tiers exist (values: "weight every like and follow by the giver's tier").
- Exclude accounts that declare themselves automated, and show them as a separate number in the ledger.
- A clip shorter than 2 s never counts today; count it when played to the end.
- Watch-time and finish rate for the maker only, under Insights.
