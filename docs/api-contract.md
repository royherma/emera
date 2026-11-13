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
| GET | `/v1/feed` | - | `{ posts: [], cursor }` - newest first from everyone (chronological; ranking comes later) |

`post` = `{ id, author: user, caption, media: [media], createdAt, url }`

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

## Likes, comments, notifications

Post JSON also carries `likeCount`, `commentCount` and `viewer: { liked }` (`liked` is false when the request has no sign-in).

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/v1/posts/:id/like` | - | `{ liked: true, likeCount }` - safe to repeat |
| DELETE | `/v1/posts/:id/like` | - | `{ liked: false, likeCount }` |
| GET | `/v1/posts/:id/comments` | - | `{ comments: [comment], cursor, total }` - top-level comments oldest first, each with its `replies` (oldest first); `?cursor=&limit=` pages, `total` counts replies too |
| POST | `/v1/posts/:id/comments` | `{ body, parentId? }` | `{ comment }` (201) |
| DELETE | `/v1/comments/:id` | - | `{ ok: true }` - the commenter or the post author; replies go with it |
| GET | `/v1/notifications` | - | `{ notifications: [notification], cursor, unread }` newest first, `?cursor=&limit=` pages |
| GET | `/v1/notifications/unread-count` | - | `{ unread }` |
| POST | `/v1/notifications/read` | `{ ids? }` | `{ ok: true, unread }` - no `ids` marks everything read |

`comment` = `{ id, postId, parentId, author: user, body, createdAt, replies: [comment] }`. `body` is 1 to 500 characters after trimming. `parentId` must be a top-level comment on the same post, so threads are one level deep (`bad_parent` otherwise). More than 10 comments in a minute from one person returns 429 `slow_down`. Errors: `bad_comment`, `comment_too_long`, `bad_parent`.

`notification` = `{ id, kind: "like"|"comment"|"reply"|"follow", actor: user, count, postId, thumbUrl, commentId, preview, createdAt, read }`. Likes on the same post fold into one unread notification (`count` grows, `actor` is the latest person). Nobody is notified of their own actions. `follow` notifications are created by the follow endpoints through `notify()` in `apps/api/src/notifications.ts`.
