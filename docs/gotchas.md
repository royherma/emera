# Gotchas and learnings

Every milestone that closes adds its learnings here, and anything stale gets corrected or struck in the same commit. One entry per trap: what bit us, how to spot it, the fix. Newest first. Each entry is dated and says where it was learned.

## 2026-11-13 - Media shrink: photos to WebP, 4K video to 1080p

- **Uploads used to keep the camera's GPS.** An iPhone HEIC carried its latitude and `/media/*` served it to anyone. Photos now go through the Images binding (2048 px WebP q82), which drops EXIF/GPS. Spot a regression: `curl -s <media url> | grep -c -a GPS` must print 0.
- **The Images binding takes at most 20 MB in.** Photo cap is 20 MB (was 25). If the binding errors (free plan stops at 5,000 transforms a month with error 9422) the original is stored and logged `image shrink failed`.
- **The Media binding (video) has no local mode and caps at 100 MB in, 60 s out, 2000 px.** A longer clip would come back cut to 60 s, so only clips up to 60 s and under 100 MB are queued; longer 4K clips stay as uploaded. It took ~50 s for 10-26 s of 4K, too slow for the upload request, hence the `emera-video-<env>` queue. The binding is only in staging/prod config; tests pass a fake.
- **`/media/:key` rejected any key with a dash**, so the `<id>-1080.mp4` copy 404ed. The pattern allows one `-suffix` now.
- **The video swap changes the URL.** `<id>.mov` is deleted once `<id>-1080.mp4` is stored (about a minute after upload). Anything that saved the old URL string gets a 404; read `media.url` again.

## 2026-11-13 - Ops visibility: Slack, /admin, /ledger

- **Staging and production shared one Slack channel, so test runs looked like real signups.** Non-production notify now posts nothing unless `SLACK_NON_PROD=1`. Spot it: `curl https://emera-notify-staging.techguyver1337.workers.dev/health` says `"silent":true`.
- **Roy's own sign-ups were counted as people.** Owner emails live in the `OWN_EMAILS` wrangler secret (never in code, the repo is public); test domains and `X-TG-Tester` traffic are marked `Test` and left out of every count, the admin totals and the public ledger.
- **An account was announced before it had a handle.** The users feed now waits until a handle is set or 10 minutes pass, and stops the batch there so no later account skips ahead of it.
- **The site worker now runs before assets for every page** (`run_worker_first` in `apps/site/wrangler.jsonc`) to log visits server-side. A site deploy needs migration `0002_visits.sql` applied first, and the `OPS` service binding needs `emera-notify` deployed in the same env.
- **Gmail files mail sent to hello@/dmca@ as spam.** Both routing rules now go to the `emera-notify` Worker, which posts sender + subject to #emera-events and then forwards to `MAIL_FORWARD_TO` (secret). A Slack ping with no inbox copy means look in spam. Spot a broken forward: the Slack post says `forward failed`.
- **The site build needs `brand/` next to `apps/site`.** A `git archive` of only `apps/` fails `scripts/build.mjs`; deploy then ships the committed `public/`, which is what you want, but archive `brand` too if you rebuild.

## 2026-11-13 - M0: first deploys, open sign-up

- **New D1 migrations don't reach staging/prod on their own.** Production verify returned 500 because migrations 0002-0006 existed in `apps/api/migrations/` but were never applied remotely. Fix: before every API deploy, run `npx wrangler d1 migrations apply DB --env <env> --remote`, then deploy. Spot it with `npx wrangler d1 migrations list DB --env production --remote`. If it lists anything, prod is behind.
- **Deploy from a commit, not the working tree, when other agents share the repo.** One deploy shipped another session's half-merged API code. The web app deploy (`deploy/app/deploy.sh`) already builds from `git archive HEAD`. Do the same for the API and site before deploying while others work in parallel.
- **CORS must allow our tester header.** Browser e2e runs send `X-TG-Tester: 1`, and the API's CORS allow-list rejected it, which showed up as "Can't reach the server". It's now allowed in `apps/api/src/index.ts`. Any new API origin needs it too.
- **Don't send `X-TG-Tester` to Google Fonts.** It blocks the font files in headless screenshots. Scope the header to our own origins.
- **Resend rate-limits bursts.** Several sign-in codes in a few seconds gave a 500 from `/v1/auth/start`. `src/mail.ts` now retries 429/5xx twice. Space out e2e runs, and use `delivered+<tag>@resend.dev` so each run has a fresh address. The Resend API (`GET /emails`) lets a test read the code.
- **Symlinked node_modules leak the home path into the web build.** Expo writes absolute paths for files outside the project into asset URLs. `deploy/app/deploy.sh` copies deps with `cp -Rc` (an APFS clone, fast) instead. After every build, run `grep -rl "$HOME" deploy/app/dist`, which must print nothing.
- **A fresh .social domain takes a while to resolve here.** The registry published it within about 30 minutes, but this Mac's sandboxed resolver kept a negative cache. Verify with `dig @1.1.1.1` and `curl --resolve host:443:<ip>` before calling it down.
- **RDAP aggregators rate-limit.** rdap.org returned 429 fast. Query each registry's RDAP server from the IANA bootstrap (`data.iana.org/rdap/dns.json`) with 3-5 parallel requests at most. `.co` and `.so` have no RDAP.
- **Cloudflare Registrar's domain-check says "premium" without a price.** `GET /registrar/domain-search?q=<domain>` shows the premium price. Most single-word .art/.social names are $99-$10,000.
- **Single `/file/` route on the dashboard server needs an allow-list.** Only `.claude/artifacts`, `brand`, `docs`, `data/atlas-shots` and the README are served. Add a folder there, never a blanket path.
- **wrangler dev leaves a `workerd` child holding the port.** Killing the wrangler PID isn't enough. Find the child by port (`lsof -ti :<port>`) and kill that one PID. Never pkill.
- **A long-running `atlas --watch` keeps the code it started with** (2026-11-13). A 3-hour-old watcher kept writing `data/atlas.json` without `shots`, so every story showed "no capture" while 120 pictures sat on disk. The plan server now owns the build and spawns `tools/atlas/build.mjs` fresh on every change. Spot it: `node -e 'console.log(!!require("./data/atlas.json").shots)'` prints false.
- **Atlas captures need `playwright-core` + its own headless Chromium.** It is pinned in `tools/atlas/package.json`; after a version bump run `npx playwright-core install chromium-headless-shell` in `tools/atlas`, or every run dies in 1 s with "Cannot find module".
- **The capture script clicks buttons by their label.** When a sign-up screen renames a button (Finish became Start), every signed-in screen after it fails to capture. The run history on the Captures tab shows it as "Missed".
- **Atlas web-page captures boot their own API on port 5042** (`tools/atlas/pages.mjs`, claimed `agora-api-shots`): fresh temp D1, one invented creator `@kiln_studio` with 6 Openverse photos. Anything left on 5042 is killed by port before and after each run.
- **Playwright counts a fading-in toast as visible.** `waitFor` on the toast text passes at opacity 0, so the picture shows no toast. Wait ~700 ms after it appears before the screenshot.
- **`pod install` fails on this Mac with an openssl or `base64` gem error** (2026-11-13). rvm's Ruby 3.0 `pod` comes first on PATH and needs the missing openssl 1.1, and rvm's `GEM_HOME`/`GEM_PATH` also break Homebrew's `pod`. Run `env -u GEM_HOME -u GEM_PATH -u RUBYOPT -u RUBYLIB /opt/homebrew/bin/pod install`.
- **The iOS app crashed at launch: `Symbol not found: _OBJC_CLASS_$_RCTStatusBarAppearance`** (2026-11-13). The prebuilt React framework that CocoaPods downloads lacks that class, but ExpoModulesCore is compiled against the node_modules source, which has it. `app.json` sets `expo-build-properties` `ios.buildReactNativeFromSource: true`. Spot it: the newest `~/Library/Logs/DiagnosticReports/Emera-*.ips` names the symbol.
- **Mock mode keeps data in memory only.** A full page load or app restart drops the mock session, so test scripts move between screens inside the app (`history.pushState` on web, `emera:///route` links on iOS), never a fresh `goto`.
