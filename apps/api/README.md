# API (v0)

One Cloudflare Worker (Hono + TypeScript), D1 for data, R2 for media. Implements `docs/api-contract.md`. The brand name is read from `packages/brand/brand.json` and is never hardcoded.

## Run

```
npm install
npm run dev        # applies local migrations, then wrangler dev on :5036 (local D1 + R2)
npm test           # vitest in the Workers runtime (@cloudflare/vitest-pool-workers)
npm run smoke      # boots wrangler dev on :5039 with a fresh temp database, runs the whole flow with curl and a real PNG
npm run typecheck
```

Sign-in codes are printed to the wrangler log: `[auth] sign-in code for <email>: 123456`. In dev, invites are off (`INVITES_REQUIRED=false`). The seed invite code `welcome-dev` always works when invites are on.

## Env vars (`wrangler.jsonc`, per env)

| Var | Meaning |
| --- | --- |
| `ENVIRONMENT` | `dev`, `staging`, `production`. Non-dev with a placeholder `PROOF_SECRET` returns 500 `misconfigured` |
| `INVITES_REQUIRED` | `"true"`: new emails need an invite code |
| `SEED_INVITE_CODE` | An unlimited invite code for the first members. Replace before launch |
| `PROOF_SECRET` | HMAC key for upload proofs and sign-in code hashes. Set with `wrangler secret put` in staging and production |
| `PUBLIC_ORIGIN` | Origin for share links (post `url`, invite `url`, canonical). Empty = the request origin. Production: `https://emera.social` |

Bindings: `DB` (D1), `MEDIA` (R2). Placeholder resources: `emera-staging` / `emera-prod` (D1), `emera-media-staging` / `emera-media-prod` (R2). Production routes: `emera.social` and `api.emera.social`. None exist yet and nothing is deployed.

## Contract additions

- `POST /v1/auth/start` also takes an optional `invite` string (needed for new emails while invites are on).
- `proof` also carries `signature` (hex HMAC-SHA256 over `sha256.signedAt.signer`) and `alg`. `signer` is the uploader's handle.
- `GET /v1/invites/:code` returns `invitedBy` as a handle (or `null`).
- `GET /v1/users/:handle` and `/v1/feed` take `?limit=` (max 50) and return `cursor` (`null` at the end).
- Extra public pages: `/` (landing plus latest posts) and `/invite/:code`.
- Error codes you can switch on: `unauthorized`, `handle_required`, `handle_taken`, `invite_required`, `invite_invalid`, `unsupported_type`, `too_large`, `bad_file`, `not_found`.
- Videos need a `Content-Length` header on the PUT.
- CORS is open on `/v1/*` and `/media/*` (bearer tokens, no cookies).

## Stubbed or not done

- Email: `sendCode(email, code)` in `src/mail.ts` only logs. Production refuses to send until `delivery` is switched from `'log'` (Resend plugs in there).
- Proof is an HMAC with a shared secret, so only this server can verify it. C2PA and public-key signing come later.
- Video `width` and `height` are `0` (no mp4 parsing yet). No thumbnails or resized images.
- No endpoint to set bio or avatar; `avatarUrl` is `null`. Handles cannot be changed.
- No rate limiting beyond 5 sign-in codes per email per hour and 10 invites per user per day.
- Pending uploads that never finish are not cleaned up.
- Public profile page shows the latest 60 posts (no paging).
- Perceptual-hash copy detection is not built.
- The public pages were not checked in a real browser.
