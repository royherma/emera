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
| POST | `/v1/posts` | `{ mediaIds: [], caption }` | `{ post }` |
| GET | `/v1/posts/:id` | - | `{ post }` |
| DELETE | `/v1/posts/:id` | - | `{ ok: true }` (owner only) |
| GET | `/v1/users/:handle` | - | `{ user, posts: [] }` newest first, `?cursor=` pages |
| GET | `/v1/feed` | - | `{ posts: [], cursor }` - newest first from everyone (chronological; ranking comes later). `?mode=following` (sign-in required) returns only people you follow. Signed-in viewers never see posts from accounts they blocked or muted, or that blocked them |

`post` = `{ id, author: user, caption, media: [media], createdAt, url }`

`user` also carries `followers`, `following` and, when the request is signed in, `viewer: { following, blocked, muted }`.

## Follow, block and mute

All writes need a signed-in user with a handle. Each returns `{ user }` with fresh counts and `viewer` flags. Repeating a call is safe.

| Method | Path | Returns |
| --- | --- | --- |
| POST | `/v1/follows/:handle` | follow. 400 `self` for your own handle, 403 `blocked` if you blocked them, 404 if they blocked you |
| DELETE | `/v1/follows/:handle` | unfollow |
| GET | `/v1/users/:handle/followers` | `{ users: [], cursor }` newest first, `?cursor=&limit=` pages |
| GET | `/v1/users/:handle/following` | `{ users: [], cursor }` same shape |
| POST | `/v1/blocks/:handle` | block: removes follows in both directions |
| DELETE | `/v1/blocks/:handle` | unblock |
| GET | `/v1/me/blocks` | `{ users: [], cursor }` accounts you blocked |
| POST | `/v1/mutes/:handle` | mute: their posts leave your feeds, nothing else changes |
| DELETE | `/v1/mutes/:handle` | unmute |
| GET | `/v1/me/mutes` | `{ users: [], cursor }` accounts you muted |

Lists and feeds hide accounts that are blocked in either direction with the viewer. A profile or list owned by someone who blocked you returns 404.

## Public pages (served by the API Worker, server-rendered, no login)

| Path | What |
| --- | --- |
| `/@:handle` | Profile grid, with `og:` tags so a shared link shows a preview |
| `/p/:id` | One post, big, with `og:image` set to its first media |

## Invites

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/v1/invites` | - | `{ code, url }` - signed-in users make invite links |
| GET | `/v1/invites/:code` | - | `{ valid, invitedBy }` |

Sign-up needs an invite code while invites are on (`INVITES_REQUIRED=true`).
