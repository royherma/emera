# Emera

[![CI](https://github.com/royherma/emera/actions/workflows/ci.yml/badge.svg)](https://github.com/royherma/emera/actions/workflows/ci.yml)

## The open source social network

Every line of code is public, the algorithm is public, and it is run as a nonprofit, so no one can quietly change the rules on you. What you create keeps your name on it and the people are real.

Emera is for everyone who creates (video, art, photos, music, design, the things people make with their hands) and everyone sharing what is happening around them. It runs on the [AT Protocol](https://atproto.com), so your account and your followers are yours. Where humanity comes together.

Four things we build for:

- **Proof of who made it.** Every post carries a signed record of its maker, and the badge says exactly what was checked.
- **Real people.** People are marked, automated accounts say so.
- **An open algorithm.** The ranking code is public and every boost has a reason you can read.
- **You own your account.** Take your posts and followers with you at any time.

When someone copies a creator's work, the creator reports it and we help take it down. Protection today is manual: you send us the link, we help file the notice.

Site: [emera.social](https://emera.social). Mission and values: [docs/mission/mission.md](docs/mission/mission.md).

## Status

| Piece | State |
| --- | --- |
| Landing page and early list ([apps/site](apps/site)) | Live at emera.social |
| API: accounts, uploads to R2, posts, public `/@handle` and `/p/:id` pages ([apps/api](apps/api)) | Running on staging |
| App for iOS, Android and web from one Expo codebase ([apps/mobile](apps/mobile)) | Being built, mock data |
| AT Protocol lexicons `social.emera.*` ([lexicons](lexicons)) | In the repo |
| Proof of maker: C2PA signing and PDQ copy matching ([spikes/provenance](spikes/provenance)) | Working spike |
| Production API at api.emera.social | Planned |
| Own PDS and portable accounts | Planned |

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

## How to help

Emera is built in the open and we want help, especially on the platforms we have not reached yet.

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the pull request flow and code style.
2. Pick something from the [help-wanted list](docs/help-wanted.json): about 30 scoped tasks, 13 of them good first issues.
3. See what other open-source social projects have that we are still building in the [gap checklist](docs/gap-checklist.md).
4. Own a platform. Roku, Samsung and LG TV, Apple TV, the browser extension and translations all work well as separate projects. Start in [docs/platforms.md](docs/platforms.md).

## License

Two licenses, split by folder:

| Folder | License |
| --- | --- |
| `apps/api`, `apps/site` (servers) | AGPL-3.0, see `apps/api/LICENSE` and `apps/site/LICENSE` |
| everything else: `apps/mobile`, `packages`, `lexicons`, `spikes`, `tools` (client app and SDKs) | MIT, see `LICENSE` |

The Emera name, logo and brand artwork (`brand/`) are not covered by either license. Details in [CONTRIBUTING.md](CONTRIBUTING.md#licensing).

Built by Techguyver Labs for the Emera community.
