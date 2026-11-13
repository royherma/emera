# Contributing to Emera

Thank you for helping. Emera is a nonprofit network for every kind of creator, and it is better when people from outside the core team build parts of it. This guide gets you from zero to a merged pull request.

Be kind. We follow the [Code of Conduct](CODE_OF_CONDUCT.md): no harassment, assume good faith, and say what you mean plainly.

## Found a security problem

Do not open a public issue. Email oss@techguyverlabs.org, see [SECURITY.md](SECURITY.md).

## Setup

You need Node 22 or newer and npm.

```bash
git clone <repository-url> emera
cd emera
npm --prefix apps/api install
npm --prefix apps/mobile install
npm --prefix apps/site install
```

Run the pieces (full list in [README.md](README.md#run-it-locally)):

| What | Run | Check |
| --- | --- | --- |
| API on :5036 | `npm --prefix apps/api run dev` | `npm --prefix apps/api test`, `npm --prefix apps/api run typecheck`, `npm --prefix apps/api run smoke` |
| App on :5037 | `npm --prefix apps/mobile run web` | `npm --prefix apps/mobile run check` |
| Site on :5038 | `npm --prefix apps/site run dev` | open it and look |
| Provenance spike | `npm --prefix spikes/provenance run demo` | prints PASS |

The app runs on mock data unless `EXPO_PUBLIC_API_URL` points at an API. You never need a Cloudflare login for local work: wrangler uses a local D1 and R2.

## Pick an issue

1. Open the [help-wanted list](docs/help-wanted.json) or the issues labeled `good first issue` and `help wanted`.
2. Comment that you are taking it. One person per issue; if nothing happens for 14 days, someone else may take it.
3. For anything bigger than the issue describes, a new dependency, a new framework or a lexicon change, ask first and wait for a yes. Small, focused pull requests get reviewed fastest.
4. Want to own a whole platform such as Roku, Apple TV or a browser extension? Read [docs/platforms.md](docs/platforms.md), then open an issue saying which one and how you will start.

Labels you will see: `good first issue`, `help wanted`, `platform:<name>`, `i18n`, `accessibility`, `atproto`, `api`, `docs`, `tests`, `ci`.

## Branch and pull request flow

1. Fork the repo and branch from `main`: `git switch -c short-name-of-change`.
2. Make the change, with tests (see below).
3. Run the checks for every app you touched.
4. Commit with a clear message: what changed and why, in one line under 72 characters, then details if needed.
5. Open a pull request against `main`. The title becomes the changelog line, so write it for a user: "Add RSS feed for creator profiles", not "fix stuff". Describe what a person will notice, how you tested it, and attach screenshots for anything visual.
6. A maintainer reviews. Expect questions. Push fixes to the same branch.
7. We squash-merge. Do not commit build output or generated bundles.

AI tools are fine for helping you work. You are still the author: understand every line you submit and be able to explain it. We may ask.

## Code style

- TypeScript, strict. Match the files around yours.
- **No comments unless they warn about a landmine**: an ordering rule, a non-idempotent step, a constant that looks wrong and is not. One line. If the code needs explaining, rename it or split it.
- No dead code, no commented-out code, no tombstones for deleted code.
- The brand name is written only in `packages/brand/brand.json`. Read it from there.
- User-facing words: headings never end in a period, no em dashes, plain language, no jargon about the protocol. Copy never attacks another platform.
- Accessibility is part of done: 44pt (iOS) and 48dp (Android) targets, text that scales, Reduce Motion respected, verification state said in words and never by color alone, alt text on images.
- Demo and mock content uses only work we may use: your own, or CC0, CC BY or public domain, with credit recorded in `brand/content/sources.json`. Never scraped or unlicensed work. Invented people get invented names.

## Tests are required

A change that alters behavior needs a test in the same pull request.

- API: vitest in the Workers runtime, in `apps/api/test`. Run `npm --prefix apps/api test`.
- App: `npm --prefix apps/mobile run check` runs the typecheck and a web export. A unit-test runner is an open issue; until then, add stories for new components.
- Bug fix: add the test that fails without your fix.
- Lexicon change: ask for sign-off before writing the implementation, then add valid and invalid example records.

## Stories and coverage

Every screen and component is meant to have stories, small isolated states such as empty, loading, error, long text and large font. A coverage map of those states is being built as `npm run atlas`. When it exists, open [docs/atlas](docs/atlas) to see which states have a story and which do not. Until then, put a new component's states in the pull request description with screenshots.

## Translations

Strings are being moved to Lingui catalogs. Until that lands, open an issue for the language you want to add and we will tell you when the catalog is ready. Translators will get a proof-reading step so a second native speaker approves every language.

## Licensing

Server code (`apps/api`, `apps/site`) is AGPL-3.0. Everything else, including the client app (`apps/mobile`), packages, lexicons and tools, is MIT. The brand name, logo and artwork are not covered by either license. By contributing you agree your work may be released under the license of the folder you changed.

## Questions

Open a discussion or an issue and tag it `question`. We do not offer support for local build problems, but we do want to fix a quickstart that does not work: tell us exactly which step failed.
