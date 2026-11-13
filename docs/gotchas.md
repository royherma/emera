# Gotchas and learnings

Every milestone that closes adds its learnings here, and anything stale gets corrected or struck in the same commit. One entry per trap: what bit us, how to spot it, the fix. Newest first. Each entry is dated and says where it was learned.

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
