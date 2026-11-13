# Gotchas and learnings

Every milestone that closes adds its learnings here, and anything stale gets corrected or struck in the same commit. One entry per trap: what bit us, how to spot it, the fix. Newest first. Each entry is dated and says where it was learned.

## 2026-11-13 - Fund: which Stripe account

- **A new Stripe account turns on Managed Payments by default**, and then every Checkout fails with "the product tax code is missing" (our API shows `stripe_error` 502). We sell sponsorships ourselves, so checkout sends `managed_payments[enabled]=false`. Spot it: the Stripe request log in Workbench for the failed `POST /v1/checkout/sessions`.
- **The shared Techguyver live Stripe account shows "RobotJobsHQ" to buyers.** Sponsors paying Emera through it would see RobotJobsHQ on the checkout and their card statement. Emera gets its own account; the API refuses to open a checkout when the key's account id is not `STRIPE_ACCOUNT_ID`. Spot it: `curl -s -u "$KEY:" https://api.stripe.com/v1/account` must name Emera (or the LLC sandbox in test mode).
## 2026-11-13 - Build time: a new app builds in under 10 minutes

- **The iOS build on GitHub took 57 minutes** (run 43405787939, `Build` step 10:06-11:03 UTC). `app.json` turned on `buildReactNativeFromSource` to get past one missing symbol (`RCTStatusBarAppearance`, see below), and that compiles all of React Native's C++ on every run. Never fix a crash by building a framework from source; find why the prebuilt one doesn't match (usually the `react-native` version in node_modules vs the prebuilt pod) and fix that.
- **Any build over 10 minutes is a bug, not a wait.** Spot it: `gh run view <id> --json jobs --jq '.jobs[].steps[]|"\(.name) \(.startedAt) \(.completedAt)"'`. Check step times while it runs; don't sit on a 45-minute "it's just slow".

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
- **2026-11-13: a new Email Routing rule bounces (550 5.1.1) for 2-4 minutes after it is created.** Test from Gmail, not Resend: one Resend bounce puts the address on Resend's suppression list and every later send says `suppressed`. `social@emera.social` (signup address for our social accounts) hit both.
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

## 2026-11-13 - Video posters and feed autoplay

- **expo-video on web ignores `player.play()` inside the `useVideoPlayer` setup.** No `<video>` is mounted yet, so nothing plays and the feed shows a paused clip at 0 s. Spot it: `document.querySelector('video').paused` stays true. Fix: call `play()` when `statusChange` reports `readyToPlay` (`Media.tsx` `LivePlayer`).
- **An SVG icon inside a gradient button vanishes on web.** The absolutely positioned `LinearGradient` paints over the unpositioned `<svg>`; text survives because RN-web Text is positioned. Fix: wrap the icon in a `View` (`ui.tsx` `Button`).
- **Posters come from the same queue job as the 1080p shrink, for every video.** Files of 100 MB or more get no poster (Media Transformations input cap); the web app then shows the video's own first frame. Videos posted before 0008 need a backfill: ffmpeg frame at 1 s, `wrangler r2 object put`, set `media.poster_key`.

## 2026-11-13 - Post media sizing

- **expo-video on web draws a portrait clip at its full file size (1080x1920) and shows only the top-left corner.** `VideoView` hands its RN style straight to a raw `<video>`, and a `<video>` does not stretch to `top/right/bottom/left: 0` the way a `View` does. Spot it: `document.querySelector('video').getBoundingClientRect()` is bigger than its box. Fix: always give it `width: "100%", height: "100%"` (`Media.tsx` `fill`).
- **Media box sizes come from one place: `apps/mobile/src/lib/mediaBox.ts`.** Feed crops to 4:5 through 1.91:1. The post screen shows the whole frame fitted to the window. Do not write `width / height` math in a screen again.
- **A video post's link preview needs the poster as `og:image`.** With only `og:video`, chat apps showed a bare text card. `pages.ts` `cover()` falls back to the first video's poster and adds `og:video:width/height`.

## 2026-11-13 - Click-to-edit site copy

- **Live site text can differ from `apps/site` source.** Roy edits copy in place (`/edit?key=<ADMIN_KEY>`); edits live in the site D1 `copy` table and the worker swaps them in by `data-e` key. Before rewriting landing text, check `SELECT page, key, live FROM copy` on `emera-site` and fold any live edit into the template first.
- **A `data-e` key is a hash of the element's tag + text at build.** Change that text in source and the key changes, so Roy's edit stops applying (the edit bar then counts it as "no longer on the page"). Fix: copy the edit into source, then delete its row.
- **Rewritten HTML must not answer 304.** The asset ETag survives HTMLRewriter, so a returning browser kept the old copy. `page()` strips `If-None-Match` and the ETag.

## 2026-11-13 - Video upload limits

- **Cloudflare caps a request body at 100 MiB on the Free plan, and `emera.social` is on Free.** Uploads are a PUT straight to the Worker (`/v1/uploads/:id`), so the zone cap is the real file cap: 104,857,600 bytes reached the Worker, one byte more got Cloudflare's 413 before the Worker ran. Spot it: a 413 with an HTML body, not our JSON. Fix: video max is 100 MB in `media.ts` and `upload.tsx`; going bigger needs a presigned direct-to-R2 upload or a Business plan (200 MB).
- **Video length is capped at 10 minutes (600 s).** `POST /v1/uploads` refuses `seconds > 600`; the PUT reads the length from the file and deletes the upload if it is over.

## 2026-11-13 - Small fixes shipped in-house

- **A Worker route with no trailing `*` does not match when the URL has a query string.** `emera.social/oembed` served `/oembed` but `/oembed?url=...` fell through to the site Worker's empty 404. Spot it: works on `api.emera.social`, empty-body 404 on `emera.social`. Fix: `emera.social/oembed*` and `emera.social/feed.xml*` in `apps/api/wrangler.jsonc`.
- **Workers static assets redirect `/x.html` to `/x` (307).** A service worker that precaches `/offline.html` stores a redirect it cannot serve offline. Fix: `pwa.mjs` caches `/offline`.
- **The site build reads `brand/` and `data/`, not only `apps/site`.** A deploy from `git archive HEAD apps/site` fails at `build.mjs` (ENOENT `brand/content/sources.json`) and ships the stale committed `public/`. Archive `brand docs data` too.
- **Merging a branch that untracks `apps/site/.wrangler` deletes the local D1 files from disk.** `git rm --cached` keeps them in the branch's worktree, but the merge removes them in `main`. Back up `apps/site/.wrangler` first and copy it back.

## 2026-11-13 - Workers rate-limit binding lets bursts through
- **Bit us:** `SIGNIN_LIMIT` set to 5/min let 27 of 30 quick calls pass on staging before the first 429. Cloudflare documents it as permissive and eventually consistent.
- **Spot it:** a burst test returns mostly non-429 even though the limit is far lower.
- **Fix:** treat the binding as a soft guard. Hard limits are the zone rate-limit rule (8 per 10 s per IP, api.emera.social and emera.social only, not workers.dev) and the D1 counts in `apps/api/src/limits.ts`.

## 2026-11-13 - `!/assets/*` in the site's `run_worker_first` hides app files
- What bit us: emera.social serves the site first and hands missing paths to the app worker, but `"!/assets/*"` made Cloudflare answer missing `/assets/...` itself, so the app's fonts (`/assets/node_modules/...`) 404ed and the page rendered blank.
- How to spot it: app on emera.social loads with no text; 404s on `/assets/node_modules/` in the network list.
- Fix: keep `/assets/*` out of the exclude list in `apps/site/wrangler.jsonc` so the worker sees the miss and calls `env.APP`.

## 2026-11-13 - A stray apps/api/wrangler.json shadows wrangler.jsonc
- **Bit us:** `npx json5 -c wrangler.jsonc` (meant as a syntax check) writes `wrangler.json`; idle autocommit committed it and wrangler reads `.json` first, so deploys shipped a stale config (old post cap, no */15 import cron).
- **Spot it:** `ls apps/*/wrangler.json`; deploy output vars differ from `wrangler.jsonc`.
- **Fix:** never run `json5 -c`; check syntax with `npx wrangler deploy --dry-run`.
