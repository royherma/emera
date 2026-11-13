# Emera (folder: agora)

**Emera. Where humanity comes together.** An open-source, nonprofit network for every kind of creator, on AT Protocol: every post carries proof of who made it, the people on it are real, the algorithm is open, and creators are protected when their work gets copied. The name comes from the Greek *hemera*, day or daylight. Roy picked it on 2026-11-13 and bought `emera.social` the same day. The folder is still `agora` until the build agents finish. The name lives only in `packages/brand/brand.json`.

Own git repo inside `techguyver-side-projects`, not a monorepo member. GitHub: `royherma/emera`, **public** since 2026-11-13 (history scrubbed of personal paths; backup bundle in `.claude/artifacts/backup/`). Public-first, see Publishing.

## Shared instructions

This file is the one rulebook for Claude Code, Codex and delegated agents. `AGENTS.md` only points here. When delegating, give the agent the checkout, the task, the paths it owns, and the validation commands, and tell it to read this file first. Two agents never own the same folder at the same time. A delegated agent's report is a claim: re-run its checks before ticking its step.

## Working in parallel

Several sessions and their sub-agents work on this repo at once. The shared-work board (the `mm-coord` command your session-start note prints) is how they see each other. Speed comes from never doing the same thing twice and never editing the same lines at once.

1. **Look first.** `npm run agents` prints live sessions, every claim, each worktree's changed files, files changed in more than one place, and the next free migration number. Work someone has claimed is theirs.
2. **Claim before the first edit.** `claim {work:"<feature-slug>", title, acceptance}`, with the paths you own in the first `update` note. A claim expires after 5 minutes without an `update`, so send one at every step (`state:"working"`, a short note). Finish with `state:"complete"` and the commit SHA in `refs`, or `released` if you drop it.
3. **A feature gets its own worktree** (`isolation: "worktree"` for sub-agents, `EnterWorktree` for a session). On `main`, only the session that merges edits shared files. A second session working straight on `main` touches only the paths it claimed.
4. **One merger.** The session that started the feature agents merges their branches into `main` one at a time, runs `npm --prefix apps/api test` and `npm --prefix apps/mobile run check` after each, and the rest rebase. After a merge, remove the worktree (`npm run agents` marks it "merged, safe to remove").
5. **Shared files take additions only**: `apps/api/src/index.ts`, `serialize.ts`, `apps/mobile/src/lib/{types,http,mock}.ts`, `_layout.tsx`, `docs/api-contract.md`, `docs/features.yaml`, `data/plan.json`. Add your lines; never reorder, reformat or rewrite someone else's.
6. **Migrations**: claim `migration-NNNN` (the number `npm run agents` prints) before creating `apps/api/migrations/NNNN_*.sql`.
7. **Need a change in someone else's paths?** `send` it to the owner with a stable `key`; don't edit it yourself. Answer handoffs with `ack`.
8. **`data/plan.json` workstreams**: update only your own row, and add `"owner": "<session label>"` to it.
9. **Deploys are one at a time** through `.claude/deploy-lock.json`; check it before you start.

## Read first

| What | Where |
| --- | --- |
| Product (impeccable format) | `PRODUCT.md` |
| Master plan + Roy's asks | `docs/master-plan.md`, `docs/asks.json` |
| Mission, values, manifesto (versioned) | `docs/mission/` - `values.json` feeds the dashboard |
| Architecture, costs, risks | `docs/architecture.md` |
| API contract (app and API both build to it) | `docs/api-contract.md` |
| Launch + first 1,000 creators | `docs/launch/` |
| Name, trademark, handles | `docs/naming.md`, `docs/emera-checks.md` |
| Roy's raw ideas, dated | `docs/ideas.md` (new ideas land here first) |
| Original plan doc + whiteboard | `docs/one-pager.md`, `source/whiteboard/`, https://claude.ai/artifact/8ucGkttmGMA9wnoYzYZtQo, https://claude.ai/artifact/S5JCoHY7nfa4H4mUkF8CyL |

## Product rules

- **Every creator, not one niche.** Video, art, photos, music, design, crafts, the physical things people make. Never "for photographers".
- **News and events too** (Roy, 2026-11-13): people sharing what is happening (local news, updates, events) belong here as much as makers. The proof on a post doubles as "is this real or fake": say only what was checked (who posted, when, original, person or bot), never "fact-checked" or "guaranteed real".
- **Lead with the mission, not "share your work"** (Roy, 2026-11-13): every public page opens with why Emera exists (creators getting ripped off, fake content, rules nobody can read, borrowed audiences) and what we do about it. Say "what you create", not "your work". Sharing is how people use Emera, never the pitch.
- Welcoming, never anti-Instagram or anti-anyone. Public copy may name the problems, never a platform.
- **Protection v1 is manual** (Roy, 2026-11-13): a creator reports a copy they found, we help file the takedown, and every report goes into a dataset that later trains automatic matching. Automatic scanning of other platforms is a later milestone. Don't build it now and don't promise it in copy.
- Every ranking or enforcement decision must be explainable to the person it affects.
- Mockups and demos use only content we're allowed to use: Roy's own work, or CC0/CC BY/public-domain images from Openverse with credit kept in `brand/content/sources.json`. Never scraped Instagram or other unlicensed work. A creator-protection network can't demo with stolen art.
- Invented demo creators get invented names and handles that belong to no real person.

## Keep it simple (Roy, 2026-11-13)

Every screen, flow and feature starts from: what is the fewest steps and words a first-time person needs? Cut the rest.
- **One screen, one ask.** No optional fields on sign-up; fill what we can guess (handle from name or email) and let people change it later.
- **Never ask twice.** Anything a person already typed (email on the landing page, a code from the link) carries forward; no second click to repeat it.
- **Plain words a non-creator gets.** "Your name", not "Your name or studio". No jargon, no niche words.
- **Anything is one click from any page.** The site footer (Emera, Answers, Compare, Legal columns, `apps/site/scripts/footer.mjs`) is the same on every page; a new page gets a footer link or it does not ship.
- **Lead with one line: "The open source social network"** (`brand.line`), then dial down to the mission. README, site, store text, posts.
- **Delete before you add.** A new field, setting, step or screen needs a reason Roy would agree with; "nice to have" is not one.
- Before shipping a flow, count the taps from landing page to first post and write the number in the commit. Lower is the goal.

## Copy rules

Headings never end in a period. No em dashes. Avoid "unlock", "elevate" and "seamless", "whether you're A or B", and padded lists of three. Never describe a feature as unbuilt or "coming soon" in shipped copy; that goes to Roy.

## Layout

| Path | What | Run | Check |
| --- | --- | --- | --- |
| `apps/api` | Hono Worker: accounts, R2 uploads, posts, public `/@handle` + `/p/:id` pages | `npm --prefix apps/api run dev` (:5036) | `npm --prefix apps/api test`, `npm --prefix apps/api run smoke` (:5039) |
| `apps/mobile` | Expo app, iOS + Android + web, mock mode when `EXPO_PUBLIC_API_URL` is unset | `npm --prefix apps/mobile run web` (:5037) | `npm --prefix apps/mobile run check` |
| `apps/site` | emera.social landing + early list (Worker + D1) | `npx wrangler dev --local --port 5038` in `apps/site` | screenshots in `.claude/artifacts/site-shots/` |
| `apps/notify` | Slack #emera-events (`C0CHFF8S47K`): cron polls both D1s each minute (visitors threaded per person, early list, accounts, posts, reports, flags) with place, device, source and Bangkok time; own/test accounts marked `Test`; 9 AM Bangkok daily summary; staging is silent unless `SLACK_NON_PROD=1`. Also serves `/admin` (key in `.claude/artifacts/admin-key.txt`) and `/api/ledger`, proxied through emera.social; `/github` takes the signed repo webhook | `npm --prefix apps/notify run deploy:production`; local preview with invented data `node apps/notify/scripts/preview.mjs` (:5041) | `npm --prefix apps/notify run deploy:production` | `npm --prefix apps/notify test` |
| `packages/brand` | name, tagline, colors, NSID - the only place the brand is written | - | - |
| `lexicons/` | AT Protocol lexicons `social.emera.*` | `npm --prefix spikes/provenance run lexicons` | - |
| `spikes/provenance` | C2PA sign/verify + PDQ copy matching | `npm --prefix spikes/provenance run demo` | prints PASS |
| `brand/` | brand directions, content for mockups | - | - |
| `plan/` + `data/plan.json` | Roy's dashboard | `npm run plan` | - |

Ports were claimed with `ports claim`: agora 5035 (dashboard), agora-api 5036, agora-app 5037, agora-site 5038, agora-api-smoke 5039. Never pick a port by hand.

## Environments

| Env | API | Site | Data |
| --- | --- | --- | --- |
| Local | http://agora-api.localhost:5036 | http://agora-site.localhost:5038 | wrangler local D1/R2 under each app's `.wrangler/` (gitignored) |
| Staging | https://emera-api-staging.techguyver1337.workers.dev | https://emera-site-staging.techguyver1337.workers.dev | D1 `emera-staging`, `emera-site-staging`; R2 `emera-media-staging` |
| Production | https://api.emera.social (live; app at https://app.emera.social) | https://emera.social, https://www.emera.social | D1 `emera-prod`, `emera-site`; R2 `emera-media-prod` |

Cloudflare account `db9eee5d30dc91c467044f8746e45206` (wrangler OAuth, no token needed). Secrets (`PROOF_SECRET`, `SEED_INVITE_CODE`) are set with `wrangler secret put --env <env>`, never in `wrangler.jsonc`. Seed invite codes are in `.claude/artifacts/seed-invites.txt` (gitignored).

## Deploying

Prelaunch with no real users: **deploy without asking**, staging first and then production, and verify each URL with curl (status pasted). Write `.claude/deploy-lock.json` around every deploy (`~/.claude/reference/rules/deploy-lock.md`). Remote D1 migrations first: `npx wrangler d1 migrations apply DB --env <env> --remote`. This expires the day real creators post; after that, production deploys get a review step.

**Deploy from a commit, never the working tree.** Other agents' half-done code sits in the working tree; build from `git archive HEAD` (or a clean worktree at the merge commit). Only the session holding the `merge-and-deploy` or ops claim deploys.

## Closing a milestone

When a dashboard milestone (`data/plan.json` phase) hits 100% or a workstream lands:
1. Add its traps to `docs/gotchas.md`: dated, one entry per trap (what bit us, how to spot it, the fix).
2. Re-read CLAUDE.md, README.md, `docs/api-contract.md`, `docs/master-plan.md` and the dashboard rows it touches; fix or strike anything stale in the same commit.
3. Re-run `npm run atlas` and `npm run atlas:shots` so the map is current.
4. Tag a GitHub release `m<N>-<slug>`.

## Publishing (open source)

The target is **public-first** like `techno-optimists` and `wreck-hunt`: the work happens in the public repo, and private data stays in gitignored paths. Before the first public push:
1. Add `oss.json` (`{"mode": "public-first", "public": "royherma/emera", "private_paths": [".dev.vars", ".env", "^\\.claude/"]}`).
2. `oss scan` until it's clean (Roy's email, full name and home path must not appear anywhere, including history).
3. `oss hook`, LICENSE (AGPL-3.0 for servers, MIT for client SDKs, per the plan), CONTRIBUTING.md and CODE_OF_CONDUCT.md.
4. `gh repo edit royherma/emera --visibility public` only after Roy says go.

Commits are authored by `Techguyver Labs <oss@techguyverlabs.org>` (set in this repo's local git config).

## Domain

`emera.social` was bought 2026-11-13 on Cloudflare Registrar, zone `89f5419a484e8cc56995a5fe4d68773d`. It expires 2027-11-13 and **auto-renew is OFF**. getemera.com was not bought (Roy chose only .social).

## Roy's dashboard

http://agora.localhost:5035 (`npm run plan`): milestones with % done, decisions, brand directions, the workstreams agents are running, mission, and what needs Roy. Every click lands in `data/feedback.jsonl` and prints a `DECISION` line in `.claude/artifacts/plan/server.log`. Keep `data/plan.json` current: tick a step the moment it's verified, and mark a workstream running/done when its agent starts or lands.

**Anything that needs Roy goes on the Review screen, never only in the terminal** (Roy, 2026-11-13). That covers a pick, a yes/no, a thing only he can do (a login, a filing, a payment), and anything an agent added that he should approve before it goes out (issues, copy, posts). Add it to `data/plan.json` `review` (an open `decisions` entry shows up there by itself): show the thing itself (the image, the list, the exact words, the link he clicks), one-line why, your pick, and buttons. His click comes back as a `DECISION` line with `kind: "review"`; act on it, then set `done` on the item. Remove an item the moment you can prove it's already done. An answer Roy gives anywhere else (terminal, another session, a screenshot) gets written into its card the same turn, so the screen never asks him twice.
