# Launch metrics

Written 2026-11-13. Every target below is a plan, not a result. The first two communities and the first week of real traffic recalibrate them. No Emera numbers exist yet.

## The funnel

```
Visit                    31,000
  | 12%
Started sign-up           3,700   (email typed on the site)
  | 54%
Account                   2,000   (code entered, account made)
  | 50%
First post                1,000   <- the goal: 1,000 creators who posted
  | 35%
First share                 350   (a creator shares a post link or badge off Emera)
```

Biggest expected drop after the first screen: account to first post (50% lost). Cause to test first: a new account has nothing ready to post, or the first post asks for too much. Fix lever: a one-tap first post and a welcome email with one clear ask. Second drop: started sign-up to account (46% lost), where the person has to find the code in their inbox.

| Step | Definition (exactly what is counted) | Target conversion | Count at target | Where it is measured |
| --- | --- | --- | --- | --- |
| Visit | unique visitor to emera.social or a launch landing path, bots excluded, our own traffic excluded (`X-TG-Tester: 1`) | n/a | 31,000 | site analytics |
| Started sign-up | an email typed on the site (it goes straight to /sign-in) | 12% of visits | 3,700 | site D1 table `early_access` |
| Account | the person enters the code and an account is created | 54% of started | 2,000 | API accounts table |
| First post | the account publishes at least one post with a proof badge | 50% of accounts | 1,000 | API posts table |
| First share | a post link or badge is opened from outside Emera, or a share-card is created, within 14 days of first post | 35% of first posts | 350 | share-card creations plus referrer on `/p/:id` |

### Why these rates

| Rate | Reasoning | How it could be wrong |
| --- | --- | --- |
| 12% visit to sign-up | a focused landing page with one field and a specific promise, from a warm source (community post, founder video), converts well above a cold average; ASSUMED, not measured | cold sources (press, Hacker News) will be 2% to 5%; the blend lands lower if the founder's audience is small |
| 54% started to account | the account is open, the code arrives by email in seconds and the next screen is the app; ASSUMED, not measured | the code email lands in spam, or the person only wanted to look; this falls under 35% |
| 50% account to first post | creators have work ready; first post is one tap; the founding offer rewards posting in week 1; ASSUMED, lower than a pre-vetted audience because anyone can now make an account | if the app asks for too much at the first post (proof setup, bio), this falls under 30% |
| 35% first post to first share | the badge and share card exist to be pasted elsewhere; founding creators get a prompt after posting | creators may share with a screenshot, which this does not count; the real rate is likely higher than measured |

### By channel

Expect different rates per source. Track them separately so we learn which channel to push.

| Channel | Visit to sign-up (target) | Started sign-up to post (target) | Note |
| --- | --- | --- | --- |
| Wedge communities | 15% | 30% | they came for the protection promise |
| Founder audience | 6% | 22% | curious followers, lower intent |
| Bluesky and AT Protocol apps | 10% | 28% | familiar with accounts they own |
| Guilds | 20% | 32% | small, high trust |
| Press, Product Hunt, Hacker News | 4% | 18% | broad, low intent |
| Referrals | 35% | 40% | sent by a friend |

Blended, these give the 12% and 27% in the funnel above (54% x 50%). If the weighted result is under 20% started-sign-up-to-post after week 4, change the sign-up and first-post flow before buying any reach.

## One number to watch each week

| Week | Question that week answers | The one number | Green | Red (act now) |
| --- | --- | --- | --- | --- |
| 1 | does the page turn a visitor into a sign-up | visit to sign-up % (all sources) | 10% or more | under 5%: rewrite the first screen |
| 2 | does the wedge pitch work | sign-ups per community post that mods approved | 40 or more | under 10: the pitch or the community is wrong |
| 3 | do people finish sign-up | started sign-up to account % within 7 days | 55% or more | under 30%: the code email or the first screen is wrong |
| 4 | do they post | share of new accounts who post within 48 hours | 50% or more | under 30%: the first post is too hard |
| 5 | does launch day bring real creators | creators who posted within 24 hours of launch | 150 or more | under 50: hold the second wave, fix the funnel |
| 6 | does it spread | first-share % plus referral sign-ups | 30% and 100 | under 15%: the share card is not worth sharing |

Headline: **creators who have posted** (cumulative). Target by end of each week: 0, 0, 40, 120, 500, 1,000. Week 3 is the first week with posters, from the hand-picked first 100 founding creators.

## Support numbers

These do not have a conversion target; they stop us making a promise we cannot keep.

| Number | Target | Why |
| --- | --- | --- |
| Reports filed (Report a copy) | track from day 1, no target | every report feeds the dataset for later automatic matching |
| Time from report to takedown sent | median under 48 hours | the founding promise |
| Reports rejected for missing proof | track share | shows if the flow is being abused (false claims are a documented scam) |
| Takedown help hours per week | under 4 per person | the cap on the concierge promise |
| Takedown outcomes known after 14 days | track: removed, no response, disputed | what we put on The Wall (with consent) |
| Accounts reported as fake or bot | under 2% of new accounts | trust tier is working |

## Guardrails for reading the numbers

- A sample under 30 per step is a story, not a rate. Do not change the plan on it.
- Split by source before reading any rate. A blended 12% hides a 20% community and a 3% press spike.
- Not counted: our own team, test accounts, accounts from the staging seed.
- Never report a creator count that includes unposted accounts. "Creators" means posted at least once.
- Public numbers: only share counts we can show on the live page. No rounding up, no forecasts presented as results.

## Dashboard to build (one screen)

The funnel above as five bars with counts and rates, a filter by source, the weekly one-number card on top, the weekly cumulative posters line against the target (0, 0, 40, 120, 500, 1,000), and the support table underneath. Data already exists in the site D1 (started sign-up), the API (accounts, posts) and the share-card table. Not built yet; belongs on the plan dashboard at http://agora.localhost:5035.
