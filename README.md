# Emera

[![CI](https://github.com/royherma/emera/actions/workflows/ci.yml/badge.svg)](https://github.com/royherma/emera/actions/workflows/ci.yml)

## The open source social network

AI is breaking the internet. Fake photos, cloned voices, bot crowds and stolen work spread faster than anyone can check them, and real people get drowned out. The same AI lets us build the fix, so we are building it.

Emera is a fair, honest place for every human being to share and talk. The people are real, every post carries proof of who shared it, and what you make keeps your name on it. Every line of code and the algorithm are public, and it is run as a nonprofit, so no one can quietly change the rules on you. It runs on the [AT Protocol](https://atproto.com), so your account and your followers are yours. Where humanity comes together.

Four things we build for:

- **Proof of who made it.** Every post carries a signed record of its maker, and the badge says exactly what was checked.
- **Real people.** People are marked, automated accounts say so.
- **An open algorithm.** The ranking code is public and every boost has a reason you can read.
- **You own your account.** Take your posts and followers with you at any time.

When someone copies a creator's work, the creator reports it and we help take it down. Protection today is manual: you send us the link, we help file the notice.

Site: [emera.social](https://emera.social). Mission and values: [docs/mission/mission.md](docs/mission/mission.md).

## Where we are

✅ done · 🟡 in progress · ⬜ next

### 🌅 M0 · Live on emera.social (week of Nov 16, 2026)

- ✅ [emera.social](https://emera.social), [app.emera.social](https://app.emera.social) and [api.emera.social](https://api.emera.social/health) live
- ✅ Sign up with an email code, invite links
- ✅ Post, follow, like, comment, search, notifications
- ✅ Report a copy of your work, from any post
- 🟡 Sign-in email lands in the inbox, not spam, 3 of 3 tries
- ⬜ @emerasocial on TikTok, YouTube, Instagram and Bluesky
- ⬜ DMCA agent registered
- ⬜ Founder profile with the first 10 posts

### 🌱 M1 · First 100 creators (by Dec 31, 2026)

- ✅ Public repo, CONTRIBUTING, code of conduct, security policy
- ✅ Error alerts and visitor numbers
- ✅ Bring your old posts over (`tools/import`)
- ⬜ Takedown notice builder: the creator confirms, we send it
- ⬜ Ops page to file and track every report
- ⬜ Abuse and CSAM basics
- 🎯 Exit test: 100 creators, 40 reports filed, half of sent notices end in removal within 14 days

### 🌍 M2 · 1,000 creators (by mid-Feb 2027)

- ⬜ Own PDS and portable accounts
- ⬜ Passkeys
- ⬜ Creator dashboard: your reports, outcomes, receipts
- ⬜ Open feeds with "why this post"
- ⬜ Public cost page and donations
- ⬜ Contributor program with bounties
- 🎯 Exit test: 1,000 creators, 35% still posting after 30 days, 5 outside contributors merged

### ☀️ M3 and M4 · 10,000 then 100,000 creators

- ⬜ Automatic copy matching, trained on the reports creators send
- ⬜ Tips and Premium, money paid to creators
- ⬜ Video on our own streaming
- ⬜ Scanning for everyone, platform integrations, board elections

Full plan with costs and risks: [docs/master-plan.md](docs/master-plan.md).

## Platforms

We want Emera on every screen creators and their audiences use. The full table, with the tech path, effort and who can own each one, is in [docs/platforms.md](docs/platforms.md), and the data is in [data/platforms.json](data/platforms.json).

| Group | Platforms | Where we are |
| --- | --- | --- |
| Web | Desktop and mobile web, PWA | Web live; PWA planned |
| Phones | iOS, Android | In code (Expo) |
| Tablets | iPad, Android tablets | In code, layout planned |
| TVs | Apple TV, Android TV and Google TV, Fire TV, Roku, Samsung Tizen, LG webOS | Planned, one `react-native-tvos` build covers three |
| Desktop | macOS, Windows, Linux | Planned, PWA first |
| Reach | Share cards, oEmbed, RSS, email digests, Bluesky feeds, browser extension | Planned |
| Other | Watch, car, VR, assistants and smart displays | Ideas |

## Run it locally

You need Node 22 or newer and npm. Each app has its own `package.json`; install inside each one first.

```bash
npm --prefix apps/api install
npm --prefix apps/mobile install
npm --prefix apps/site install
```

**API** (Cloudflare Worker, local D1 and R2) on port 5036:

```bash
npm --prefix apps/api run dev
npm --prefix apps/api test
npm --prefix apps/api run typecheck
npm --prefix apps/api run smoke
```

Sign-in codes print in the wrangler log. In dev, invites are off.

**App** (Expo web) on port 5037. With no `EXPO_PUBLIC_API_URL` it runs on mock data; set it to the API address to use the real thing:

```bash
npm --prefix apps/mobile run web
EXPO_PUBLIC_API_URL=http://localhost:5036 npm --prefix apps/mobile run web
npm --prefix apps/mobile run check
npm --prefix apps/mobile run ios
npm --prefix apps/mobile run android
```

**Landing page** on port 5038:

```bash
npm --prefix apps/site run migrate:local
npm --prefix apps/site run dev
```

**Provenance spike** (signs an image, checks the signature, matches a copy):

```bash
npm --prefix spikes/provenance install
npm --prefix spikes/provenance run demo
npm --prefix spikes/provenance run lexicons
```

## Repo layout

| Path | What |
| --- | --- |
| `apps/api` | Hono Worker: accounts, uploads, posts, public pages |
| `apps/mobile` | Expo app for iOS, Android and web |
| `apps/site` | emera.social landing page and early list |
| `packages/brand` | Name, tagline, colors and the AT Protocol namespace |
| `lexicons` | AT Protocol record definitions, `social.emera.*` |
| `spikes/provenance` | C2PA signing and perceptual-hash matching |
| `docs` | Mission, master plan, architecture, API contract, platforms |
| `data` | Machine-readable lists, such as platforms |

## What we build, what you can own

The core of Emera stays with the core team so it moves fast and stays safe. The projects around it are big, self-contained, and yours to own.

| 🔒 Core team builds | 🙌 You can own |
| --- | --- |
| Accounts, sign-in, invites | 🧩 Browser extension: report a copy of the page you are on |
| Posts, feeds, ranking | 🦋 Bluesky: feed generator for Emera creators, companion cross-posts |
| Proof of who made it (signing, badges) | 📺 TV apps: Android TV, Fire TV, Apple TV, Roku, Samsung, LG |
| Report a copy and takedowns | 🌐 Translations: Lingui setup and your language |
| Moderation and safety | ♿ Accessibility: screen reader pass, Reduce Motion, font scaling |
| Payments and payouts | 📱 Tablet layout for iPad and Android tablets |
| | 🐳 Self-hosting: Docker image for the API |
| | 🔗 Embeds: share cards, oEmbed, RSS feeds |

How to start:

1. Read [CONTRIBUTING.md](CONTRIBUTING.md): setup, the pull request flow, code style.
2. Pick a project from the right column. Each one has a full brief in the [help-wanted list](docs/help-wanted.json) and the [platforms plan](docs/platforms.md).
3. Open an issue saying you are taking it, so two people do not build the same thing.

## License

Two licenses, split by folder:

| Folder | License |
| --- | --- |
| `apps/api`, `apps/site` (servers) | AGPL-3.0, see `apps/api/LICENSE` and `apps/site/LICENSE` |
| everything else: `apps/mobile`, `packages`, `lexicons`, `spikes`, `tools` (client app and SDKs) | MIT, see `LICENSE` |

The Emera name, logo and brand artwork (`brand/`) are not covered by either license. Details in [CONTRIBUTING.md](CONTRIBUTING.md#licensing).

Built by Techguyver Labs for the Emera community.
