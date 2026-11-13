# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

Expo (iOS, Android, web) in `apps/mobile`, a marketing site in `apps/site`, a Cloudflare Worker API in `apps/api`. Servers on the AT Protocol (own PDS, own accounts), media in R2. Open source later (AGPL servers, MIT client SDKs). Platform and stack are from the founder's brief and `docs/one-pager.md`; the interview was inferred from them because no one could answer in this run (ASSUMED, reverse by re-running init).

## Users

Primary: creators of every kind who put work out in public: video makers, illustrators, musicians, designers, people who make physical things. They post from a phone, check it between work sessions, and share a link to it. They are worried that AI and reposters copy anything they make, and they are tired of platforms that hide how the feed works.

Also primary: people sharing what is happening around them: news from where they stand, local updates, events, a street festival, a flood on their road. They need people to trust that the moment is real and that they were the ones who shared it.

Secondary: people who follow creators and local voices because they want real work and real news from real people, not bot-fed noise or AI fakes.

Tertiary: press, grant funders and open-source contributors, who read the marketing site to judge whether the nonprofit means it.

## Product Purpose

Emera exists to fix a problem: people who create get ripped off online (copied, faked, buried by rules nobody can read), and that is solvable. It is an open-source, nonprofit network for everyone who creates and everyone who shares what is happening. Public copy leads with this mission, never with "share your work": sharing is how people use it, not why it exists. The name is from the Greek hemera, "day, daylight": your work out in the open. Tagline: **Where humanity comes together.** Domain: emera.social.

Success in v1: a creator signs up with an Emera account, posts a piece of work, sees a proof-of-maker badge on it, and understands within one screen that the work is protected and that real people see it.

## Positioning

Five things a neighboring network cannot truthfully copy, because its business depends on the opposite:

1. **Proof of who made it.** Every post carries provenance (signed at upload, original credited on every copy), real people are marked, bots must declare themselves.
2. **Protected everywhere.** Upload once; we watch other platforms for copies and file the takedowns for the creator. Legal escalation is part of the promise.
3. **Real, not fake.** The same proof that protects a maker tells a viewer a moment is real: who posted it, when, the original every copy points back to, and whether a person or a bot posted it. The badge never claims more than was checked: no fact-checking promise, no "100% real" seal.
4. **An open algorithm.** The default feed's ranking is open source, every boost is logged with its reason, users pick their own feeds.
5. **You own your account.** AT Protocol: leave with your followers and posts at any time. Creators are paid (tips, subscriptions, licensing; surplus is given back each quarter).

Tone is welcoming, never a rival pitch. It is not "screw Instagram"; it is a place to express and share.

## Operating Context

- Mostly phone, short sessions, one hand. Creators also review their own work on desktop web.
- Each post shows a proof-of-maker badge and a "why am I seeing this" answer.
- A creator dashboard shows copies found elsewhere and the takedowns filed.
- Run by a foundation with public books; a live cost page and a public moderation log are part of the product.

## Capabilities and Constraints

- Own accounts (not Bluesky login), phone app and web built together, media in our own R2 storage from day 1 (founder decisions, `docs/ideas.md`).
- Not photo-only: every word, icon and image must work for video, art, music, design and physical objects. No camera, lens or frame metaphors.
- Provenance uses C2PA content credentials and perceptual hashes; the badge must never claim more than was verified (tiers: attested device, trusted account, verified human).
- Undecided: pricing of Premium ($4/mo proposed), the payout split (proposal in `docs/one-pager.md`), moderation staffing.

## Brand Commitments

- Name: Emera. Tagline: Where humanity comes together. Domain emera.social. Meaning: hemera, day, daylight. NSID authority `social.emera`.
- Current placeholder tokens in `packages/brand/brand.json` (paper `#f6f3ec`, ink `#1c1a17`, accent `#e2573a`, accent2 `#2f7a5b`) are not approved; they get replaced by the founder's pick of a direction.
- Founder rejected anything old school or cringe. Wants epic, iconic, modern, in the spirit of 2025-26 launches, standing for expression, honesty, truth and creators.
- Public copy never attacks another platform.

## Evidence on Hand

Nothing public yet: no users, no creators, no press, no partners, no download numbers. Copy must not imply any. The Flashes figure (about 30k first-day downloads) in `docs/one-pager.md` is about another product and is not ours to quote as proof. Domain bought 2026-11-13.

## Product Principles

1. **Show the proof, not the claim.** Honesty is a visible mark on the work (who made it, when, how verified), never a paragraph about honesty.
2. **The work is the hero.** Creators' pieces lead every screen; the interface stays out of their way.
3. **Welcome first.** Warm and inclusive to a first-time poster; no gatekeeping, no jargon about protocols.
4. **Explain every decision.** Ranking, labels and takedowns each say why in plain words.
5. **Never overstate protection or verification.** A badge states exactly what was checked.

## Accessibility & Inclusion

Global, mixed-ability creators. WCAG AA contrast minimum, Dynamic Type and Android font scaling honored, 44pt/48dp targets, Reduce Motion respected, light and dark appearance, and verification state always said in words and shape, never by color alone. Captions and alt text prompts on every post.
