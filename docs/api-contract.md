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

`user` = `{ id, handle, displayName, bio, links, avatarUrl, createdAt }` (`links` is a list of up to 5 http(s) URLs)

## Media (our storage, R2)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/v1/uploads` | `{ contentType, bytes }` | `{ uploadId, uploadUrl }` |
| PUT | `uploadUrl` | raw file bytes | `{ media }` |

`media` = `{ id, kind: "image"|"video", contentType, width, height, alt, url, sha256, proof }`. `alt` is the description for people who cannot see it, an empty string when none was given. `proof` = `{ sha256, signedAt, signer }` - who uploaded it, and when, signed by the server. C2PA comes later.

Limits v0: images up to 25 MB (jpeg, png, webp, heic), video up to 200 MB (mp4, mov).

## Posts

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/v1/posts` | `{ mediaIds: [], caption, alt? }` | `{ post }` - `alt` is an object `{ "<mediaId>": "description" }`, up to 1000 characters each, only for files in this post (`bad_alt` otherwise) |
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
| POST | `/v1/invites` | - | `{ code, url }` - signed-in users make invite links |
| GET | `/v1/invites/:code` | - | `{ valid, invitedBy }` |

Sign-up needs an invite code while invites are on (`INVITES_REQUIRED=true`).

## Search, profile edit, reports on posts and accounts

Search uses SQLite FTS5 (`users_fts`, `posts_fts`, migration `0006`). Each word is matched as a prefix and all words must match. Post search covers the caption and every image description.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/v1/search?q=&type=people` | - | `{ users: [user], cursor }` ranked by handle, then name, then bio |
| GET | `/v1/search?q=&type=posts` | - | `{ posts: [post], cursor }` ranked by caption, then description |
| PATCH | `/v1/me` | any of `{ displayName, bio, links, avatarMediaId }` | `{ user }` |
| POST | `/v1/flags` | `{ targetType: "post"\|"user", targetId, reason, note? }` | `201 { flag, duplicate: false }`, or `200 { flag, duplicate: true }` if you already reported it |
| GET | `/v1/flags` | - | `{ flags: [flag] }` the caller's own, newest first |

Search needs no sign-in. `q` is 1 to 100 characters (`bad_query`), `type` defaults to `people` (`bad_type`). `cursor` is the opaque value from the previous page, 20 results per page.

`PATCH /v1/me` needs a signed-in user with a handle and at least one field (`nothing_to_change`). `displayName` 1 to 50 characters (`bad_name`), `bio` up to 280 (`bad_bio`), `links` up to 5 http(s) URLs of up to 200 characters (`bad_links`). `avatarMediaId` is the `media.id` of one of your finished image uploads that is not in a post, or `null` to remove the avatar (`bad_avatar`). Upload the picture first with `POST /v1/uploads`, then send its id.

`/v1/flags` is the safety report on any post or account, separate from `POST /v1/reports` (a creator reporting a copy of their own work). `reason` is one of `spam`, `harassment`, `hate`, `violence`, `nudity`, `self_harm`, `impersonation`, `scam`, `other` (`bad_reason`). `targetId` is a post id or a user id (`bad_target`, 404 `not_found`). Reporting your own post or account is 400 `own_content`. More than 20 new reports in an hour is 429 `too_many`. `note` up to 1000 characters (`bad_note`).

`flag` = `{ id, targetType, targetId, reason, note, status, createdAt }`. `status` starts as `new`.
