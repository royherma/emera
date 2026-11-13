# Launch plan, 6 weeks

Written 2026-11-13. Week 1 starts Monday 2026-11-16. Launch day is **Tuesday 2026-12-15** (week 5), so the launch lands before the holiday lull and week 6 is the invite wave and the first-1,000 push. All times Bangkok unless marked. Nothing here is posted, sent or created; every step is a plan for Roy to approve.

Goal: 1,000 creators who have posted (see `first-1000.md`). Protection promise everywhere: **"we stand behind you when your work is copied"** plus a "Report a copy" flow. Never "we watch for copies".

## Launch gates

Launch day only happens if these work on production by Friday 2026-12-11. If a gate fails, launch day moves a week; the calendar below shifts as a block.

| Gate | Check |
| --- | --- |
| A creator can post and the proof-of-maker badge shows what was checked, no more | smoke test passes on production |
| "Report a copy" takes a link and an ownership proof and produces a takedown the creator can send, with our help | one real test report end to end |
| Account export works (leave with posts and followers) | export file opens elsewhere |
| Sign-in email works on production | `api.emera.social` live (not deployed as of today per CLAUDE.md) |
| Repo public and `oss scan` clean | needed for the Hacker News post; if not ready, skip Hacker News |
| Takedown helper rota: two named humans, a 48-hour response promise | written down |

## Calendar

| Week | Dates (Mon to Sun) | Theme | Done by Sunday |
| --- | --- | --- | --- |
| 1 | Nov 16 to 22 | Waitlist opens, stolen-work story built | early list live and counting; 20 cases collected with consent status; 5 partner calls booked; founder analytics pulled |
| 2 | Nov 23 to 29 | Seed the wedge | 4 community conversations started with mod approval; Copy Report Kit published; first video out; 500 list sign-ups |
| 3 | Nov 30 to Dec 6 | Founding 100 | first 100 invites sent (hand-picked); Founding Creator mark live; 3 more communities; first guild call done; 1,200 sign-ups |
| 4 | Dec 7 to 13 | Wave 2 and press prep | 400 more invites; 50 creators have posted; press embargo notes out; launch assets frozen; 2,200 sign-ups |
| 5 | Dec 14 to 20 | Launch | launch day Dec 15; invites to all who joined before launch in 3 batches; 3,000 sign-ups |
| 6 | Dec 21 to 27 | Wave 3 and the first 1,000 | all remaining invites; The Wall (public takedown ledger) page; year-end founding list; 1,000 posters |

### Week by week

**Week 1 (Nov 16 to 22)**
- Mon: early list live on emera.social (it already exists; confirm count and email delivery). Founder pulls real analytics: followers and 90-day views on each platform, to replace the ASSUMED number in `first-1000.md`.
- Tue to Thu: build the stolen-work file (below): 20 cases, each with a public link, date and whether the person has agreed to be named. Draft the Copy Report Kit.
- Fri: book 5 calls: Graphic Artists Guild, Concept Art Association, The Animation Guild, National Cartoonists Society, Society of Illustrators. The ask is a 20-minute call, not an endorsement.
- Reserve the launch handle `emera.social` on Bluesky (it works as a domain handle). Founder does this himself; no account is created by this plan.

**Week 2 (Nov 23 to 29)**
- Read the rules of every target community first. Message mods of r/ArtistLounge, r/artbusiness, Mooncolony and New Masters Academy. Wait for yes. US Thanksgiving is Nov 26, so Reddit replies run slow; do not chase.
- Publish the Copy Report Kit on emera.social/kit: how to find copies of your work, what a takedown needs, where to send it. Useful without Emera.
- Video 1 and 2 from `content.md`.
- Ask 20 artists (people the founder already knows, plus replies from week 2) for a 15-minute call: "where do you hang out, where does your work get copied". These become the first founding creators and the community captains.

**Week 3 (Nov 30 to Dec 6): the Founding 100**
- Hand-pick 100 creators: 60 artists from the wedge, 20 video makers from the founder's audience, 20 from other crafts (tattoo, music, design, physical makers) so the feed is not one niche.
- Send invites with a personal note (draft in `content.md`). Each gets: the Founding Creator mark, a reserved handle, 5 invites, a named human for takedown help, and a place on the founding wall if they want one.
- Mark design: a permanent "Founding Creator" mark on the profile, shown next to the proof-of-maker badge, never sold, never given later. It must be a distinct shape and a word, not only color.
- Cost check: the mark and handle reservation cost nothing. Takedown help costs time: about 20 minutes per takedown x about 2 per creator x 100 creators = about 67 hours (estimate). Two people over 4 weeks is fine; if it exceeds 4 hours a week per person, cap it.
- Second wave of community conversations (Krita Artists, r/artstore, r/comic_crits).

**Week 4 (Dec 7 to 13)**
- 400 more invites, ordered by list position within each wedge community.
- Founders' first posts become launch content. Ask each of the 100 for permission to feature one post.
- Press prep (below): send embargoed notes Wed Dec 9 to the 6 outlets with the story pack: stolen-work file, a founding creator willing to talk, a demo link.
- Freeze launch assets Fri Dec 11: landing, Product Hunt page, Hacker News text, Bluesky thread, 3 launch videos.

**Week 5 (Dec 14 to 20): launch**

Launch day, Tuesday Dec 15 (Pacific time, where Product Hunt and Hacker News live). Bangkok is 15 hours ahead of Pacific in December, so the founder's launch day starts mid-afternoon Tuesday and runs into Wednesday morning.

| Time (Bangkok) | Time (US Pacific) | Action | Owner |
| --- | --- | --- | --- |
| 3:01 PM Tue Dec 15 | 12:01 AM Tue Dec 15 | Product Hunt page goes live (the Product Hunt day resets at 12:01 AM Pacific); maker comment posted | founder |
| 3:30 PM Tue | 12:30 AM Tue | Embargo lifts; press notes already in inboxes | founder |
| 6:00 PM Tue | 3:00 AM Tue | Founder's long video posts on all four platforms | founder |
| 8:00 PM Tue | 5:00 AM Tue | Bluesky thread, X thread, email 3 to the early list | founder |
| 9:00 PM Tue | 6:00 AM Tue | Hacker News "Show HN" (only if the repo is public) | founder |
| 11:00 PM Tue | 8:00 AM Tue | Wedge communities: mods who said yes post | mods or members |
| 8:00 AM Wed Dec 16 | 5:00 PM Tue | 24-hour check: counts, errors, support queue | team |

Launch-day rules:
- The founder answers every comment on Product Hunt and Hacker News in the first 4 hours. Plain, specific, no defensive tone.
- Never ask for upvotes (against Hacker News rules and bad on Product Hunt). Ask people to try it, or to tell us what is missing.
- Never claim a number we do not have. Lead with the real thing: Founding Creators, the proof badge, the Report a copy flow, the open algorithm.
- A creator in the first 100 posts something worth seeing from the Emera account every 2 hours, with permission.
- Wednesday Dec 16: thank-you post naming (with permission) the first creators and what they posted.

**Week 6 (Dec 21 to 27)**
- Remaining invites in batches by list position; hold the last 20% for community captains and referrals.
- Publish **The Wall**: resolved takedowns and the story behind each, with consent.
- Year-end post: "the first 1,000". Only if we hit it; if we land at 700, the post says what the first 700 made.
- Dec 24 to 26 is quiet: schedule, do not launch anything new.

## Founding Creator offer, first 100

| Item | What it is | Cost to us |
| --- | --- | --- |
| Founding Creator mark | permanent mark on the profile, next to the proof badge; never reissued | none |
| Reserved handle | claim the handle before public sign-up | none |
| A person on your side | a named Emera human helps with your first takedown, 48-hour response | about 40 minutes per creator (estimate) |
| 5 invites | bring 5 people who make things | none |
| A say | a monthly call on what we build next; votes in the first yearly funding vote | an hour a month |

What the 100 do not get: money, equity or reach boosts. Reach is earned in the open (the public reach log).

## Press angles

No emails here. Find each outlet's tips or contact page; address the reporter by beat. Reporter names are from public bylines found while researching; confirm the current byline before sending.

| Outlet | Beat to aim at | Angle | Evidence the outlet already covers this |
| --- | --- | --- | --- |
| TechCrunch (consumer apps) | new social apps and AT Protocol apps; Sarah Perez is the consumer news editor who has covered Bluesky and the AT Protocol app list | "A nonprofit creator network on AT Protocol where every post shows who made it" | [AT Protocol apps round-up](https://techcrunch.com/2025/06/13/beyond-bluesky-these-are-the-apps-building-social-experiences-on-the-at-protocol/), [Flashes launch](https://techcrunch.com/2025/02/28/bluesky-based-instagram-alternative-flashes-launches-publicly), [Cara growth](https://techcrunch.com/2024/06/06/a-social-app-for-creatives-cara-grew-from-40k-to-650k-users-in-a-week-because-artists-are-fed-up-with-metas-ai-policies/) |
| The Verge | creative-industry and AI news; Jess Weatherbed writes news on AI and creators (confirm) | "Report a copy: what it takes to file a takedown, and a network that helps" | author pages mirrored in search; confirm on theverge.com |
| 404 Media | AI, copyright and platforms | the stolen-work file as data; how manual takedown reports become the dataset for matching | [Sora 2 and stolen content](https://www.404media.co/openai-cant-fix-soras-copyright-infringement-problem-because-it-was-built-with-stolen-content/) |
| PetaPixel | photography and creator tools; covered Cara and Zhang v Google | "proof of who made it, checked at upload, never overstated" | [Zhang v Google](https://petapixel.com/2024/05/09/photographer-sues-google-for-using-her-photos-to-train-ai-image-generator), [Cara coverage](https://petapixel.com/2026/08/14/tech-bro-scrapes-anti-ai-photo-app-cara-then-gloats-about-it/) (both return 403 to scripts, open in a browser) |
| Creative Bloq and Creative Boom | design and illustration audience | founding artists' stories; what the mark means | [Creative Bloq on Cara](https://www.creativebloq.com/art/digital-art/the-rise-of-cara-the-anti-ai-social-media-platform-for-artists) |
| Colossal | artists and independent creative work | a creator's story, not a product pitch | [Colossal on Cara](https://www.thisiscolossal.com/2024/06/cara-app/) |
| Cartoon Brew | animation and union news | guild partnership story | [Cartoon Brew on animation unions](https://www.cartoonbrew.com/tech/an-international-coalition-of-worker-unions-declares-emergency-over-ai-use-in-animation-247671.html) |
| Fast Company | how a social app is designed differently | open algorithm and the public reach log | [Fast Company on Cara](https://www.fastcompany.com/91135674/what-is-the-cara-app) (403 to scripts) |

Press kit contents: one-paragraph description, the 20-case stolen-work file, 3 founding creators with quotes (their own words, with consent), screenshots made only from content we may use (Roy's own work or credited CC0 images), the foundation and funding plan from `docs/one-pager.md`, and a link to the repo if public.

What not to pitch: "better than" anything, user numbers we do not have, protection we have not built.

## The stolen-work story

The reason Emera exists, told with real, public cases. Rules for the file: link every case to its public report; ask the person before naming them in our own copy; never imply the case involves Emera or that we could have prevented it; never post anyone's work without their permission.

Cases found so far (all links returned HTTP 200 on 2026-11-13 unless noted):

| # | Case | What happened | Link |
| --- | --- | --- | --- |
| 1 | Jason Seiler, illustrator, Illinois (Aug 2025) | an AI piece copied his style and carried a forged signature; legal path unclear because the person behind it is unknown | [ABC7 Chicago](https://abc7chicago.com/post/artificial-intelligence-wheaton-illinois-illustrator-jason-seiler-says-ai-art-piece-ripped-off-unique-style-now-what/17657373/) |
| 2 | Independent Disney-inspired designers (Oct 2026) | AI remakes of their designs sold on Etsy without permission | [Mickey Visit](https://mickeyvisit.com/disney-designer-calls-out-stolen-etsy-ai-designs-october-4-2026/) |
| 3 | Fashion and graphic designers (Sep 2025) | designers say their work is stolen and marketed with AI | [Alaska's News Source](https://www.alaskasnewssource.com/2025/09/08/fashion-graphic-designers-say-their-work-is-being-stolen-marketed-with-ai/) |
| 4 | Jo Scott, artist (Substack) | first-person account of stolen artwork and feeling powerless against it | [Substack](https://joscottartist.substack.com/p/stolen-artwork-and-why-i-feel-powerless) |
| 5 | Andersen, McKernan, Ortiz v. Stability AI, Midjourney, DeviantArt, Runway | artists' class action over training on their work; still in pretrial, summary judgment hearing set for Feb 17, 2027 per a Feb 2026 report | [BakerHostetler tracker](https://www.bakerlaw.com/andersen-v-stability-ai/) |
| 6 | Zhang, Andersen, Larson, Fink v. Google (Apr 2024) | artists sue over Imagen training on their images; case 5:24-cv-02531 | [PetaPixel](https://petapixel.com/2024/05/09/photographer-sues-google-for-using-her-photos-to-train-ai-image-generator) (403 to scripts) |
| 7 | Sora 2 launch (Oct 2025) | copyrighted characters and creators' work appeared in generated videos within hours; metadata and watermarks were easy to strip | [404 Media](https://www.404media.co/openai-cant-fix-soras-copyright-infringement-problem-because-it-was-built-with-stolen-content/) |
| 8 | Tattoo artists | designs stolen and traced; AI-generated tattoo posters; a studio gets up to 10 AI requests a week | [Dazed](https://www.dazeddigital.com/beauty/article/70055/1/ai-help-choose-your-next-tattoo-chatgpt-gemini-image-generation-artist), [Futurism](https://futurism.com/ai-generated-tattoo-posters-nyc), [Impressive Magazine guide](https://impressivemagazine.com/spot-stolen-tattoo-designs-before-booking/) |
| 9 | Cara scraped (Aug 2026) | a Reddit user scraped an anti-AI art app and posted about it; shows that "no scraping" tags do not stop copying | [PetaPixel](https://petapixel.com/2026/08/14/tech-bro-scrapes-anti-ai-photo-app-cara-then-gloats-about-it/) (403 to scripts; headline only checked) |
| 10 | Copyright-claim abuse | scammers file false copyright claims to get creators suspended and demand payment; why our Report flow requires proof | [Malwarebytes](https://www.malwarebytes.com/nl/blog/scams/2026/09/copyright-scammers-get-instagram-accounts-suspended-and-demand-payment) |

To verify before any public use (surfaced in search, source link not confirmed): a Tasmanian crochet designer whose pattern was copied by an AI-made listing on Etsy; a painter whose work was sold as reproductions on Etsy and a large retailer's site (April 2025); Etsy sellers saying infringement reports keep getting rejected (Etsy community thread). Find the primary source for each, or drop it.

The story in one paragraph (for the press kit and the "why" video): People who make things now find copies of their work sold under other names, with forged signatures, in shops they have never heard of. The tools to report a copy exist but are slow, and artists say reports get rejected. Emera starts from the creator's side: every post carries proof of who made it and when, and when a copy turns up, you report it and we help you file the takedown. Every report also teaches the network what copies look like.

Open work: collect 10 more cases from video and music creators, so the file does not read as only an art story.

## Product Hunt plan

- **Tagline** (under 60 characters): "A creator network that stands behind your work". Alternatives: "Proof of who made it, on every post".
- **Topics:** Social media, Open source, Creators.
- **Gallery:** (1) a post with its proof badge and a plain-words line of what was checked; (2) Report a copy flow; (3) the "why am I seeing this" screen; (4) Founding Creator mark; (5) a 30-second video. All images built from allowed content only (CLAUDE.md).
- **Maker comment** (first comment, posted by the founder at launch): who he is, the one sentence of why ("I make things and watched them get copied"), what exists today, what we want feedback on. No numbers we do not have.
- **Hunter:** founder hunts it himself unless an established hunter in the creator space says yes by Dec 8. No hunter payments.
- **Day:** Tuesday. Day-of order: page live, maker comment, share in communities that have said yes. No vote-asking in any message.
- **Reply rule:** every comment gets a reply within 2 hours during US waking hours.

## Hacker News plan

- **Gate:** the repo must be public and clean. If not, skip. A "Show HN" without code gets buried.
- **Title:** "Show HN: Emera, an open-source nonprofit network where every post carries proof of who made it" (under 80 characters; edit to fit).
- **First comment (founder):** what it is, what is real today and what is not, the AT Protocol choice and why, the nonprofit structure, the cost model (about 6 cents per user per month in the estimate in `docs/one-pager.md`, labelled an estimate), and what feedback we want: where the provenance claim could be wrong, and how to design "Report a copy" so it is hard to abuse.
- **Rules:** do not ask for upvotes, do not share the link in a way that suggests voting, no sock accounts, answer technical questions with the code open.
- **Post time:** Tuesday 6:00 AM Pacific = 9:00 PM Bangkok. Stay online 4 hours.

## Bluesky plan

- **Handle:** `emera.social` as a domain handle on Bluesky, claimed by the founder. His personal account posts first; the Emera handle posts second.
- **Launch thread (6 posts):** what it is; proof of who made it; Report a copy; open algorithm; you can leave with your account; link. Copy in `content.md`.
- **Starter pack:** build "Founding Creators on Emera" with the 100 once they agree. Ask each to add it to their profile.
- **Art feeds:** after launch day, message the maintainers of the human-art feeds with two real posts and a short question: "would this fit your feed". No ask before there is work to show.
- **Cross-app:** a short note to the Skylight and Flashes teams the week before launch with the launch date and an offer to post for them.
- Note: Bluesky active use is down on its 2024 peak; expect hundreds of clicks, not thousands, and judge it by artist replies, not views.

## What the founder does vs. what the team does

| Item | Founder | Team |
| --- | --- | --- |
| Videos, threads, comments on launch day | yes | no |
| Community mod conversations | first message | follow-ups, replies |
| Partner calls | yes | notes and follow-up |
| Takedown help | no | yes |
| Press notes | send | draft |
| Invites | approve the first 100 | send waves |

## Open decisions for Roy

| Decision | Default used here | Reverse with |
| --- | --- | --- |
| Launch day Dec 15 (week 5) | pre-holiday window | move the block a week; skip if gates fail |
| Hacker News only if the repo is public | yes | public repo by Dec 11 |
| Concierge takedown help capped at the first 100 | yes | raise cap once hours are measured |
| Founding mark never sold or reissued | yes | none, keep this |
