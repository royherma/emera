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

Images (jpeg, png, webp, heic, up to 20 MB) are re-encoded on upload to WebP, longest side at most 2048 px, quality 82, with all metadata (EXIF, GPS) removed; `contentType` and `url` then say `image/webp`. `proof.sha256` is the stored file anyone can download; `proof.sourceSha256` is the file the creator sent. If the re-encoder is down, the original is stored and both hashes match. Videos get `width`/`height` read from the file (phone rotation applied). A video longer edge over 1920 px, up to 60 s and under 100 MB, is re-encoded in the background to H.264 1080p MP4 a minute or so after upload: the `url`, `sha256` and `signature` then change, `signedAt` and `sourceSha256` stay. Every video gets `posterUrl`, a JPEG frame at 1 s (0 s for shorter clips, longest side 1280 px), filled in by the same background job seconds after upload; until then it is `null` and the app shows the first frame of the video itself. Images have `posterUrl: null`. Every video with speech also gets `captionsUrl`, a WebVTT file (`text/vtt`) written by Workers AI Whisper (`@cf/openai/whisper-large-v3-turbo`, spoken language detected) in the same background job; short lines of up to ~7 words. It is `null` for images, for videos nobody speaks in, and until the job finishes. The app shows captions only when the viewer turns them on (CC button, remembered like sound); the public post page adds them as a `<track kind="captions">`. Notification `thumbUrl` uses the poster for a video post.

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
| `/p/:id` | One post, big, with `og:image` set to its share card, `twitter:card=summary_large_image` and an oEmbed `<link rel="alternate">` |
| `/p/:id/card.png` | 1200x630 PNG share card: the post's first photo (or video poster), maker name and handle, a proof line in words. Cached 1 h in the browser, 1 day at the edge. 404 for an unknown post |
| `/oembed?url=` | oEmbed 1.0 JSON (`type: "rich"`, iframe `html`, `thumbnail_url` = the card) for a `/p/:id` link on `emera.social`, `www.`, `api.`, `app.` or the request host. 400 with no or a malformed `url`, 404 for a non-Emera link or unknown post, 501 for `format=xml`. `maxwidth` (240 to 550) and `maxheight` shrink the iframe |
| `/embed/:id` | Small iframe-safe page for one post (first media, name, caption, link back to `/p/:id`); no download controls; any site may frame it |
| `/@:handle/feed.xml` | Atom feed of that creator's 50 newest posts, one `rel="enclosure"` link per file. 404 for an unknown handle |
| `/feed.xml` | Atom feed of the 50 newest posts from everyone |

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

## Connect an AI app, import, auto-post

`/mcp` is an MCP server (Streamable HTTP, stateless JSON-RPC, protocol `2025-11-25` back to `2024-11-05`). Add `https://api.emera.social/mcp` as a connector in claude.ai, ChatGPT, Claude Code or Cursor; the app signs in with OAuth 2.1 (dynamic client registration + PKCE S256) and the person approves with an email code on `/oauth/authorize`. Access tokens are `sessions` rows with `client_id` set (30 days), refresh tokens rotate (1 year). Tools: `whoami`, `preview_import`, `import_posts`, `auto_post`, `list_connections`, `create_post`, `list_my_posts`.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/.well-known/oauth-protected-resource` | - | `{ resource, authorization_servers }` |
| GET | `/.well-known/oauth-authorization-server` | - | OAuth metadata |
| POST | `/oauth/register` | `{ client_name, redirect_uris }` | `201 { client_id, ... }` public client, no secret |
| GET | `/oauth/authorize` | query: `response_type=code, client_id, redirect_uri, code_challenge, code_challenge_method=S256, state` | sign-in + Allow page |
| POST | `/oauth/token` | form: `authorization_code` or `refresh_token` grant | `{ access_token, refresh_token, expires_in }` |
| POST | `/mcp` | JSON-RPC | `401` + `WWW-Authenticate: Bearer resource_metadata=...` without a token |
| POST | `/v1/import/preview` | `{ from, limit? }` | `{ source, items: [{ id, url, date, caption, photos, videos, thumb, onEmera }] }` |
| POST | `/v1/import` | `{ from, limit?, only?, autoPost? }` | `{ imported: [{ item, post }], skipped: [{ item, why }] }` |
| GET | `/v1/sources` | - | `{ sources: [source] }` |
| POST | `/v1/sources` | `{ from, autoPost?, rules? }` | `{ source }` turns auto-post on (default) or off; `rules` = `{ media: any\|photos\|videos, tag? }` |
| DELETE | `/v1/sources/:id` | - | `{ ok: true }` |
| GET | `/v1/connectors` | - | `{ connectors: [{ id, name, example }], locked: [{ name, why }] }` |

`from` is a Bluesky handle (`@name.bsky.social`, a `bsky.app/profile/` link or a did), a Mastodon profile link (`/@name` gets `.rss`), or any RSS/Atom feed or page that links one. Instagram, TikTok, X and Facebook links return 422 `source_locked` with what to do instead. Only items with photos or videos come over; captions keep up to 2200 characters, dates keep the original time. Each source item is imported once per person (`imported_items`). Up to 25 posts per import call.

`source` = `{ id, from, kind, label, autoPost, rules, since, lastChecked, lastError }`. Each place to import from is a connector, one file in `apps/api/src/connectors/`; see `docs/connectors.md`. `POST /v1/import` takes `only: [itemId]` from the preview to bring over just those. A cron every 15 minutes reads the 10 newest items of each auto-post source and posts those made after `since` (the moment auto-post was turned on).

## Chat: channels and messages

Design and rules: `docs/chat.md`. Everything needs sign-in; sending needs a handle. 20 messages a minute per person across all chat (429 `too_fast`), bodies 1 to 2000 characters (`bad_message`, `message_too_long`).

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/v1/channels` | - | `{ channels: [channel] }` |
| GET | `/v1/channels/:id/messages?after=&before=` | - | `{ channel, messages: [message], before, latest, moderator }` |
| POST | `/v1/channels/:id/messages` | `{ body }` | `201 { message }`; slow mode is 429 `slow_mode` |
| DELETE | `/v1/channels/:id/messages/:mid` | - | `{ ok: true }` own message, or any if you moderate the channel |
| POST | `/v1/channels/:id/read` | - | `{ ok: true }` |
| GET | `/v1/dms?box=inbox\|requests` | - | `{ threads: [thread] }` newest first, 50 max |
| GET | `/v1/dms/unread` | - | `{ inbox, requests }` threads with unread messages; muted threads don't count |
| GET | `/v1/dms/with/:handle` | - | `{ user, thread \| null, canMessage, reason \| null }` |
| POST | `/v1/dms` | `{ handle, body?, postId? }` | `201 { thread, message }` opens or reuses the one thread between two people |
| GET | `/v1/dms/:id/messages?after=&before=` | - | `{ thread, messages, before, latest }` |
| POST | `/v1/dms/:id/messages` | `{ body?, postId? }` | `201 { message }` |
| DELETE | `/v1/dms/:id/messages/:mid` | - | `{ ok: true }` own messages only |
| POST | `/v1/dms/:id/read` | - | `{ ok: true }` |
| POST | `/v1/dms/:id/accept` | - | `{ thread }` moves a request to the inbox |
| POST | `/v1/dms/:id/mute` | `{ muted: boolean }` | `{ thread }` |
| DELETE | `/v1/dms/:id` | - | `{ ok: true }` hides it for you; they keep their copy |
| GET | `/v1/chat/settings` | - | `{ settings: { dmFrom, channelsHidden } }` |
| PUT | `/v1/chat/settings` | any of `{ dmFrom: "everyone"\|"following"\|"nobody", channelsHidden }` | `{ settings }` |
| POST | `/v1/chat/flags` | `{ kind: "channel"\|"dm", messageId, reason, note? }` | `201 { ok, duplicate: false }` |
| POST | `/v1/chat/live` | `{ kind: "channel"\|"dm"\|"me", id? }` | `{ path, room }` a WebSocket path with a 60 s ticket |
| GET (WebSocket) | `/v1/chat/live?ticket=` | - | `101`; then `{ t: "new"\|"deleted", room }` per change, `pong` for `ping` |

`message` = `{ id, user: { id, handle, displayName, avatarUrl }, body, createdAt, mine, deleted, postId, post: post \| null }`. A message must have words, a `postId`, or both; a post that no longer exists is 404 `not_found` on send and `post: null` later.

`thread` = `{ id, with, accepted, theyAccepted, muted, lastAt, last: { body, mine, deleted } \| null, unread }`. A message from someone the recipient doesn't follow is a request (`accepted: false` for them); the sender can send 3 until it's accepted (403 `request_pending`). `dmFrom` decides who can start a request: `following` lets only people you follow in, `nobody` stops every new conversation (403 `cant_message` with the reason). Existing accepted conversations keep working. Blocks hide the thread both ways and the error never says who blocked whom.

Paging: `latest` is the cursor for `?after=` (new messages, oldest first); `before` is for older history (50 per page). The live socket never carries message text, only that something changed; the app then calls `?after=latest`. `kind: "me"` is your own room: it pings whenever someone messages you, for the unread badge.
