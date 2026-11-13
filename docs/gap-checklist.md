# Gap checklist: what mature repos have that Emera does not

Compared 2026-11-13 against [bluesky-social/social-app](https://github.com/bluesky-social/social-app) (Expo, MIT), [bluesky-social/atproto](https://github.com/bluesky-social/atproto), [pixelfed/pixelfed](https://github.com/pixelfed/pixelfed) (AGPL-3.0) and [mastodon/mastodon](https://github.com/mastodon/mastodon) (AGPL-3.0). File lists and labels were read with `gh api` on that date. Skylight and Flashes (AT Protocol apps) have no public source repository that we could find, so nothing is copied from them; see the note at the end.

What Emera has today: API tests (`apps/api/test`, vitest in the Workers runtime), typechecks for api and mobile, a smoke script, a provenance demo. What it lacks: any CI, LICENSE, CODE_OF_CONDUCT, SECURITY policy, issue or PR templates, mobile tests, translations, and a release process.

Effort: S is a day or two, M is about a week, L is a month or more. Each group is ranked by impact, highest first. "GFI" means a good first issue for an outside contributor.

## Top 10 across all groups

1. CI on every pull request (typecheck, tests, lint)
2. LICENSE files and a license map (AGPL-3.0 server, MIT client)
3. SECURITY.md with a private reporting address
4. Issue forms, PR template and labels
5. CODE_OF_CONDUCT.md with a named enforcement contact
6. i18n with Lingui and a translation platform
7. Mobile and web end-to-end tests
8. One-command local stack with seeded demo accounts
9. Moderation tooling (report queue, labels, public log)
10. Share cards and embeds for public pages

## Repo hygiene

- [ ] **LICENSE files and a map of what each covers.** How: social-app says in its README which assets (icons, art, logo) the MIT license does not cover and gives forking guidelines ([README](https://github.com/bluesky-social/social-app#readme)). Effort S. GFI no (founder decision).
- [ ] **CODE_OF_CONDUCT.md.** How: [Pixelfed](https://github.com/pixelfed/pixelfed/blob/dev/CODE_OF_CONDUCT.md) and [Mastodon](https://github.com/mastodon/mastodon/blob/main/CODE_OF_CONDUCT.md) both ship one at the root. Effort S. GFI no.
- [ ] **Issue forms (YAML) with required fields.** How: social-app has separate bug, Fabric bug and feature forms ([ISSUE_TEMPLATE](https://github.com/bluesky-social/social-app/tree/main/.github/ISSUE_TEMPLATE)); Pixelfed adds server, federation and admin report forms; Mastodon has a separate troubleshooting form. Effort S. GFI yes.
- [ ] **PR template.** How: [atproto](https://github.com/bluesky-social/atproto/blob/main/.github/PULL_REQUEST_TEMPLATE.md). Effort S. GFI yes.
- [ ] **Label set with areas, platform and difficulty.** How: Mastodon uses `fit for beginners`, `help welcome`, `expertise wanted`, `area/*` and `status/*` ([labels](https://github.com/mastodon/mastodon/labels)); atproto uses `good first issue` and `help wanted`; Pixelfed adds priority and `Accessibility`. Our set is in `docs/help-wanted.json`. Effort S. GFI yes.
- [ ] **CODEOWNERS.** How: [Pixelfed CODEOWNERS](https://github.com/pixelfed/pixelfed/blob/dev/CODEOWNERS). Effort S. GFI no.
- [ ] **Dependabot or Renovate.** How: [social-app dependabot.yml](https://github.com/bluesky-social/social-app/blob/main/.github/dependabot.yml), Mastodon and Pixelfed use Renovate. Effort S. GFI yes.
- [ ] **Stale-issue bot with a gentle message.** How: [Mastodon stale.yml](https://github.com/mastodon/mastodon/blob/main/.github/stale.yml). Effort S. GFI yes.
- [ ] **Editorconfig, formatter and linter pinned and run in a pre-commit hook.** How: social-app uses `.editorconfig`, oxlint, prettier and husky; atproto has a [STYLE_GUIDE.md](https://github.com/bluesky-social/atproto/blob/main/STYLE_GUIDE.md). Effort S. GFI yes.
- [ ] **AI contribution policy.** How: Pixelfed's README refuses AI-generated contributions; Mastodon links a separate AI Contribution Policy from CONTRIBUTING. Ours needs a founder decision, since our own work uses agents. Effort S. GFI no.
- [ ] **AGENTS.md / CLAUDE.md for coding agents.** How: social-app and atproto both ship them. We already have CLAUDE.md and AGENTS.md; check they hold nothing private before the repo goes public. Effort S. GFI no.

## CI and testing

- [ ] **GitHub Actions: typecheck, lint and tests on every PR, with a concurrency group that cancels old runs.** How: [social-app lint.yml](https://github.com/bluesky-social/social-app/blob/main/.github/workflows/lint.yml). Effort S. GFI yes.
- [ ] **Action versions pinned by commit SHA and a workflow security linter.** How: social-app pins SHAs and runs [zizmor.yml](https://github.com/bluesky-social/social-app/blob/main/.github/workflows/zizmor.yml). Effort S. GFI yes.
- [ ] **Lockfile check so a PR cannot sneak in a dependency change.** How: [verify-pnpm-lock.yml](https://github.com/bluesky-social/social-app/blob/main/.github/workflows/verify-pnpm-lock.yml). Effort S. GFI yes.
- [ ] **Mobile unit tests (jest) and component stories.** How: social-app runs jest (`pnpm test`); Mastodon runs Storybook visual checks through [Chromatic](https://github.com/mastodon/mastodon/blob/main/.github/workflows/chromatic.yml). Our atlas of stories is being built separately. Effort M. GFI yes.
- [ ] **End-to-end flows with Maestro against a mock server, nightly.** How: [docs/testing.md](https://github.com/bluesky-social/social-app/blob/main/docs/testing.md) and [nightly-e2e.yml](https://github.com/bluesky-social/social-app/blob/main/.github/workflows/nightly-e2e.yml). Effort L. GFI no.
- [ ] **Database matrix and migration tests.** How: Pixelfed runs tests across databases ([php-laravel-tests-db-matrix.yml](https://github.com/pixelfed/pixelfed/blob/dev/.github/workflows/php-laravel-tests-db-matrix.yml)); Mastodon has [test-migrations.yml](https://github.com/mastodon/mastodon/blob/main/.github/workflows/test-migrations.yml). Ours: replay D1 migrations from empty on every PR. Effort S. GFI yes.
- [ ] **Coverage reporting on PRs.** How: Mastodon has [codecov.yml](https://github.com/mastodon/mastodon/blob/main/.github/codecov.yml). Effort S. GFI yes.
- [ ] **Code scanning (CodeQL) and dependency audit.** How: Mastodon [codeql.yml](https://github.com/mastodon/mastodon/blob/main/.github/workflows/codeql.yml) and bundler-audit. Ours: CodeQL plus `npm audit`. Effort S. GFI yes.
- [ ] **Lexicon interop test files.** How: atproto keeps [interop-test-files](https://github.com/bluesky-social/atproto/tree/main/interop-test-files) shared across implementations. Ours: golden files for `social.emera.*` records. Effort M. GFI yes.

## i18n

- [ ] **Extract every string with Lingui and compile catalogs.** How: social-app uses Lingui (`lingui.config.ts`, `intl:*` scripts) and a [localization guide](https://github.com/bluesky-social/social-app/blob/main/docs/localization.md). Effort L. GFI no for setup, yes for each string batch.
- [ ] **Translation platform with proof-readers.** How: social-app, Mastodon and Pixelfed all use Crowdin (`crowdin.yml` in each repo); social-app requires proof-reader approval before a translation ships. Effort M. GFI yes.
- [ ] **CI check that catalogs are in sync.** How: Mastodon [check-i18n.yml](https://github.com/mastodon/mastodon/blob/main/.github/workflows/check-i18n.yml) and a nightly job that updates source languages in social-app. Effort S. GFI yes.
- [ ] **Right-to-left layout pass.** How: not verified in any of the four repos; own work. Effort M. GFI yes.

## Accessibility

- [ ] **Accessibility label and issue route.** How: Mastodon and Pixelfed both have an `accessibility` label. Effort S. GFI yes.
- [ ] **Alt-text and caption prompts on every post, screen reader pass on every screen.** How: product rule in `PRODUCT.md`; no repo checked here documents a test routine, so we write ours. Effort M. GFI yes.
- [ ] **Automated checks: contrast tokens, 44pt targets, Reduce Motion, font scaling.** How: own checks in the atlas. Effort M. GFI yes.

## Security policy

- [ ] **SECURITY.md with a private address and a response time.** How: [atproto SECURITY.md](https://github.com/bluesky-social/atproto/blob/main/SECURITY.md) promises acknowledgement within 3 business days and credit with consent; Pixelfed and Mastodon ship one too. Effort S. GFI no.
- [ ] **GitHub private vulnerability reporting switched on.** How: repo setting. Effort S. GFI no.
- [ ] **Secrets scanning and a leak scan before public.** How: our `oss scan` step in CLAUDE.md. Effort S. GFI no.
- [ ] **Rule that compiled or generated files are not committed by outsiders.** How: [Pixelfed CONTRIBUTING](https://github.com/pixelfed/pixelfed/blob/dev/CONTRIBUTING.md) says maintainers build the compiled assets so reviewers are not asked to read a bundle. Effort S. GFI yes.

## Moderation tooling

- [ ] **Report queue with a status and an audit trail.** How: Bluesky's open moderation tool [Ozone](https://github.com/bluesky-social/ozone); Mastodon's admin moderation area and `moderation` label. Ours starts as the manual "report a copy" flow in M1. Effort L. GFI no.
- [ ] **Labels as data, not hidden flags.** How: atproto labelers publish labels that any client can read; see the [atproto repo](https://github.com/bluesky-social/atproto). Effort M. GFI no.
- [ ] **Public moderation log with reason and appeal.** How: our values, not yet seen in these four repos. Effort M. GFI yes.
- [ ] **Abuse reports from people and admins as separate forms.** How: Pixelfed has [admin and federation report templates](https://github.com/pixelfed/pixelfed/tree/dev/.github/ISSUE_TEMPLATE). Effort S. GFI yes.

## Docs

- [ ] **CONTRIBUTING with a quickstart that actually runs.** How: [atproto CONTRIBUTING](https://github.com/bluesky-social/atproto/blob/main/CONTRIBUTING.md) lists Node version, one install command and seeded accounts. Ours is written; it needs a fresh-machine test. Effort S. GFI yes.
- [ ] **Development guide per environment.** How: [Mastodon docs/DEVELOPMENT.md](https://github.com/mastodon/mastodon/blob/main/docs/DEVELOPMENT.md); social-app has `docs/build.md`, `testing.md`, `deploy-ota.md`. Effort M. GFI yes.
- [ ] **Architecture decision records for each protocol or tooling choice.** How: atproto asks for sign-off on lexicon changes before code. Ours: a `docs/decisions/` folder. Effort S. GFI yes.
- [ ] **API reference generated from the contract.** How: Mastodon asks for a docs PR with every API change. Ours: generate from `docs/api-contract.md`. Effort M. GFI yes.
- [ ] **FEDERATION.md describing what we support.** How: [Mastodon FEDERATION.md](https://github.com/mastodon/mastodon/blob/main/FEDERATION.md) lists protocols and FEPs (FEP-67ff). Ours: lexicons and XRPC methods. Effort S. GFI yes.

## Release process

- [ ] **A written release model with names and tags.** How: [social-app release-model.md](https://github.com/bluesky-social/social-app/blob/main/docs/release-model.md): one `x.y.z` gives the branch, tag, document and GitHub Release. Effort S. GFI no.
- [ ] **Changelog built from PR titles.** How: Mastodon feeds the PR title into the changelog and release notes; atproto uses [changesets](https://github.com/bluesky-social/atproto/tree/main/.changeset). Effort S. GFI yes.
- [ ] **Over-the-air updates for the app.** How: social-app has [deploy-ota.md](https://github.com/bluesky-social/social-app/blob/main/docs/deploy-ota.md) and a `bundle-deploy-eas-update.yml` workflow. Effort M. GFI no.
- [ ] **Store build and submit workflows (iOS and Android).** How: social-app `build-submit-ios.yml` and `build-submit-android.yml` with EAS. Effort L. GFI no.
- [ ] **Nightly build channel.** How: Mastodon [build-nightly.yml](https://github.com/mastodon/mastodon/blob/main/.github/workflows/build-nightly.yml). Effort M. GFI no.

## Self-hosting

- [ ] **Docker image and compose file for the API.** How: Pixelfed ships `docker-compose.yml` and `DOCKER_COMPOSE_SETUP.md`; Mastodon ships a Helm chart in `chart/`. Ours: the Worker today runs only on Cloudflare, so a Node or workerd container needs design. Effort L. GFI no.
- [ ] **A PDS guide for people who want to host their own Emera accounts.** How: the Bluesky [pds repo](https://github.com/bluesky-social/pds). Effort M. GFI no.
- [ ] **Full local stack in one command with seeded accounts.** How: atproto's `pnpm dev` starts a PDS, AppView and PLC with fake accounts `alice.test`, `bob.test`, `carla.test`. Ours: seed script for `npm run api` plus the app. Effort M. GFI yes.
- [ ] **Devcontainer.** How: Mastodon [.devcontainer](https://github.com/mastodon/mastodon/tree/main/.devcontainer); Pixelfed has `.ddev`. Effort S. GFI yes.

## Federation and interop

- [ ] **Link, embed and share-card services.** How: social-app ships `bskyembed`, `bskylink` and `bskyogcard` as small services. Ours: Worker routes, see `docs/platforms.md`. Effort M. GFI yes.
- [ ] **Public lexicon docs and registry.** How: atproto publishes `lexicons/`; social-app installs them with `lex install`. Effort S. GFI yes.
- [ ] **Feed generator for Bluesky.** How: [bluesky-social/feed-generator](https://github.com/bluesky-social/feed-generator) (MIT starter kit). Effort M. GFI yes.
- [ ] **Account move and export tested by people.** How: atproto account migration, listed as a launch feature in our values. Effort L. GFI no.

## Analytics and privacy

- [ ] **Privacy policy in plain words and a list of what we log.** How: Mastodon and Pixelfed rely on instance policies; no central tracker in either repo that we read. Effort S. GFI no.
- [ ] **Privacy-first product analytics.** How: not verified in the four repos; choose a cookieless counter and publish what it counts. Effort M. GFI yes.
- [ ] **Error reporting with personal data scrubbed.** How: social-app pins a Sentry browser version in a lint script (`check-sentry-browser-version.mjs`). Ours: scrub rules, then enable. Effort S. GFI yes.
- [ ] **Public cost page.** How: our own value, no equivalent in these repos. Effort M. GFI yes.

## About Skylight and Flashes

Both are AT Protocol media apps built outside Bluesky. We found no public repository for either, so this checklist copies nothing from them. Skylight's team wrote up how they built it with Expo: [Expo blog](https://expo.dev/blog/how-we-built-a-tiktok-for-bluesky-with-expo.md). Worth reading for video playback and feed design.

## Counts

Run `grep -c '^- \[ \]' docs/gap-checklist.md` for the live number.
