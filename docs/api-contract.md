# API contract v0

The app (`apps/mobile`) and the API (`apps/api`) both build against this. Change it here first, then in both.

Base URL in dev: `http://agora-api.localhost:5036` (port claimed with `ports claim agora-api`). JSON everywhere. Auth is a bearer token: `Authorization: Bearer <token>`. Errors look like `{ "error": { "code": "string", "message": "plain words" } }`.

The brand name is never hardcoded. Read it from `packages/brand/brand.json`.

## Accounts (our own, passkeys next)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/v1/auth/start` | `{ email }` | `{ ok: true }` - emails a 6-digit code (dev: code printed to the API log, no email sent) |
| POST | `/v1/auth/verify` | `{ email, code }` | `{ token, user, isNew }` |
| POST | `/v1/auth/handle` | `{ handle, displayName }` | `{ user }` - first sign-in picks a handle (`[a-z0-9_]{3,20}`) |
| GET | `/v1/me` | - | `{ user }` |
| POST | `/v1/auth/logout` | - | `{ ok: true }` |

`user` = `{ id, handle, displayName, bio, avatarUrl, createdAt }`

## Media (our storage, R2)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/v1/uploads` | `{ contentType, bytes }` | `{ uploadId, uploadUrl }` |
| PUT | `uploadUrl` | raw file bytes | `{ media }` |

`media` = `{ id, kind: "image"|"video", contentType, width, height, url, sha256, proof }`. `proof` = `{ sha256, signedAt, signer }` - who uploaded it, and when, signed by the server. C2PA comes later.

Limits v0: images up to 25 MB (jpeg, png, webp, heic), video up to 200 MB (mp4, mov).

## Posts

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/v1/posts` | `{ mediaIds: [], caption, createdAt? }` (ISO, past only, for imports) | `{ post }` |
| GET | `/v1/posts/:id` | - | `{ post }` |
| DELETE | `/v1/posts/:id` | - | `{ ok: true }` (owner only) |
| GET | `/v1/users/:handle` | - | `{ user, posts: [] }` newest first, `?cursor=` pages |
| GET | `/v1/feed` | - | `{ posts: [], cursor }` - newest first from everyone (chronological; ranking comes later) |

`post` = `{ id, author: user, caption, media: [media], createdAt, url }`

## Reports (copies of your work)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/v1/reports` | `{ postId, url, note? }` | `201 { report: { id, status } }` |
| GET | `/v1/reports` | - | `{ reports: [{ id, postId, url, note, status, createdAt }] }` the caller's own, newest first |

Only the post's author can report a copy of it (403 `forbidden` otherwise). `url` must be http(s), up to 2048 characters; `note` up to 2000. Unknown post is 404, bad input 400 (`bad_post`, `bad_url`, `bad_note`). `status` starts as `new`. Each report is also emailed to `REPORTS_TO` when that variable is set.

## Public pages (served by the API Worker, server-rendered, no login)

| Path | What |
| --- | --- |
| `/@:handle` | Profile grid, with `og:` tags so a shared link shows a preview |
| `/p/:id` | One post, big, with `og:image` set to its first media |

## Invites

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/v1/invites` | `{ maxUses? }` (1 to 10, default 1) | `{ code, url }` - signed-in users make invite links; 409 `invite_limit` after 20 invites, 429 after 10 in a day |
| GET | `/v1/invites` | - | `{ invites: [{ code, url, uses, maxUses, createdAt, joined: [{ handle, displayName }] }], limit }` - newest first, only the caller's own |
| GET | `/v1/invites/:code` | - | `{ valid, invitedBy }` |

Sign-up needs an invite code while invites are on (`INVITES_REQUIRED=true`).
