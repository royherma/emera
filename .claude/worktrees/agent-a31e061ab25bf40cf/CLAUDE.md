# Emera (folder: agora)

**Emera. Where humanity comes together.** An open-source, nonprofit network for every kind of creator, on AT Protocol: every post carries proof of who made it, the people on it are real, the algorithm is open, and creators are protected when their work gets copied. The name comes from the Greek *hemera*, day or daylight. Roy picked it on 2026-11-13 and bought `emera.social` the same day. The folder is still `agora` until the build agents finish. The name lives only in `packages/brand/brand.json`.

Own git repo inside `techguyver-side-projects`, not a monorepo member. GitHub: `royherma/emera`, **private** until the first leak scan passes, then public-first (see Publishing).

## Shared instructions

This file is the one rulebook for Claude Code, Codex and delegated agents. `AGENTS.md` only points here. When delegating, give the agent the checkout, the task, the paths it owns, and the validation commands, and tell it to read this file first. Two agents never own the same folder at the same time. A delegated agent's report is a claim: re-run its checks before ticking its step.

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
- Welcoming, never anti-Instagram or anti-anyone. Problem/fix tables stay internal.
- **Protection v1 is manual** (Roy, 2026-11-13): a creator reports a copy they found, we help file the takedown, and every report goes into a dataset that later trains automatic matching. Automatic scanning of other platforms is a later milestone. Don't build it now and don't promise it in copy.
- Every ranking or enforcement decision must be explainable to the person it affects.
- Mockups and demos use only content we're allowed to use: Roy's own work, or CC0/CC BY/public-domain images from Openverse with credit kept in `brand/content/sources.json`. Never scraped Instagram or other unlicensed work. A creator-protection network can't demo with stolen art.
- Invented demo creators get invented names and handles that belong to no real person.

## Copy rules

Headings never end in a period. No em dashes. Avoid "unlock", "elevate" and "seamless", "whether you're A or B", and padded lists of three. Never describe a feature as unbuilt or "coming soon" in shipped copy; that goes to Roy.

## Layout

| Path | What | Run | Check |
| --- | --- | --- | --- |
| `apps/api` | Hono Worker: accounts, R2 uploads, posts, public `/@handle` + `/p/:id` pages | `npm --prefix apps/api run dev` (:5036) | `npm --prefix apps/api test`, `npm --prefix apps/api run smoke` (:5039) |
| `apps/mobile` | Expo app, iOS + Android + web, mock mode when `EXPO_PUBLIC_API_URL` is unset | `npm --prefix apps/mobile run web` (:5037) | `npm --prefix apps/mobile run check` |
| `apps/site` | emera.social landing + early list (Worker + D1) | `npx wrangler dev --local --port 5038` in `apps/site` | screenshots in `.claude/artifacts/site-shots/` |
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
| Production | https://api.emera.social (not deployed yet: sign-in email isn't wired) | https://emera.social, https://www.emera.social | D1 `emera-prod`, `emera-site`; R2 `emera-media-prod` |

Cloudflare account `db9eee5d30dc91c467044f8746e45206` (wrangler OAuth, no token needed). Secrets (`PROOF_SECRET`, `SEED_INVITE_CODE`) are set with `wrangler secret put --env <env>`, never in `wrangler.jsonc`. Seed invite codes are in `.claude/artifacts/seed-invites.txt` (gitignored).

## Deploying

Prelaunch with no real users: **deploy without asking**, staging first and then production, and verify each URL with curl (status pasted). Write `.claude/deploy-lock.json` around every deploy (`~/.claude/reference/rules/deploy-lock.md`). Remote D1 migrations first: `npx wrangler d1 migrations apply DB --env <env> --remote`. This expires the day real creators post; after that, production deploys get a review step.

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
