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
| POST | `/v1/uploads` | `{ contentType, bytes, seconds? }` | `{ uploadId, uploadUrl }` |
| PUT | `uploadUrl` | raw file bytes | `{ media }` |

`media` = `{ id, kind: "image"|"video", contentType, width, height, alt, url, sha256, proof }`. `alt` is the description for people who cannot see it, an empty string when none was given. `proof` = `{ sha256, signedAt, signer }` - who uploaded it, and when, signed by the server. C2PA comes later.

Images (jpeg, png, webp, heic, up to 20 MB) are re-encoded on upload to WebP, longest side at most 2048 px, quality 82, with all metadata (EXIF, GPS) removed; `contentType` and `url` then say `image/webp`. `proof.sha256` is the stored file anyone can download; `proof.sourceSha256` is the file the creator sent. If the re-encoder is down, the original is stored and both hashes match. Videos get `width`/`height` read from the file (phone rotation applied). A video longer edge over 1920 px, up to 60 s and under 100 MB, is re-encoded in the background to H.264 1080p MP4 a minute or so after upload: the `url`, `sha256` and `signature` then change, `signedAt` and `sourceSha256` stay. Every video gets `posterUrl`, a JPEG frame at 1 s (0 s for shorter clips, longest side 1280 px), filled in by the same background job seconds after upload; until then it is `null` and the app shows the first frame of the video itself. Images have `posterUrl: null`. Notification `thumbUrl` uses the poster for a video post.

Limits v0: images up to 20 MB (jpeg, png, webp, heic), video up to 100 MB and 10 minutes (mp4, mov). 100 MB (104,857,600 bytes) is the Cloudflare request body cap on the Free plan for `api.emera.social`; a bigger PUT gets a 413 from Cloudflare before the Worker runs. `seconds` on `POST /v1/uploads` is optional: over 600 it is refused right away with 413 `too_long`. The PUT reads the length from the file itself and refuses a video over 600 s the same way, deleting the upload.

## Posts

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/v1/posts` | `{ mediaIds: [], caption, alt?, createdAt? }` | `{ post }` - `alt` is an object `{ "<mediaId>": "description" }`, up to 1000 characters each, only for files in this post (`bad_alt` otherwise) | `createdAt` (ISO, past only) is for imports.
| GET | `/v1/posts/:id` | - | `{ post }` |
| DELETE | `/v1/posts/:id` | - | `{ ok: true }` (owner only) |
| GET | `/v1/users/:handle` | - | `{ user, posts: [] }` newest first, `?cursor=` pages |
| GET | `/v1/feed` | - | `{ posts: [], cursor }` - newest first from everyone (chronological; ranking comes later). `?mode=following` (sign-in required) returns only people you follow. Signed-in viewers never see posts from accounts they blocked or muted, or that blocked them |

`post` = `{ id, author: user, caption, media: [media], createdAt, url }`

## Reports (copies of your work)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/v1/reports` | `{ postId, url, note? }` | `201 { report: { id, status } }` |
| GET | `/v1/reports` | - | `{ reports: [{ id, postId, url, note, status, createdAt }] }` the caller's own, newest first |

Only the post's author can report a copy of it (403 `forbidden` otherwise). `url` must be http(s), up to 2048 characters; `note` up to 2000. Unknown post is 404, bad input 400 (`bad_post`, `bad_url`, `bad_note`). `status` starts as `new`. Each report is also emailed to `REPORTS_TO` when that variable is set.

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
| POST | `/v1/invites` | `{ maxUses? }` (1 to 10, default 1) | `{ code, url }` - signed-in users make invite links; 409 `invite_limit` after 20 invites, 429 after 10 in a day |
| GET | `/v1/invites` | - | `{ invites: [{ code, url, uses, maxUses, createdAt, joined: [{ handle, displayName }] }], limit }` - newest first, only the caller's own |
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

## Fund: sponsors, watch time, creator earnings

Rules and every number: `docs/mission/funding-rules.md`. Constants live in `apps/api/src/fundRules.ts` and are echoed in `rules` below, so screens never hardcode them. Months are UTC `YYYY-MM`. Money is integer cents (USD).

**Switch:** the whole feature is on only when the API var `FUNDING` is `"on"` (dev and staging on, production off). When off, every route in this section returns 404 `not_found`, and the app hides the fund and earnings screens after one `GET /v1/fund` 404.

| Method | Path | Auth | Body | Returns |
| --- | --- | --- | --- | --- |
| POST | `/v1/watch` | user | `{ postId, seconds }` | `{ counted }` - seconds 1 to 30 (`bad_seconds`); `counted` is what survived the caps (0 for own posts, young accounts, capped) |
| GET | `/v1/fund` | - | - | `{ rules, month: monthSummary, sponsors: [sponsor], history: [monthSummary] }` - `month` is the open month, `history` closed months newest first (max 24) |
| GET | `/v1/fund/months/:month` | - | - | `{ statement }` - 404 if the month has no money and no watch time |
| GET | `/v1/me/earnings` | user | - | `{ rules, thisMonth: { month, seconds, totalSeconds, sharePpm, estimateCents }, months: [{ month, seconds, sharePpm, amountCents }], balanceCents, topPosts: [{ post, seconds }] }` - `topPosts` = your 5 most-watched posts this month |
| POST | `/v1/admin/fund/sponsorships` | admin | `{ sponsorName, sponsorUrl?, contactEmail?, amountCents, months: ["YYYY-MM"], status?: "paid"\|"pledged" }` | `201 { sponsorships: [sponsorship] }` - amount split equally across `months`, leftover cent on the first |
| POST | `/v1/admin/fund/sponsorships/:id/refund` | admin | - | `{ sponsorship }` |
| POST | `/v1/admin/fund/close` | admin | `{ month }` | `{ statement }` - safe to run twice (returns the frozen one); 400 `month_open` if the month has not ended |

Admin auth = `Authorization: Bearer <FUND_ADMIN_KEY>` (a wrangler secret; dev default `dev-fund-admin`). Wrong or missing key is 404, not 401.

`rules` = `{ version, creatorShare, photoCapS, videoCapS, creatorCapS, minViewerAgeH, heartbeatMaxS, payoutMinCents, closeDay }`.

`monthSummary` = `{ month, status: "open"|"closed", sponsoredCents, carryInCents, creatorPoolCents, emeraCents, totalSeconds, creators, sponsors, closedAt, sha256 }`. `creatorPoolCents` = carry in + creator share of sponsored. `creators` = how many creators have counted seconds.

`sponsor` = `{ name, url, amountCents }` for the open month, biggest first.

`sponsorship` = `{ id, sponsorName, sponsorUrl, month, amountCents, status: "pledged"|"paid"|"refunded", createdAt }`. Only `paid` counts toward the pool; `pledged` shows on the fund page as pledged. `contactEmail` is never returned.

`statement` = `monthSummary` plus `{ rulesVersion, sponsorships: [sponsorship], shares: [{ handle, seconds, sharePpm, amountCents }], carryOutCents }`. `shares` biggest first; `handle` is `null` for creators who asked not to be named. `sha256` is over the canonical JSON of the statement without `sha256` and `closedAt`, keys sorted, so anyone can re-check it. Open-month statements are live estimates with `sha256: null`.
