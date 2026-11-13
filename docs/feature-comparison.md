# Emera feature comparison

Source of truth: `docs/features.yaml` (90 features). Emera status comes from the code map `data/atlas.json` and `docs/stories.yaml`, so this page changes when the code does. The Features tab in the atlas reads the same file.

Emera is welcome to everyone who makes things, and this list is a map of what people already do every day on the networks they use, plus a few things only Emera does. It is a to-do list for building, not a scorecard against anyone.

## How to read it

| Tier | Meaning | Count |
| --- | --- | --- |
| core | The Pareto 20: the features that cover most daily use and are needed for launch | 20 |
| next | Common on the big platforms, built after the core | 28 |
| later | Real but lower daily use, or expensive | 21 |
| unique | Emera-only twists from the mission (proof of maker, open ranking, and others) | 21 |

Emera status rule, computed from the mapping in the yaml: **built** means every mapped screen and endpoint exists in the atlas, with at least one screen or page and at least one endpoint. **partial** means a story or some of the code exists but something is missing. **not built** means nothing is mapped. Platform marks: yes, part (partly or in some regions or tiers), - (not offered).

## Pareto core

Core coverage for Emera: **55%**.

The math: built counts 1, partial counts 0.5, not built counts 0.

`(10 built x 1 + 2 partial x 0.5 + 8 not built x 0) / 20 core features = 11.0 / 20 = 55%`

Counting only fully built features it is 10 of 20, 50%.

| Feature | Who has it | Emera status | Why core, and our twist |
| --- | --- | --- | --- |
| Sign up and sign in with an email code | 8 of 8 | built | Front door: no account, no creators. Own Emera account on the AT Protocol, no password, no Bluesky login needed |
| Claim a handle and display name | 8 of 8 | built | Identity before the first post. A handle you can carry with you if you move hosts |
| Edit bio and avatar | 8 of 8 | partial | Without it every profile is blank |
| Profile grid of your work | 8 of 8 | built | Your page is your shop window. The work leads; each tile carries its proof of maker |
| Public profile page, no account needed to view | 7 of 8 (+1 part) | built | Every share is a growth loop. Server-rendered page at emera.social/@handle, nothing hidden behind sign-in |
| Post a photo | 7 of 8 (+1 part) | built | The product is posting work. Signed with your name at upload |
| Post a video | 5 of 8 (+3 part) | built | Video creators are half the audience. Plays from our own storage, signed the same way |
| Alt text and caption prompts on every post | 7 of 8 (+1 part) | not built | Accessibility rule in the product brief. Prompted on every post, a stated product commitment |
| Carousel of several images or videos | 5 of 8 (+3 part) | built | Process and series posts are how makers show work. Up to 10 items, each signed |
| Delete a post | 8 of 8 | built | Control over your own work. Removes the files, not just the row |
| Feed from people you follow | 8 of 8 | partial | The daily reason to open the app. Chronological by default, ranking is opt-in |
| Browse recent work from everyone | 8 of 8 | built | How a first visitor finds work. Shows the reason each post is here |
| Search people and posts | 8 of 8 | not built | Word of mouth ends in a search box |
| Follow and unfollow | 8 of 8 | not built | No graph, no feed. Following stays with you if you move hosts |
| Like a post | 8 of 8 | not built | Basic feedback loop. Weighted by the giver's trust tier |
| Comments and replies | 7 of 8 (+1 part) | not built | Conversation is how people stay. Comments carry the same trust tier |
| Notifications | 8 of 8 | not built | Return visits. Grouped, never nagging |
| Link previews when shared | 8 of 8 | built | Shared links are the growth channel. Picture and title for every profile and post link |
| Block and mute accounts | 8 of 8 | not built | Safety before growth |
| Report a post or account | 8 of 8 | not built | No report path, no safe network. Reporter sees the outcome and the reason |

What this says: Emera has the writing side of the loop (sign in, post a photo or video, a public profile with link previews). The reading and reacting side (follow, like, comment, notifications, search) and the safety basics (block, mute, report) are the gap.

## Biggest core gaps

| # | Feature | Status | What is missing |
| --- | --- | --- | --- |
| 1 | Search people and posts | not built | No search endpoint; /explore only lists recent posts |
| 2 | Follow and unfollow | not built | No follow table or endpoint; the feed cannot know whose work to show |
| 3 | Like a post | not built | No likes table or endpoint |
| 4 | Notifications | not built | No notifications table, endpoint or screen |
| 5 | Block and mute accounts | not built | No block or mute table or endpoint |
| 6 | Report a post or account | not built | No report-a-post route for abuse; /report covers copies only and its endpoint is missing |
| 7 | Alt text and caption prompts on every post | not built | Lexicon `social.emera.defs` has an alt field, but the upload screen and POST /v1/posts never send one |
| 8 | Comments and replies | not built | No comments table or endpoint |
| 9 | Edit bio and avatar | partial | PATCH /v1/me is in the story but not in the code |
| 10 | Feed from people you follow | partial | /feed shows everyone; it needs the follow graph |

## Full matrix by area

Columns: Instagram, TikTok, YouTube, Pinterest, Bluesky, Cara, Pixelfed, VSCO, then Emera status.

### Account

| Feature | Tier | IG | TT | YT | Pin | Bsky | Cara | Pxl | VSCO | Emera |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sign up and sign in with an email code | core | yes | yes | yes | yes | yes | yes | yes | yes | built |
| Claim a handle and display name | core | yes | yes | yes | yes | yes | yes | yes | yes | built |
| Join with an invite from a friend | next | - | - | - | part | yes | - | - | - | built |
| Two-factor sign-in | next | yes | yes | yes | yes | yes | yes | yes | part | not built |
| Delete my account and data | next | yes | yes | yes | yes | yes | yes | yes | yes | not built |

### Profile

| Feature | Tier | IG | TT | YT | Pin | Bsky | Cara | Pxl | VSCO | Emera |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Edit bio and avatar | core | yes | yes | yes | yes | yes | yes | yes | yes | partial |
| Profile grid of your work | core | yes | yes | yes | yes | yes | yes | yes | yes | built |
| Public profile page, no account needed to view | core | part | yes | yes | yes | yes | yes | yes | yes | built |
| Highlights of past stories | later | yes | - | - | - | - | - | - | - | not built |
| Portfolio profile for working creators | next | part | - | part | part | part | yes | yes | part | not built |

### Posting

| Feature | Tier | IG | TT | YT | Pin | Bsky | Cara | Pxl | VSCO | Emera |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Post a photo | core | yes | yes | yes | part | yes | yes | yes | yes | built |
| Post a video | core | yes | yes | yes | part | part | part | yes | yes | built |
| Alt text and caption prompts on every post | core | yes | yes | yes | part | yes | yes | yes | yes | not built |
| Carousel of several images or videos | core | yes | yes | part | part | part | yes | yes | yes | built |
| Delete a post | core | yes | yes | yes | yes | yes | yes | yes | yes | built |
| Edit a post after publishing | next | yes | part | yes | part | - | yes | yes | part | not built |
| Hashtags | next | yes | yes | yes | yes | - | yes | yes | - | not built |
| Mention and tag people | next | yes | yes | yes | yes | yes | yes | yes | part | not built |
| Text posts | next | part | yes | yes | - | yes | yes | - | yes | not built |
| License terms on every post | unique | - | - | part | - | - | part | yes | - | not built |
| Co-authored posts | next | yes | - | - | part | - | - | - | part | not built |
| Content warnings and sensitive media | next | yes | part | part | - | yes | yes | yes | - | not built |
| AI-made and AI-assisted labels | next | yes | yes | yes | yes | part | part | - | - | not built |
| Licensed music for videos | later | yes | yes | yes | yes | - | - | - | - | not built |
| Music and audio as first-class posts | later | - | - | part | - | - | - | - | - | not built |
| Posts for objects you make, with process steps | later | part | part | - | part | - | part | - | - | not built |
| Import your posts from another platform | later | - | - | - | - | - | - | yes | - | not built |
| Remix, duet and stitch | later | yes | yes | yes | - | - | - | - | - | not built |
| Live streaming | later | yes | yes | yes | - | part | - | - | - | not built |

### Media

| Feature | Tier | IG | TT | YT | Pin | Bsky | Cara | Pxl | VSCO | Emera |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Automatic captions for video | next | yes | yes | yes | - | - | - | - | - | not built |
| Chapters in long videos | later | - | - | yes | - | - | - | - | - | not built |

### Feed

| Feature | Tier | IG | TT | YT | Pin | Bsky | Cara | Pxl | VSCO | Emera |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Feed from people you follow | core | yes | yes | yes | yes | yes | yes | yes | yes | partial |
| Browse recent work from everyone | core | yes | yes | yes | yes | yes | yes | yes | yes | built |
| Feed ranking code is public | unique | - | - | - | - | part | - | yes | - | not built |
| Why am I seeing this | unique | yes | yes | part | part | part | - | - | - | not built |
| Choose your own feed or ranking | unique | part | part | part | part | yes | yes | yes | part | not built |
| Vertical short video feed | next | yes | yes | yes | part | part | part | yes | part | not built |
| Stories that expire after 24 hours | later | yes | part | part | - | - | - | yes | - | not built |
| Likes and follows weighted by trust | unique | - | - | - | - | - | - | - | - | not built |

### Discovery

| Feature | Tier | IG | TT | YT | Pin | Bsky | Cara | Pxl | VSCO | Emera |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Search people and posts | core | yes | yes | yes | yes | yes | yes | yes | yes | not built |
| Suggested people to follow | next | yes | yes | yes | yes | yes | yes | yes | - | not built |
| Starter packs | next | - | - | - | - | yes | - | - | - | not built |
| Browse by craft | next | part | - | yes | part | part | part | - | part | not built |
| Find similar work from a picture | later | part | - | - | yes | - | - | - | - | not built |
| Save posts into collections | next | yes | yes | yes | part | part | yes | yes | yes | not built |
| Jobs and commission board | later | - | - | - | - | - | yes | - | - | not built |

### Social

| Feature | Tier | IG | TT | YT | Pin | Bsky | Cara | Pxl | VSCO | Emera |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Follow and unfollow | core | yes | yes | yes | yes | yes | yes | yes | yes | not built |
| Like a post | core | yes | yes | yes | yes | yes | yes | yes | yes | not built |
| Comments and replies | core | yes | yes | yes | yes | yes | yes | yes | part | not built |
| Repost or share with credit | next | yes | yes | yes | part | yes | yes | yes | part | not built |
| Private accounts and follow requests | next | yes | yes | - | yes | - | - | yes | part | not built |
| Close friends lists | later | yes | part | - | - | - | - | part | - | not built |
| Broadcast channels | later | yes | - | part | - | - | - | - | - | not built |
| Notifications | core | yes | yes | yes | yes | yes | yes | yes | yes | not built |
| Short status notes on your profile | later | yes | - | - | - | - | - | - | - | not built |

### Messaging

| Feature | Tier | IG | TT | YT | Pin | Bsky | Cara | Pxl | VSCO | Emera |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Direct messages | next | yes | yes | - | yes | yes | part | yes | - | not built |

### Creator tools

| Feature | Tier | IG | TT | YT | Pin | Bsky | Cara | Pxl | VSCO | Emera |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Schedule posts | next | yes | yes | yes | yes | - | - | - | - | not built |
| Drafts | next | yes | yes | yes | yes | part | part | part | yes | not built |
| Insights on views and followers | next | yes | yes | yes | yes | - | part | - | part | not built |
| Embed a post on another site | next | yes | yes | yes | yes | yes | - | yes | - | not built |
| Link previews when shared | core | yes | yes | yes | yes | yes | yes | yes | yes | built |
| Creator dashboard of copies found and takedowns | unique | - | - | part | - | - | - | - | - | partial |

### Protection

| Feature | Tier | IG | TT | YT | Pin | Bsky | Cara | Pxl | VSCO | Emera |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Proof of maker on every post | unique | - | - | - | - | - | - | - | - | built |
| Report a copy of my work found elsewhere | unique | - | - | - | - | - | - | - | - | partial |
| Report a copyright violation inside the app | next | yes | yes | yes | yes | yes | yes | yes | yes | not built |
| Automatic match of copies across the web | later | part | - | yes | - | - | - | - | - | not built |
| We file the takedown for you | unique | - | - | - | - | - | - | - | - | partial |
| AI training only by your opt-in, paid | unique | - | - | - | - | - | part | - | - | not built |
| Style protection tool for artists | later | - | - | - | - | - | part | - | - | not built |
| Verified human mark, free | unique | part | yes | yes | yes | - | - | - | - | not built |
| Automated accounts must say so | unique | - | - | - | - | yes | - | - | - | not built |

### Money

| Feature | Tier | IG | TT | YT | Pin | Bsky | Cara | Pxl | VSCO | Emera |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tips from fans | next | part | yes | yes | - | - | - | - | - | not built |
| Paid subscriptions | later | yes | yes | yes | - | - | - | - | - | not built |
| License your work to others | unique | - | - | - | - | - | part | - | - | not built |
| Ad revenue or reward program | later | part | yes | yes | - | - | - | - | - | not built |
| Surplus given back each quarter | unique | - | - | - | - | - | - | - | - | not built |
| Sell products from posts | later | yes | yes | yes | yes | - | - | - | - | not built |

### Safety

| Feature | Tier | IG | TT | YT | Pin | Bsky | Cara | Pxl | VSCO | Emera |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Block and mute accounts | core | yes | yes | yes | yes | yes | yes | yes | yes | not built |
| Report a post or account | core | yes | yes | yes | yes | yes | yes | yes | yes | not built |
| Community labelers | later | - | - | - | - | yes | - | part | - | not built |
| Public moderation log | unique | - | part | part | part | part | - | - | - | not built |
| Appeal a takedown or label | unique | yes | yes | yes | yes | yes | - | yes | - | not built |

### Platform

| Feature | Tier | IG | TT | YT | Pin | Bsky | Cara | Pxl | VSCO | Emera |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Phone app and web app from one codebase | next | yes | yes | yes | yes | yes | yes | yes | yes | partial |
| Accessibility: text size, contrast, reduced motion | next | yes | yes | yes | yes | yes | yes | yes | yes | not built |
| Open source code | unique | - | - | - | - | yes | part | yes | - | not built |
| No ads and no sale of member data | unique | - | - | part | - | yes | yes | yes | yes | not built |
| Host your own account server | later | - | - | - | - | yes | - | yes | - | not built |
| Export everything you posted | unique | yes | yes | yes | yes | yes | part | yes | part | partial |
| Move your account to another host with followers | unique | - | - | - | - | yes | - | part | - | not built |
| Live public cost and books page | unique | - | - | - | - | - | - | - | - | not built |

## Emera-only twists

| Feature | Emera status | What is different |
| --- | --- | --- |
| License terms on every post | not built | Choose a license per post; the terms travel with every copy |
| Feed ranking code is public | not built | Default ranking is open source; changes are versioned |
| Why am I seeing this | not built | Every post states the real rule and signal behind it |
| Choose your own feed or ranking | not built | Swap the ranking like swapping an app; AT Protocol feed generators |
| Likes and follows weighted by trust | not built | New and farm accounts count close to zero in ranking |
| Creator dashboard of copies found and takedowns | partial | One screen: matches, filings, outcomes |
| Proof of maker on every post | built | Signed at upload with name and time; badge says exactly what was checked |
| Report a copy of my work found elsewhere | partial | We help file the takedown and keep every report as a dataset |
| We file the takedown for you | partial | Free; every filing and outcome shown |
| AI training only by your opt-in, paid | not built | Per creator and per post, with payment |
| Verified human mark, free | not built | Same price for everyone: free |
| Automated accounts must say so | not built | Undeclared bots are labelled |
| License your work to others | not built | Terms attach to the post; we cap our fee at 5% |
| Surplus given back each quarter | not built | Split by a yearly member vote |
| Public moderation log | not built | Every takedown and label logged with its reason |
| Appeal a takedown or label | not built | Appeal path shown with every action |
| Open source code | not built | AGPL servers, MIT client SDKs |
| No ads and no sale of member data | not built | Written into the bylaws |
| Export everything you posted | partial | Export is a launch feature |
| Move your account to another host with followers | not built | AT Protocol account migration |
| Live public cost and books page | not built | Audited books and this month's costs |

Unique features are built toward the mission: 1 built, 4 partial, 16 not built.

## Good first features to build

Small (effort S), no code yet, and an outside contributor can own them. Pick one, open an issue naming its `id` from `docs/features.yaml`, and read `CONTRIBUTING.md`.

| Feature id | Tier | Why it matters | Where it would live |
| --- | --- | --- | --- |
| `alt-text` | core | Access for blind and low-vision people, and better search | `apps/mobile/src/app/(tabs)/upload.tsx`, `lexicons/social/emera/post.json` |
| `block-mute` | core | People must be able to shut out abuse | `apps/api/src`, new migration, profile screen |
| `like` | core | Cheapest way to tell a maker you saw them | `apps/api/src`, new migration, post screen |
| `bot-labels` | unique | People want to know who is a bot | `lexicons/social/emera/defs.json`, profile screen |
| `craft-categories` | next | Illustrators want illustrators, woodworkers want woodworkers | `apps/api/src` and `apps/mobile/src/app` |
| `hashtags` | next | How topics get found |  |
| `post-edit` | next | Fix a typo without losing the likes | `apps/api/src` and `apps/mobile/src/app` |
| `text-only-post` | next | Short updates between big pieces | `apps/api/src` and `apps/mobile/src/app` |

Medium features that are also open to contributors are the rest of the `help_wanted: true` rows in the yaml, `effort: M`.

## Sources

Platform marks come from the pages below plus product knowledge; the help centers of Instagram and TikTok did not load for our fetch tool, so finer points are less certain and are best corrected by pull request with a link. Shipping status changes often.

- **Instagram**: [Close Friends across Stories, Reels, posts and Notes (TechCrunch)](https://techcrunch.com/?p=2628064), [Instagram updates 2026 (Metricool)](https://metricool.com/instagram-news/), [Instagram (Wikipedia)](https://en.wikipedia.org/wiki/Instagram), [Trial Reels and grid control (The Week)](https://www.theweek.in/news/sci-tech/2025/06/24/trial-reels-quiet-posting-and-grid-control-what-instagram-s-2025-update-means-for-you.amp.html)
- **TikTok**: [TikTok (Wikipedia)](https://en.wikipedia.org/wiki/TikTok), [Creator Rewards Program requirements (TTCalculator)](https://ttcalculator.net/guides/creator-rewards-program/)
- **YouTube**: [Feature access for creators (YouTube Help)](https://support.google.com/youtube/answer/9890437), [Learn about posts (YouTube Help)](https://support.google.com/youtube/answer/9409631), [Creator updates (YouTube Help)](https://support.google.com/youtube/answer/9072033)
- **Pinterest**: [Pinterest (Wikipedia)](https://en.wikipedia.org/wiki/Pinterest), [Lens recognizes 2.5 billion objects (VentureBeat)](https://venturebeat.com/2019/09/17/pinterests-lens-can-now-recognize-2-5-billion-home-and-fashion-objects/), [Board sections and shopping list (Social Samosa)](https://www.socialsamosa.com/2021/06/pinterest-launches-new-shopping-features)
- **Bluesky**: [Starter packs (Bluesky blog)](https://bsky.social/about/blog/06-26-2024-starter-packs), [How to clean your Bluesky feed, labelers (EFF)](https://www.eff.org/deeplinks/2024/06/how-clean-your-bluesky-feed), [Custom feeds tutorial (Bluesky docs)](https://docs.bsky.app/docs/tutorials/custom-feeds)
- **Cara**: [Cara (Wikipedia)](https://en.wikipedia.org/wiki/Cara_(app)), [Cara in the App Store](https://apps.apple.com/app/id6450934458)
- **Pixelfed**: [Pixelfed (Wikipedia)](https://en.wikipedia.org/wiki/Pixelfed), [Pixelfed docs](https://docs.pixelfed.org/)
- **VSCO**: [VSCO in the App Store](https://apps.apple.com/us/app/vsco-photo-editor/id588013838), [Studio Pro and VSCO One (PetaPixel)](https://petapixel.com/2026/06/23/why-vsco-believes-its-new-500-subscription-is-worth-it-for-pros/), [VSCO as a social network (TechCrunch)](https://techcrunch.com/2023/02/27/vsco-is-growing-into-a-legit-social-network-for-photographers)

Emera code state: `data/atlas.json` (generated), `docs/stories.yaml`. Mission and values behind the unique tier: `docs/mission/mission.md`.
