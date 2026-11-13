# Open Instagram Alternative — One-Pager

Copied 2026-11-13 from the Claude doc (https://claude.ai/artifact/8ucGkttmGMA9wnoYzYZtQo), rev 17. The doc stays the live copy; re-export if it changes.

Visual version: [whiteboard](https://claude.ai/artifact/S5JCoHY7nfa4H4mUkF8CyL)

## The bet

Build a creator-first photo/video network on the **AT Protocol**, where identity is verified, every post carries provenance, and the ranking algorithm is public. Users can pick their own feeds and leave with their followers.

Instagram can't copy this. Its business is ad attention, so opacity, engagement bait and tolerated bots all help its numbers. Three things make this the right time:

- **Protocols exist now.** AT Protocol gives portable identity, open data and pluggable feeds and moderation. Flashes already runs a photo app on it and got about 30k downloads on its first day ([TechCrunch](https://techcrunch.com/2025/02/28/bluesky-based-instagram-alternative-flashes-launches-publicly)).
- **Provenance standards are shipping.** C2PA Content Credentials v2.3 exists. Pixel 10 phones and Leica/Canon cameras sign photos at capture.
- **Software is commoditized.** A small team with AI tooling can ship a polished client. The moat is no longer code. It is **trust, plus creators' economics**.

The gap: Pixelfed proves people want an alternative. But federation alone isn't the pitch. **"Your work is protected and you get paid"** is.

## Five pillars

| Instagram problem | Our answer | Mechanism |
| --- | --- | --- |
| Spam bots, fake followers | **Verified humans, visible** | Tiered personhood badges (passkey + device attestation → optional ID/World-style proof); bot accounts allowed but labeled |
| Stolen content, reposts | **Provenance by default** | C2PA signing at capture/upload, perceptual-hash registry, auto "original" link on every copy |
| No creator protection | **Built-in enforcement** | One-tap takedown across the network, DMCA agent as a service, licensing terms attached to each post |
| Gamed engagement, scams | **Costly to fake** | Reputation-weighted signals, rate limits by trust tier, public scam/report ledger |
| Opaque algorithm | **Open algorithm, user choice** | Default feed's ranking code is open source; users subscribe to any third-party feed or moderation labeler |

Rule of thumb: **every ranking or enforcement decision must be explainable to the affected user** ("why am I seeing this" / "why was this removed").

## Architecture

[embedded diagram in the doc: System architecture · AT Protocol, 10 services]

Writes go to the user's own PDS. A relay streams every event to independent services: AppView, provenance and labelers. Clients read assembled timelines back. The highlighted services are where we differentiate. Everything else is stock AT Protocol that anyone can run or replace.

## Stack

Cloudflare-first. Its zero-egress storage is the biggest single saving for a photo network. We use stock AT Protocol services wherever we can, and build only the trust layer.

| Layer | Pick | Why |
| --- | --- | --- |
| Protocol | **AT Protocol** with our own photo lexicon | Portable identity and data. Bluesky logins and followers work from day one. |
| Clients | **Expo** (iOS, Android, web); web on Cloudflare Pages | One codebase. Native camera module so C2PA signing happens on the device. |
| Identity | did:plc + **passkeys**, App Attest / Play Integrity | Phishing-proof login. Attestation makes bot farms expensive. |
| PDS (user data) | Bluesky's open PDS on **Cloudflare Containers** | Users can move out with their posts and followers. |
| APIs, AppView, feeds | **Workers** + **Postgres via Hyperdrive**; KV cache; D1 for small tables | Pay per request, scales to zero, no servers to run early. |
| Relay | Bluesky's relay + **Jetstream** into **Cloudflare Queues**; mirror our own later | Running a full relay early costs bandwidth for no gain. |
| Media | **R2**; image sizes made once at upload; our own HLS video encoding | No bandwidth fees, and no per-view or per-minute Images/Stream fees. |
| Provenance | **c2pa-rs** (WASM in Workers), PDQ hashes, **Vectorize** | Sign and verify credentials; find near-copies across the network. |
| Moderation | Ozone labeler, PhotoDNA CSAM matching, **Workers AI** classifiers | Labelers can be stacked, and users pick which ones they trust. |
| Payments | **Stripe Connect** for creators; Open Collective for donations | Payouts plus a public donation ledger. |
| License | **AGPL-3.0** servers, MIT client SDKs | Nobody can run a closed fork as a service. Integrations stay easy. |

## Trust and safety mechanics

**Anti-bot: make fake accounts cost money, not just time.**

1. Every account starts at Tier 0 (passkey + attested device). Reach, DMs and follows are rate-limited.
2. Tier 1 adds phone, account age and real engagement from trusted accounts. This is the reputation graph.
3. Tier 2 is optional proof-of-personhood (ID check or a privacy-preserving proof). It earns a "verified human" badge, not a paid checkmark.
4. Automated accounts are allowed but must self-declare. Undeclared automation gets labeled by the network's labeler.

**Anti-theft: the original always wins.**

1. On upload, the client signs a C2PA manifest (creator DID, timestamp, edits). Incoming camera credentials (Pixel, Leica, Canon) are verified and shown.
2. A PDQ perceptual hash and a CLIP-style embedding are added to a network-wide registry.
3. Any new upload matching an earlier hash is auto-attributed ("Original by @x"). If the original is marked no-reposts, it's held for review.
4. Creators get a dashboard of matches, including off-network ones found by reverse-image search, with one-click DMCA notices.

**Anti-scam/gaming:** likes and follows are weighted by the giver's trust tier. Bought engagement from Tier 0 farms counts as close to zero. Report outcomes are logged in a public transparency ledger.

## Transparency and accountability

No blockchain. AT Protocol already signs and publishes everything, and we add brakes on virality plus public logs that anyone can audit.

**Already built into the protocol:**

- Every account's posts, likes and follows are a signed, content-addressed record. Nobody, including us, can quietly edit or backdate them.
- The relay streams all public activity in real time. Watchdogs and researchers can spot coordinated pushes without asking us for access.
- Account identities (DIDs) sit in a public directory, so handle and key changes are traceable.

**Why not a blockchain:** data on a chain can never be deleted. That is fatal for illegal images (CSAM) and for privacy laws like GDPR. Chains are also slow and cost money per write, and tokens attract speculators and scammers. We get the tamper-proof part from an append-only log instead, the way Certificate Transparency works for HTTPS. A daily fingerprint stamped on Bitcoin via OpenTimestamps costs almost nothing.

**What we add:**

- **Virality brakes:** reach is earned in stages, with checks between each (diagram below).
- **Public reach log:** every boost the default feed gives a post is logged with the reason.
- **Declared promotion:** paid posts are labeled. Undeclared coordinated pushes get flagged by community labelers watching the public data.
- **Anonymous but accountable:** pseudonyms are fine. Every account shows a reputation card with its age, trust tier and past labels. A banned actor restarts at the lowest tier, and device checks make mass sign-ups expensive.
- **Public moderation log:** every takedown and label is logged with its reason, and can be appealed.

[embedded diagram in the doc: How a post earns reach · 4 stages, 3 gates, 1 public log]

A post that fails a check stops spreading and gets a public label, but it stays up. Removal goes through moderation.

## Nonprofit model and funding

It's a nonprofit with nobody to pay out. It runs like a healthy business, but surplus goes back to the network. If 1.5% of users give $5 a month, donations alone cover costs from about 30k users.

**Costs (estimates):** about 5.6¢ per user per month at scale, about 10¢ at 10k users.

| Cost per user, per month | Cents |
| --- | --- |
| Trust and safety staff (1 per 250k users at $6k/mo) | 2.4¢ |
| Video encoding + HLS on R2 | 1.0¢ |
| AppView Postgres | 1.0¢ |
| Media storage on R2 (0.5 GB/user) | 0.75¢ |
| Moderation ML | 0.3¢ |
| APIs and feeds on Workers | 0.1¢ |
| **Total** (+ $500/mo base) | **~5.6¢** |

People cost more than servers. Safety staff are the largest line.

**Income:**

- **Donations:** Open Collective and GitHub Sponsors, with a live public cost page showing what donors cover.
- **Premium:** $4/mo for more storage, original-quality downloads and analytics.
- **Creator fees:** 5% on tips, subscriptions and licensing.
- **Grants and credits:** Cloudflare for Startups, NLnet/NGI, foundations.
- **Hosted servers:** for brands and communities.

**Where the money goes, in order:**

1. **Run it:** servers, safety staff, a small team on capped salaries.
2. **Reserve:** keep 12 months of costs in the bank.
3. **Give back:** everything above that, paid out each quarter. The starting proposal, which users vote on yearly:
   - Creators ~40%, paid by reach from verified humans
   - Open-source contributors ~25%, as bounties for merged work
   - Users ~20%, as free Premium and storage credits
   - Community ~15%: moderators, local labelers, grants

**Guardrails:**

- A nonprofit foundation (e.g. a US 501(c)(3)) owns the code, brand and servers. There is no equity.
- Revenue that isn't charitable goes through a wholly owned subsidiary, the way Mozilla does it.
- Books are audited and public. Users elect board seats.
- Because users can leave with their data at any time, the foundation has to keep earning their trust.

## Build order and risks

Public beta comes at week 4 and public launch at week 12. Build things in this order:

- [ ] **Days 1–3:** Expo client and photo lexicon. Bluesky logins work from day one.
- [ ] **Week 1:** upload pipeline: R2, a Worker that makes image sizes, C2PA signing and checking.
- [ ] **Week 2:** PDQ hash registry that auto-credits "Original by @x".
- [ ] **Week 2:** basic safety: PhotoDNA, Ozone labeler, reporting.
- [ ] **Week 3:** open feeds (chronological plus an open-source default), with "why this post".
- [ ] **Week 4, beta:** 500 photographers; live cost page and donate button.
- [ ] **Week 5:** trust tiers and bot labels (App Attest, Play Integrity).
- [ ] **Week 6:** creator dashboard: theft matches and one-click DMCA.
- [ ] **Week 7:** tips and subscriptions via Stripe Connect; $4 Premium.
- [ ] **Week 8:** video: our own HLS encoding on R2, with no per-minute fees.
- [ ] **Week 10:** our own AppView and relay mirror; a marketplace for third-party feeds.
- [ ] **Week 12, launch:** licensing marketplace; foundation set up; Open Collective live.

**Top risks**

- **Cold start.** Mitigation: Bluesky interop from day 1. Seed with a niche that is hurt most by theft (photographers, illustrators, tattoo artists).
- **Moderation cost and liability (CSAM, harassment).** Mitigation: hash-matching from day 0, a stackable labeler model, and a funded trust-and-safety lead early.
- **Provenance gaps.** Most phones don't sign yet, and iPhone doesn't sign at capture. Mitigation: we sign at upload, and hash matching covers everything else.
- **Protocol dependency on Bluesky PBC.** Mitigation: AT Protocol is open and moving to the IETF. We run our own PDS, relay and AppView.
- **Donations fall short.** Mitigation: a live cost page from beta, Premium and creator fees as a second income line, and a 12-month reserve before anything is given back.

## Sources

- [Flashes launches publicly (TechCrunch)](https://techcrunch.com/2025/02/28/bluesky-based-instagram-alternative-flashes-launches-publicly)
- [Apps building on AT Protocol (TechCrunch)](https://techcrunch.com/2025/06/13/beyond-bluesky-these-are-the-apps-building-social-experiences-on-the-at-protocol/)
- [Pixelfed (Wikipedia)](https://en.wikipedia.org/wiki/Pixelfed)
- [Pixelfed launches mobile apps (TechCrunch)](https://techcrunch.com/2025/01/14/decentralized-instagram-alternative-pixelfed-launches-mobile-apps/)
- [C2PA adoption in 2026 (SoftwareSeni)](https://softwareseni.com/c2pa-adoption-in-2026-hardware-platforms-and-verification-reality)
- [C2PA on Pixel 10 (c2paviewer)](https://c2paviewer.com/articles/google-c2pa-pixel-10)

Figures like Bluesky's user count, take rates and the per-user cost model are approximate estimates, from memory and search snippets, not vendor quotes. The whiteboard's calculator lets you change the assumptions.
