# Platform coverage

Every screen we want Emera on. Source of truth is [data/platforms.json](../data/platforms.json); this table is generated from it. Updated 2026-11-13.

Status: **live** runs for real users, **in code** is built in the repo but not shipped, **planned** is decided, **idea** is worth doing but not decided. Exposure is 1 to 5. Effort is S (days), M (weeks), L (a month or more). "Outsiders" says whether a contributor outside the core team could own it.

## Top 5 for exposure per hour of work

1. **Share cards and oEmbed for `/@handle` and `/p/:id`** (effort S). Public pages already exist; a card image and an oEmbed route make every link pasted into X, iMessage, Slack or Discord show the work and its maker. Each share becomes an ad with no extra product.
2. **PWA install** (S). The Expo web build becomes installable on iOS, Android and desktop with a manifest and a service worker. No store review, works on every screen with a browser, and it is the base for the TV web apps.
3. **RSS/Atom feeds and email digests** (S then M). A feed per creator and one global feed need almost no UI. They reach readers, newsletters and automations that never open an app.
4. **Posts visible in Bluesky, plus a feed generator** (M). Bluesky already has the audience we want; a companion post with a link back, and a pinnable "Emera creators" feed, borrow that reach on day one.
5. **Android TV, Google TV and Fire TV from one `react-native-tvos` build** (L). The founder wants TVs. This is the cheapest way to hit three platforms with the code we already have; Apple TV follows from the same codebase.

Everything else waits on these: the TV apps and the extension need the share and API surface first.

## Phones

| Platform | Status | Tech path | Effort | Exposure | Why it matters | Outsiders |
| --- | --- | --- | --- | --- | --- | --- |
| iOS | in code | Expo app in apps/mobile (expo run:ios); TestFlight then App Store. Mock data only; needs API sign-in wired and Apple developer account. | M | 5 | Where most creators post from; the main app | partial |
| Android | in code | Same Expo codebase (expo run:android); Play internal track then production. Mock data only; needs release signing. | M | 5 | Largest phone base worldwide, strongest outside the US | partial |

## Web

| Platform | Status | Tech path | Effort | Exposure | Why it matters | Outsiders |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop and mobile web | live | Expo web export (apps/mobile) plus server-rendered /@handle and /p/:id pages from apps/api. Public pages on staging; emera.social serves the landing page and the app. | S | 5 | Every link works with no install, so every share reaches a person | yes |
| PWA (installable web app) | idea | Web manifest, service worker and icons on the Expo web build; add to home screen on iOS, Android and desktop Chrome. | S | 4 | Installable on every screen that has a browser, with no store review | yes |

## Desktop apps

| Platform | Status | Tech path | Effort | Exposure | Why it matters | Outsiders |
| --- | --- | --- | --- | --- | --- | --- |
| macOS | idea | PWA first; later Expo with react-native-macos or an Electron/Tauri shell around the web build. | M | 2 | Desktop creators review work here; the PWA covers most need | yes |
| Windows | idea | PWA first; later react-native-windows or a Tauri shell around the web build. | M | 2 | Large creator base on Windows; the PWA covers most need | yes |
| Linux | idea | PWA or a Tauri/Electron shell around the web build (AppImage, Flatpak). | M | 1 | Small audience, but a good first contribution from outsiders | yes |

## Tablets

| Platform | Status | Tech path | Effort | Exposure | Why it matters | Outsiders |
| --- | --- | --- | --- | --- | --- | --- |
| iPad | in code | Same Expo iOS build with supportsTablet and a wide layout (two-column feed). Needs responsive layout pass. | S | 3 | Creators sketch, edit and browse here; one flag plus layout work | yes |
| Android tablets | in code | Same Expo Android build with large-screen layouts and foldable support. | S | 2 | Free once the iPad layout exists | yes |

## TV

| Platform | Status | Tech path | Effort | Exposure | Why it matters | Outsiders |
| --- | --- | --- | --- | --- | --- | --- |
| Apple TV (tvOS) | idea | react-native-tvos (Expo supports it through the TV config plugin): one codebase with a focus-based layout and expo-video HLS playback. Needs a remote-first UI: focus rings, no text entry, sign-in by phone code. | L | 4 | Premium living-room screen; the founder asked for smart TVs | yes |
| Android TV and Google TV | idea | react-native-tvos Android TV target; same build as Fire TV. Needs leanback launcher entry and banner asset. | L | 4 | Largest TV platform by device count outside Apple; one build also feeds Fire TV | yes |
| Amazon Fire TV | idea | Same Android TV APK from react-native-tvos, submitted to the Amazon Appstore. Fire OS ships its own player quirks; test on a Fire Stick. | M | 4 | Cheap sticks put it in many homes; adds only a store listing once Android TV exists | yes |
| Roku | idea | Native SceneGraph channel in BrightScript/SceneGraph XML that reads a public JSON feed from apps/api (no React Native on Roku); a Direct Publisher feed is the cheapest start. Separate codebase; ideal for an outside contributor who knows Roku. | L | 4 | Roku is the top US streaming platform by share; creators reach a lean-back audience | yes |
| Samsung TV (Tizen) | idea | Packaged web app (Tizen Studio) wrapping the web build with spatial-navigation key handling. Needs a TV-safe web layout and a Samsung seller account. | M | 3 | Largest TV brand worldwide; the web build is reused | yes |
| LG TV (webOS) | idea | Packaged web app (webOS Studio) wrapping the same TV web layout as Tizen. Needs LG Seller Lounge account. | M | 3 | Second-largest TV brand; shares the Tizen work | yes |

## Watch

| Platform | Status | Tech path | Effort | Exposure | Why it matters | Outsiders |
| --- | --- | --- | --- | --- | --- | --- |
| Apple Watch (watchOS) | idea | Small native SwiftUI companion: notifications for new followers and report status; no feed. | M | 1 | Low exposure for creators; useful for alerts only | yes |
| Wear OS | idea | Small native Kotlin companion for alerts, same scope as watchOS. | M | 1 | Low exposure; alerts only | yes |

## Cars

| Platform | Status | Tech path | Effort | Exposure | Why it matters | Outsiders |
| --- | --- | --- | --- | --- | --- | --- |
| CarPlay and Android Auto | idea | Audio-only: Apple and Google restrict driving apps to audio, navigation, messaging and a few categories, so only a music or podcast post type would fit. Skip until audio posts ship. | L | 1 | Only makes sense for audio creators once audio posts exist | partial |

## VR and AR

| Platform | Status | Tech path | Effort | Exposure | Why it matters | Outsiders |
| --- | --- | --- | --- | --- | --- | --- |
| Apple Vision Pro | idea | Run the iPad app in compatibility mode first; native visionOS (SwiftUI/RealityKit) only for a gallery view. | M | 1 | Early adopters and press; works as an iPad app on day one | yes |
| Meta Quest | idea | Web app in the Quest Browser (PWA); a native Horizon app is not worth it yet. | S | 1 | The web build already works in the headset browser | yes |

## In-browser

| Platform | Status | Tech path | Effort | Exposure | Why it matters | Outsiders |
| --- | --- | --- | --- | --- | --- | --- |
| Browser extension (save and share) | idea | WebExtension (Chrome, Firefox, Safari): "Post this to Emera" and "Report a copy of this" on any page. | M | 3 | Puts the report-a-copy flow where creators find copies | yes |
| Share cards (Open Graph, Twitter Card) | in code | apps/api renders /@handle and /p/:id with og: tags; add generated card images (title, maker badge) via a Worker image route. Pages exist; per-post card image still to build. | S | 5 | Every link pasted into X, iMessage, Slack and Discord shows the work and the maker | yes |
| oEmbed and embeds | idea | /oembed endpoint returning JSON for /p/:id plus an iframe embed page, like bskyembed in bluesky-social/social-app. | M | 4 | Blogs, newsletters and Notion embed the post, each one a backlink | yes |

## Feeds

| Platform | Status | Tech path | Effort | Exposure | Why it matters | Outsiders |
| --- | --- | --- | --- | --- | --- | --- |
| RSS and Atom per creator | idea | /@handle/feed.xml and /feed.xml from apps/api, with media enclosures. | S | 4 | Readers, podcast apps and automations follow creators with no account | yes |
| Email digests | idea | Weekly Resend digest of followed creators, built from the same feed query; opt-in. | M | 3 | Reaches people who never open an app; sign-up already collects emails | yes |

## AT Protocol

| Platform | Status | Tech path | Effort | Exposure | Why it matters | Outsiders |
| --- | --- | --- | --- | --- | --- | --- |
| Other AT Protocol clients | idea | Publish social.emera.* lexicons and a docs page; clients read posts through the PDS and AppView APIs. Depends on stage A/B of the own-PDS plan in docs/architecture.md. | M | 3 | Instant reach into the existing AT Protocol app ecosystem | yes |
| Posts visible in Bluesky | idea | Write a companion app.bsky.feed.post (image and link card back to Emera) beside each social.emera.post, opt-in per creator. Design needs a check on how a custom record and the Bluesky record stay in sync [inferred]. | M | 5 | Bluesky has the audience today; every post carries a link back | yes |
| Feed generator | idea | Feed generator from bluesky-social/feed-generator that serves "Emera creators" as a custom feed inside Bluesky. | M | 3 | Pinned feeds in Bluesky bring followers without an install | yes |

## Assistants

| Platform | Status | Tech path | Effort | Exposure | Why it matters | Outsiders |
| --- | --- | --- | --- | --- | --- | --- |
| MCP server and assistant apps | idea | Read-only MCP server over the public API (search creators, read a post, start a report); a ChatGPT app can wrap the same API. | M | 2 | Assistants can answer "who made this" with a link to the proof | yes |
| Smart displays (Echo Show, Nest Hub) | idea | Web app in the display browser or a Fire TV-style app; digital-frame mode of a creator feed. | S | 1 | Ambient showcase for visual artists; low priority | yes |

## Notes

- Roku, Tizen and webOS facts and the CarPlay audio-only restriction are from general knowledge and have not been re-read against the current vendor docs `[inferred]`. Check them before starting.
- `react-native-tvos` is the community fork that adds Apple TV and Android TV to React Native, and Expo documents TV builds through a config plugin: [react-native-tvos](https://github.com/react-native-tvos/react-native-tvos), [Expo guide](https://docs.expo.dev/guides/building-for-tv).
- Bluesky ships its own embed, link and share-card services in the open (`bskyembed`, `bskylink`, `bskyogcard` in [social-app](https://github.com/bluesky-social/social-app)); they are the model for share cards and oEmbed.
- Counts: 30 platforms: 5 in code, 1 live, 24 idea.
