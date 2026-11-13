# Emera master plan

Written 2026-11-13 (Bangkok). Replaces the one-pager as the plan; the one-pager stays as the idea record. Facts have a link. `[inferred]` = my reasoning, not read in a source. `[target]` = a goal, not a forecast. What the founder must do or decide is in `docs/asks.json`, ranked.

**Founder decision folded in (2026-11-13):** no automatic copy-watch for now. Protection v1 is manual. A creator reports a copy they found (link + screenshot), we help file the takedown, and every report goes into a dataset that later trains and tests automatic matching. Automatic scanning is not part of M0 to M2. The ~$31k/month scan bill in `architecture.md` is out of the early milestones and comes back only when the dataset can prove a matcher works (M3 pilot, M4 at scale).

## What we are building

Emera. Where humanity comes together. An open-source nonprofit network for everyone who makes things, on AT Protocol, with our own accounts and our own R2 storage, phone app and web together. Four promises, none of which a network built on ad attention can truthfully copy: proof of who made it, help when your work is copied, an open algorithm, and you own your account.

What exists: an API Worker (accounts, uploads, posts, profile pages, invites), an Expo app in progress, a landing page with an early-access list, both deployed to staging, and a provenance spike (C2PA signing works; the perceptual hash PDQ survives resize and recompress, tolerates about 1% crop, fails at 2% crop and on a mirror flip). Nothing public yet: no users, no press, no partners. Copy must not imply any.

## 1. The ambition

Targets, not forecasts. Each number has a unit and a reason it is not fantasy.

| Measure | Year 1 (Nov 2027) | Year 3 (Nov 2029) | Year 10 (2036) |
| --- | --- | --- | --- |
| Creators with an account | 10,000 | 300,000 | 10,000,000 |
| Posts signed and registered ("protected") | 1 million | 40 million | 5 billion |
| Takedowns filed (manual, then assisted, then automatic) | 2,000 | 150,000 | 5 million |
| Share of filed takedowns that end in removal | 60% | 70% | 80% |
| Reports in the copy dataset (confirmed, labeled) | 5,000 | 400,000 | 20 million |
| Money paid to creators, per year | $20k | $2M | $60M ($200M cumulative) |
| Outside contributors with a merged change | 150 | 1,500 | 10,000 |
| All-in cost per creator per month, people included | under 15 cents | under 10 cents | under 6 cents |
| Paying Premium members | 3% of creators | 4% | 5% |

How the numbers hang together:
- Cost. Hosting is about 3.6 to 4 cents per creator per month ([architecture.md](architecture.md) section 5). The one-pager's target at scale is 5.6 cents with safety staff. Year 1 is higher per head because fixed costs (people, counsel) are spread over few creators.
- Creator payouts. The one-pager proposes giving surplus back each quarter: about 40% to creators. $60M a year at 10M creators is a $6 average a year per creator, so it only works if revenue is about $150M a year. That is the Wikipedia-scale end of donations plus Premium (10M creators x 5% Premium x $48 = $24M; the rest must come from donations, licensing fees and institutional gifts). Treat year 10 as the stretch it is `[inferred]`.
- Creators. Proof this audience moves fast when angry: Cara went from about 40,000 to about 650,000 users in one week in June 2024 when Meta's AI-training plan landed ([Dataconomy](https://dataconomy.com/2024/06/07/what-is-cara-app-and-how-to-use-it)). Figures vary by source (300,000 to 700,000). Proof it is also fragile: Cara's founder was self-funding it ([Creative Bloq](https://creativebloq.com/creative-inspiration/artists-stand-up-for-their-rights-against-ai-threats)). Our answer is the nonprofit with public books.
- "Protected" means signed at upload and registered, not "watched everywhere". We never claim more.

## 2. The wedge

**Who: independent illustrators and designers who sell prints, stickers and merch** (their own shop, Etsy, Redbubble, Society6, Gumroad). Pick, not a list.

Why them first, even though the product is for every creator:
- Theft has a price tag for them. A stolen design sold on a print-on-demand shop or a knock-off store is lost income, found by a link, and reportable today. A stolen post is an annoyance; a stolen product is a bill.
- They already organize and talk. Artist communities moved fast on AI scraping (Cara, 2024) and artist coalitions lobby on it: the Authors Guild-led group with the Graphic Artists Guild, Concept Art Association, Professional Photographers of America and others says it represents "hundreds of thousands of creators" ([Publishers Weekly](https://www.publishersweekly.com/pw/by-topic/industry-news/licensing/article/91920-authors-guild-meets-with-legislators-over-generative-ai-concerns.html)).
- The copies they care about sit on the open web and in shops, which manual reports and DMCA email to a host's agent can reach. We are not promising to see inside Instagram or TikTok feeds.
- Illustrators spill over: the same people are friends with video makers, tattoo artists, musicians and designers. The wedge is the first door, not the fence.

Where the first 1,000 come from, in order:
1. The Bluesky art community (they already use AT Protocol; a handle and an invite is nothing new to them). Founder and team DM 200 by hand.
2. Artist hubs: r/ArtistLounge, illustration Discords, the people who joined Cara in 2024 `[inferred: they are reachable in the same threads]`.
3. Instagram and TikTok illustrators with 5k to 100k followers, who have the most to lose and the most reach. 100 hand-written DMs offering to file their first takedown free.
4. Creator orgs (section 4).

**The one feature: "Report a copy", with a Taken-down receipt.** A creator pastes a link to a copy and adds a screenshot (30 seconds, in the app or on the web). We check the creator's original (signed at upload, dated), prepare the takedown notice with their recorded authorization, the creator confirms, we send it to the host's DMCA agent or fill the platform's form, and track the outcome. When it is removed, the creator gets a shareable card: "Copy of my work removed from <site>, filed by Emera in <n> days". That card is what gets posted. Every filed notice is free in year one.

Why this one feature tells others: it is a result you can show, it costs a creator 30 seconds, and it is the moment they feel the product works. A creator who gets one removal tells 5 friends. Target: invites sent per creator at least 2 by M1.

Why manual first is the right order, not a downgrade:
- It is true today. The architecture doc's own risk number one: reverse search sees the open web, not the inside of Instagram, TikTok or YouTube, and scans are 88% of cost at full cadence.
- A human report is a labeled example. Link, screenshot, the creator's confirmation, the outcome. A few thousand of these are the training and test set we do not have, including the crops and flips that PDQ misses.
- It sidesteps the legal risk of sending a notice on a machine's guess. 17 U.S.C. 512(f) makes the sender liable for knowing misrepresentation, and the creator must confirm each report ([statute](https://www.law.cornell.edu/uscode/text/17/512)).

The dataset (build it from the first report):
- Fields: report id, creator account, original post and its signed hash, copy URL, platform, screenshot, copy kind (exact, crop, flip, recolor, AI re-creation, physical product), creator confirmation, notice sent date, outcome (removed, ignored, counter-notice), days to outcome.
- Consent: reports enter the dataset only under terms the creator accepts, shown when they file. Screenshots of third parties are kept private. A cleaned public version comes later, which also reads well to grant funders. Counsel reviews the terms `[inferred: needed]`.
- Rule for starting automatic matching: at least 2,000 confirmed reports, at least 500 from sites outside the open web or from crops and flips, then a matcher must reach recall 80% at false positives under 5% on a held-out 20%. Until then no automatic scanning. Candidates to test: SSCD, local-feature matching, a second hash layer; the CLIP test already failed to separate crops from other shots (architecture section 4).

## 3. Milestones

Each has what we build, what we prove, what it costs, the risk that kills it, and an exit test: yes or no from a number.

### M0 - this week (Nov 16 to Nov 20, 2026)

- Build: production go-live on emera.social and api.emera.social; real sign-in email; the four handles claimed; DMCA agent filed; "Report a copy" spec and the first form on the web (a Worker route that saves a report and emails us); founder's own profile.
- Prove: the pipe works end to end on a real domain with a real inbox.
- Cost: about $6 (DMCA agent) plus domain, already bought. Email on Resend free tier: 3,000 per month, 100 per day, see [Resend pricing](https://resend.com/pricing) (sources agree; confirm on the page). Infra: Cloudflare free tier `[inferred]`.
- Kill risk: a signup wall or deliverability problem (codes go to spam) that blocks the first creators.
- **Exit test:** (a) emera.social, api.emera.social and `/@roy` return HTTP 200; (b) a sign-in code reaches an outside Gmail inbox, not spam, in under 60 seconds, 3 of 3 tries; (c) @emerasocial claimed on TikTok, YouTube, Instagram and Bluesky (4 of 4); (d) DMCA agent confirmation number in hand; (e) the 6 asks ranked highest in `asks.json` answered.

### M1 - first 100 creators (about 6 weeks, by Dec 31, 2026)

- Build: invite links; "Report a copy" in the app and web with the notice builder (creator confirms, we send); a small ops page for us to file and track; dataset table; profile import (bring old posts over); public repo with CONTRIBUTING and 10 starter issues; error alerts and visitor numbers; manual CSAM and abuse basics (below).
- Prove: creators will report copies and the notices work.
- Cost: infra under $60 per month `[inferred, free tier plus small PDS box $5 to $20, architecture section 2]`; counsel for terms and notice template $1,500 to $3,000 one-off `[inferred]`; the founder's and our time filing about 100 notices.
- Kill risk: creators have no copies to report, or hosts ignore us. If fewer than 10 reports come from 100 creators in 30 days, the wedge or the promise is wrong and we rewrite it before M2.
- **Exit test:** 100 creators each with at least 3 posts; at least 40 reports filed and 30 notices sent; at least 50% of sent notices end in removal within 14 days; median time from report to notice sent under 24 hours; at least 30% of creators have invited someone who signed up; zero unreviewed CSAM reports older than 24 hours.

### M2 - 1,000 creators (about 14 weeks, by mid-Feb 2027, stretch to Mar)

- Build: own PDS and did:plc accounts (stage A and B in architecture section 1); passkeys; creator dashboard (your reports, outcomes, receipts); public cost page and donate button; open feeds with "why this post"; 12-month plan for the nonprofit home; contributor program with bounties.
- Prove: creators stay, report volume scales on a small team, outsiders contribute.
- Cost: hosting about $40 to $60 per month at 1,000 creators ([architecture.md](architecture.md): $40), 0 for scans, manual takedown help about 8 hours a week `[inferred: 30 to 100 reports a month]`, counsel retainer `[inferred]`.
- Kill risk: a moderation or safety incident (CSAM, harassment) with no staff, or the PDS losing accounts. Mitigation in section 6.
- **Exit test:** 1,000 creators; 30-day retention (posted at least once in days 23 to 30) at least 35% `[target, inferred]`; at least 300 reports in the dataset with at least 100 from outside the open web; 5 outside contributors with merged changes; a 501(c)(3) host or filed Form 1023 in writing; hosting under $150 per month; export-and-leave tested by 10 people.

### M3 - 10,000 creators (about Q3 2027)

- Build: automatic matcher pilot on opt-in creators only, trained on the dataset; own AppView and relay mirror; tips and Premium on Stripe Connect; first payouts; video on our own HLS encoding; hired trust-and-safety and takedown contractor.
- Prove: a matcher that beats our own bar, and money flows to creators.
- Cost: hosting $359 per month at 10,000 creators; light scans $697 per month if the matcher uses a paid API, less if self-hosted ([architecture.md](architecture.md) section 5); one contractor about $3,000 per month ([architecture.md](architecture.md): $0.5 person at 10k); total about $4,000 to $4,500 per month `[inferred sum]`.
- Kill risk: the matcher misses the copies that matter (inside closed platforms stay invisible), so the "protected everywhere" line must stay "the open web and what you report".
- **Exit test:** matcher recall at least 80% at false positives at most 5% on the 20% hold-out (at least 400 confirmed reports in it); 3% of creators on Premium; first $10,000 paid to creators; 10,000 creators; cost per creator per month under 40 cents with people included.

### M4 - 100,000 creators (about Q2 2028)

- Build: automatic scanning for everyone at light cadence, full cadence for Premium; video matching; platform integrations (Meta IP Reporting API if approved: [Meta](https://developers.facebook.com/blog/post/2022/10/25/introducing-intellectual-property-reporting-api/)); election of board seats; licensing marketplace.
- Prove: cost per creator holds, and protection pays for itself.
- Cost, from [architecture.md](architecture.md) section 5 at 100,000 creators: hosting $3,586 per month; light scans $6,997; full scans for all would be $27,997, so full cadence is Premium only (3,000 Premium x 80 units x $3.50 per 1,000 = about $840); people: 2 to 4 on takedowns and trust-and-safety at $6,000 each, so about $25,000 to $45,000 per month all-in `[inferred]`.
- Kill risk: donations and Premium do not cover people. Premium at 3% is $12,000 per month; 1.5% donating $5 is $7,500 per month; the gap is a grant or fiscal-host line item.
- **Exit test:** 100,000 creators; cost per creator per month under 30 cents; monthly income at least 100% of monthly cost for 3 months in a row; at least 15,000 takedowns filed in a quarter with at least 65% removed; 12 months of costs in reserve or committed.

## 4. Growth engine

A loop, in order of strength:

```
creator finds a copy -> Report a copy -> removed -> Taken-down receipt posted
      ^                                                     |
      +---- friends ask "how?" -> invite link -> signs up --+
```

| Lever | How it compounds | First target |
| --- | --- | --- |
| Invites | Every creator gets invite links (API has them; 10 per user per day). A removal receipt carries the link. | 2 invites per creator by M1 |
| Creator protection | The receipt, plus a public "removed this week" counter (with consent). Proof, not claims. | 100 receipts shared by M2 |
| Open source | Public repo at M1, AGPL servers, MIT client SDKs. 10 starter issues, bounties from the community share of surplus at M3. Contributors also write the platform connectors (one per marketplace). | 5 outside contributors by M2, 150 by Y1 |
| Press | Three honest stories: "the stolen-art takedown desk run by a nonprofit", the public dataset, the public cost page. One story per milestone, no launch hype. Never a rival pitch. | 1 piece per milestone |
| Creator orgs and unions | The Authors Guild-led coalition, the Graphic Artists Guild, Concept Art Association, Professional Photographers of America ([source](https://www.publishersweekly.com/pw/by-topic/industry-news/licensing/article/91920-authors-guild-meets-with-legislators-over-generative-ai-concerns.html)). Offer: free takedown help for members, their members are our first cohort. Needs an intro. | 1 org partner by M2 |
| Other AT Protocol apps | Sign-in and followers interop where it makes sense; our dataset and takedown help usable by any app; Free Our Feeds and the Social Web Foundation as allies ([TechCrunch on Free Our Feeds](https://techcrunch.com/2025/01/13/a-new-campaign-aims-to-safeguard-social-media-from-billionaires-using-blueskys-underlying-tech); [Interledger gave $200,000 to the Social Web Foundation](https://interledger.org/es/node/1653)). | 1 joint post by M2 |

Cold-start rule: no feature goes in the app that does not serve post, report, or invite. Everything else waits.

## 5. Money

Nonprofit funding, in order of when it kicks in. Costs come from [architecture.md](architecture.md) section 5 (hosting about 4 cents per creator per month; people are the biggest line).

Corrections to the one-pager: NLnet's NGI Zero Commons Fund closed its final call on June 1, 2026 and paused open calls while it reviews the programme ([NLnet](https://www.nlnet.nl/commonsfund)), so do not count on it. Open Collective Foundation, the 501(c)(3) host, dissolved at the end of 2024 ([Open Collective statement](https://blog.opencollective.com/open-collective-official-statement-ocf-dissolution/)).

| Source | What it is | Link | Kicks in | Status |
| --- | --- | --- | --- | --- |
| Cloudflare for Startups credits | Credits for hosting; amounts sources disagree on ($10,000 to $250,000+), usually 1 year | [cloudflare.com/startups](https://cloudflare.com/startups/) | M0 apply, M1 to M3 use | Needs the LLC or entity; nonprofit eligibility unconfirmed |
| Donations | Open Collective / GitHub Sponsors / own page with the live cost page | [Open Source Collective](https://opencollective.com/opensource/updates/fees-arent-changing-but-how-we-show-them-is) (10% fee, a 501(c)(6), so gifts are not tax-deductible) | M2 (cost page + button) | 1.5% of users x $5 per month covers costs from about 30k users (one-pager) |
| NLnet Open Social / other NLnet calls | Fediverse and open-social grants | [NLnet Open Social](https://nlnet.nl/opensocial/) | Next call, date unknown | Commons Fund paused; check when the successor opens |
| Interledger Grant for the Web | Web Monetization grants; 2025 round was $400,000 total | [interledger.org/grant-web](https://interledger.org/grant-web) | Next call, status unconfirmed | Fit: creator payouts via Web Monetization `[inferred]` |
| Open Technology Fund, Internet Freedom Fund | Rolling, up to $900,000 | [OTF](https://www.opentech.fund/) `[inferred url]` | Apply at M2 | Fit weak: needs an internet-freedom angle (own accounts, no platform lock-in) |
| Internet Society Foundation | "Beyond the Net" program listed as open | [isocfoundation.org](https://www.isocfoundation.org/) | Apply at M2 | Scope unconfirmed |
| Sovereign Tech Agency | Germany; funds critical open-source infrastructure, Standards program paid ~EUR 5,000 a month stipends (closed May 2026) | [sovereign.tech](https://www.sovereign.tech/) | Year 2 | Fit: only the protocol-level parts, not the app |
| Mozilla Open Web Fund | Open-web projects; no 2026 deadline found | [grantedai listing](https://grantedai.com/grants/open-web-fund-mozilla-foundation-c7b819e6) | Check | Unverified, third-party listing |
| Foundation funds (Knight, Ford, Omidyar, others) | Not found in search this run | - | Year 2 | `[inferred]` they fund creators' rights and open social web; research before pitching |
| Premium | $4 per month: storage, rescans, notice builder, analytics | one-pager | M3 | 3% of creators |
| Creator fees | 5% on tips, subscriptions, licensing | one-pager | M3 | Revenue is tiny until creators earn through us |
| Hosted servers for brands and communities | one-pager | | M4 | `[inferred]` |

Cost-to-income by milestone (monthly): M1 about $60, covered by credits and founder; M2 about $150 plus counsel, covered by credits and founder; M3 about $4,500, needs $4,500 (grants, donations, Premium at 3% of 10,000 x $4 = $1,200); M4 about $25,000 to $45,000, needs $25,000 to $45,000 (Premium $12,000, donations $7,500, the rest grants or licensing).

Who holds the money (details in `asks.json`): start under Techguyver Labs LLC (the plan page default), move to a 501(c)(3) at M2. Options: Software in the Public Interest (a 501(c)(3) that took in projects after Open Collective Foundation closed, [source](https://opencollective.com/rwf2/updates/fiscal-host-transition); fit unconfirmed), your own 501(c)(3) (months), Open Source Collective (10%, not a charity). Hack Club's HCB is for teen-led projects, so it is out ([HCB](https://help.hcb.hackclub.com/en/articles/15409923-who-can-apply-for-fiscal-sponsorship)). Warning: creator payouts through a fiscal host may be restricted `[inferred]`; ask each host before applying.

## 6. The hard problems

| Problem | Our answer | Honest limit |
| --- | --- | --- |
| Copies inside closed platforms (Instagram, TikTok feeds) | Creators report what they see; we file with the platform's form or API. Meta's IP Reporting API is open to rights holders and their agents by application ([Meta](https://developers.facebook.com/blog/post/2022/10/25/introducing-intellectual-property-reporting-api/)); apply at M1. Agents on TikTok need a signed authorization letter (secondary source, architecture section 4). We never say "we watch Instagram". | We will not see them without the creator. YouTube Content ID is closed to individuals ([YouTube](https://support.google.com/youtube/answer/1311402)). |
| Crop-proof matching | Dataset first. Test a second matcher (SSCD, local features) against real crops and flips once there are 2,000 confirmed reports. Add flipped-hash lookup at once. | PDQ fails at 2% crop and on a flip (spike). CLIP failed. No promise until the hold-out test passes. |
| Moderation and CSAM | Day 0: no uploads public until a hash check runs. Cloudflare's free CSAM Scanning Tool on images served from the cache ([docs](https://developers.cloudflare.com/cache/reference/csam-scanning/)), PhotoDNA application, NCMEC CyberTipline registration; 18 U.S.C. 2258A makes reporting known CSAM a legal duty. Report button, public moderation log, a trust-and-safety contractor by M3, stackable labelers. | Whether Cloudflare's tool alone meets our 2258A duty needs counsel (sources conflict). Staff is the biggest cost at scale. |
| AI-generated fakes | Signed capture where a camera signs (Pixel, Leica, Canon), sign at upload otherwise, label unverified media in words. Tiers say exactly what was checked. | C2PA is stripped by re-encoding; most phones do not sign at capture. |
| Registry poisoning (a thief uploads first) | A near match to an earlier hash is held for review, not auto-credited. Earlier public date or camera credential wins. Counter-notice path from day one. | Review is human work. |
| Cold start | One wedge (section 2), 200 hand-sent DMs, 20 founding creators, free takedowns, invites with receipts. Bluesky accounts already hold a following (login not offered at launch because the founder chose own accounts; reconsider at M2 `[inferred]`). | A feed with 100 people is quiet. Profile pages and shareable receipts work without a feed. |
| Legal: DMCA agent | Register a designated agent with the Copyright Office: $6 per designation, renew every 3 years ([FAQ](https://www.copyright.gov/rulemaking/onlinesp/NPR/faq.html), [directory](https://www.copyright.gov/dmca-directory/)); needed to keep safe harbor under 17 U.S.C. 512(c)(2). Do it before any user uploads go public. | Fee and cycle come from the Office FAQ and law-firm summaries; confirm on the filing page. |
| Legal: wrong takedowns | Creator confirms every report; recorded authorization; counsel-reviewed template; fair-use check; never send on a match alone. Registration is not needed to send a notice but is needed to sue for US works `[inferred]`; "help them sue" is a referral. | Liability under 512(f) is ours as sender. |
| Legal: nonprofit | LLC now, 501(c)(3) via host or own filing by M2; AGPL code; no equity. | Own 501(c)(3) takes months `[inferred]`. |
| Legal: name | US search found no live EMERA mark in classes 9, 38, 41, 42, 45; Canada and EU unchecked; Emera Inc. (a big Canadian utility) is the likely objector; an App Store app "Emera" by Emera AI Inc. exists ([emera-checks.md](emera-checks.md)). | Get Canada and EU checked before spending on brand; use "Emera Social" or a descriptor in store listings. |
| PDS and key custody | Our own PDS on a small VPS (not Cloudflare Containers: container disk is wiped on restart); offline rotation key copy; hourly backups to R2; load test before promoting accounts ([architecture.md](architecture.md) risk 4). | Documented size is 1 to 20 users per 1 GB box; plan boxes accordingly. |

## 7. First 90 days, by week

Week 1 starts Monday 2026-11-16. M0 ends week 1. M1 target is week 7. M2 begins in week 13.

| Week | Dates | Do |
| --- | --- | --- |
| 1 | Nov 16 | M0: go live on emera.social; Resend sign-in email; handles claimed; DMCA agent filed; brand pick answered; Cloudflare for Startups applied; Canada/EU trademark looked up |
| 2 | Nov 23 | "Report a copy" form + saved report + email to us; ops page; dataset table; founder's profile and 10 posts; counsel booked |
| 3 | Nov 30 | Invite links live; app build on TestFlight and a web build; DMs to the first 20 founding creators (founder's list); privacy and terms for reports |
| 4 | Dec 7 | 20 founding creators in; we file their first notices by hand; CSAM hash check on upload; report button; public moderation log skeleton |
| 5 | Dec 14 | Notice builder (creator confirms); counsel-approved template; error alerts and visitor numbers; profile import; Meta IP Reporting API application |
| 6 | Dec 21 | 50 creators; first Taken-down receipts; open-source repo (leak scan first), CONTRIBUTING, 10 starter issues |
| 7 | Dec 28 | M1 check: 100 creators, 40 reports, 50% removal. Rewrite the wedge if the kill test hit |
| 8 | Jan 4 | Own PDS box up, load test; DID at sign-up; dataset terms live |
| 9 | Jan 11 | 300 creators; first creator-org intro calls; one press story (dataset + takedown desk) |
| 10 | Jan 18 | Passkeys; dashboard (reports, outcomes, receipts); public cost page and donate button |
| 11 | Jan 25 | 600 creators; fiscal-host applications sent (2 to 3); first grant applications (Open Technology Fund, Internet Society Foundation, Interledger if open) |
| 12 | Feb 1 | Open feeds with "why this post"; contributor bounties; export-and-leave test with 10 people |
| 13 | Feb 8 | M2 check: 1,000 creators, 300 reports, 5 outside contributors, host in writing. Decide whether to start the matcher pilot |

## Sources

Read this run (2026-11-13): [NLnet Commons Fund](https://www.nlnet.nl/commonsfund), [NLnet Open Social](https://nlnet.nl/opensocial/), [Copyright Office FAQ](https://www.copyright.gov/rulemaking/onlinesp/NPR/faq.html), [Open Source Collective fees](https://opencollective.com/opensource/updates/fees-arent-changing-but-how-we-show-them-is), [Open Collective on OCF dissolution](https://blog.opencollective.com/open-collective-official-statement-ocf-dissolution/), [HCB eligibility](https://help.hcb.hackclub.com/en/articles/15409923-who-can-apply-for-fiscal-sponsorship), [Interledger Grant for the Web](https://interledger.org/grant-web), [Interledger to Social Web Foundation](https://interledger.org/es/node/1653), [Cloudflare for Startups](https://cloudflare.com/startups/), [Cloudflare CSAM Scanning Tool](https://developers.cloudflare.com/cache/reference/csam-scanning/), [Meta IP Reporting API](https://developers.facebook.com/blog/post/2022/10/25/introducing-intellectual-property-reporting-api/), [Free Our Feeds (TechCrunch)](https://techcrunch.com/2025/01/13/a-new-campaign-aims-to-safeguard-social-media-from-billionaires-using-blueskys-underlying-tech), [Cara growth (Dataconomy)](https://dataconomy.com/2024/06/07/what-is-cara-app-and-how-to-use-it), [creator coalition (Publishers Weekly)](https://www.publishersweekly.com/pw/by-topic/industry-news/licensing/article/91920-authors-guild-meets-with-legislators-over-generative-ai-concerns.html), [Resend pricing](https://resend.com/pricing). Search results were summaries of pages, not the pages: grant amounts and deadlines need a check on the funder's own site before any application.
