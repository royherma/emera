#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${SMOKE_PORT:-5039}"
BASE="http://127.0.0.1:$PORT"
WORK="$(mktemp -d)"
LOG="$WORK/wrangler.log"
PID=""
trap '[ -n "$PID" ] && kill "$PID" 2>/dev/null || true; wait 2>/dev/null || true; rm -rf "$WORK"' EXIT

step() { printf '\n== %s\n' "$1"; }
fail() { printf 'SMOKE FAILED: %s\n' "$1"; echo '--- wrangler log tail ---'; tail -30 "$LOG" 2>/dev/null || true; exit 1; }
field() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v=JSON.parse(s);for(const k of process.argv[1].split("."))v=v?.[k];process.stdout.write(String(v??""))})' "$1"; }
expect() { [ "$2" = "$3" ] || fail "$1: expected '$3', got '$2'"; echo "ok  $1 = $2"; }
req() { curl -sS -H 'X-TG-Tester: 1' "$@"; }

if curl -s -o /dev/null "$BASE/health"; then fail "port $PORT already in use (set SMOKE_PORT)"; fi

step "fresh local database + real PNG"
node scripts/make-png.mjs "$WORK/pic.png" 64 48
ls -l "$WORK/pic.png" | awk '{print "png bytes:", $5}'
npx wrangler d1 migrations apply DB --local --persist-to "$WORK/state" >"$WORK/migrate.log" 2>&1 || { cat "$WORK/migrate.log"; fail "migrations"; }
echo "migrations applied"

step "boot wrangler dev on :$PORT (invites required)"
npx wrangler dev --port "$PORT" --ip 127.0.0.1 --persist-to "$WORK/state" --var INVITES_REQUIRED:true >"$LOG" 2>&1 &
PID=$!
for _ in $(seq 1 60); do curl -s -o /dev/null "$BASE/health" && break; sleep 1; done
curl -s "$BASE/health" | grep -q '"ok":true' || fail "server did not start"
echo "up: $(req "$BASE/health")"

signin() {
  local email="$1" invite="${2:-}"
  local body="{\"email\":\"$email\""
  [ -n "$invite" ] && body="$body,\"invite\":\"$invite\""
  body="$body}"
  local res; res="$(req -X POST "$BASE/v1/auth/start" -H 'Content-Type: application/json' -d "$body")"
  [ "$(echo "$res" | field ok)" = "true" ] || { echo "$res"; return 1; }
  sleep 0.5
  local code; code="$(grep -o "sign-in code for $email: [0-9]*" "$LOG" | tail -1 | grep -o '[0-9]*$')"
  [ -n "$code" ] || fail "no code in log for $email"
  echo "code from API log: $code" >&2
  req -X POST "$BASE/v1/auth/verify" -H 'Content-Type: application/json' -d "{\"email\":\"$email\",\"code\":\"$code\"}"
}

step "invite gate: new email without invite is refused"
res="$(req -X POST "$BASE/v1/auth/start" -H 'Content-Type: application/json' -d '{"email":"maya@example.test"}')"
expect "error code" "$(echo "$res" | field error.code)" "invite_required"

step "sign up with the seed invite"
res="$(signin maya@example.test welcome-dev)"
TOKEN="$(echo "$res" | field token)"
expect "isNew" "$(echo "$res" | field isNew)" "true"
[ ${#TOKEN} -eq 64 ] || fail "token length"
AUTH="Authorization: Bearer $TOKEN"

step "pick a handle"
res="$(req -X POST "$BASE/v1/auth/handle" -H "$AUTH" -H 'Content-Type: application/json' -d '{"handle":"maya","displayName":"Maya Makes"}')"
expect "handle" "$(echo "$res" | field user.handle)" "maya"
expect "GET /v1/me" "$(req "$BASE/v1/me" -H "$AUTH" | field user.displayName)" "Maya Makes"

step "make an invite, a friend joins with it"
inv="$(req -X POST "$BASE/v1/invites" -H "$AUTH")"
CODE="$(echo "$inv" | field code)"
echo "invite url: $(echo "$inv" | field url)"
expect "invite valid" "$(req "$BASE/v1/invites/$CODE" | field valid)" "true"
res="$(signin theo@example.test "$CODE")"
expect "friend isNew" "$(echo "$res" | field isNew)" "true"
AUTH2="Authorization: Bearer $(echo "$res" | field token)"
req -X POST "$BASE/v1/auth/handle" -H "$AUTH2" -H 'Content-Type: application/json' -d '{"handle":"theo","displayName":"Theo"}' >/dev/null
expect "invite used up" "$(req "$BASE/v1/invites/$CODE" | field valid)" "false"

step "upload the PNG (ask for a slot, then PUT the bytes)"
BYTES="$(wc -c < "$WORK/pic.png" | tr -d ' ')"
slot="$(req -X POST "$BASE/v1/uploads" -H "$AUTH" -H 'Content-Type: application/json' -d "{\"contentType\":\"image/png\",\"bytes\":$BYTES}")"
UPLOAD_URL="$(echo "$slot" | field uploadUrl)"
echo "upload url: $UPLOAD_URL"
up="$(req -X PUT "$UPLOAD_URL" -H "$AUTH" -H 'Content-Type: image/png' --data-binary "@$WORK/pic.png")"
MEDIA_ID="$(echo "$up" | field media.id)"
MEDIA_URL="$(echo "$up" | field media.url)"
expect "width x height" "$(echo "$up" | field media.width)x$(echo "$up" | field media.height)" "64x48"
LOCAL_SHA="$(shasum -a 256 "$WORK/pic.png" | cut -d' ' -f1)"
expect "source sha256 matches local file" "$(echo "$up" | field media.proof.sourceSha256)" "$LOCAL_SHA"
echo "proof: $(echo "$up" | field media.proof.signer) at $(echo "$up" | field media.proof.signedAt) sig $(echo "$up" | field media.proof.signature | cut -c1-16)..."

step "read the media back from /media"
curl -sS -D "$WORK/h.txt" -o "$WORK/back.png" "$MEDIA_URL"
cmp "$WORK/pic.png" "$WORK/back.png" && echo "ok  bytes identical"
grep -i '^cache-control' "$WORK/h.txt"

step "create a post"
post="$(req -X POST "$BASE/v1/posts" -H "$AUTH" -H 'Content-Type: application/json' -d "{\"mediaIds\":[\"$MEDIA_ID\"],\"caption\":\"Gradient test\",\"alt\":{\"$MEDIA_ID\":\"A smooth colour gradient\"}}")"
POST_ID="$(echo "$post" | field post.id)"
echo "post url: $(echo "$post" | field post.url)"
expect "caption" "$(echo "$post" | field post.caption)" "Gradient test"
expect "alt text" "$(echo "$post" | field post.media.0.alt)" "A smooth colour gradient"

step "profile JSON and feed"
prof="$(req "$BASE/v1/users/maya")"
expect "profile posts" "$(echo "$prof" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).posts.length)))')" "1"
expect "feed first post" "$(req "$BASE/v1/feed" | field posts.0.id)" "$POST_ID"

step "edit profile, then search finds it (FTS5 on local D1)"
res="$(req -X PATCH "$BASE/v1/me" -H "$AUTH" -H 'Content-Type: application/json' -d '{"bio":"Gradient tinkerer in Lisbon","links":["https://maya.example"]}')"
expect "bio" "$(echo "$res" | field user.bio)" "Gradient tinkerer in Lisbon"
expect "people search" "$(req "$BASE/v1/search?q=lisb&type=people" | field users.0.handle)" "maya"
expect "post search by alt" "$(req "$BASE/v1/search?q=smooth&type=posts" | field posts.0.id)" "$POST_ID"

step "report the post as a different member"
THEO_TOKEN="$(signin theo@example.test | field token)"
req -X POST "$BASE/v1/auth/handle" -H "Authorization: Bearer $THEO_TOKEN" -H 'Content-Type: application/json' -d '{"handle":"theo","displayName":"Theo"}' >/dev/null
flag="$(req -X POST "$BASE/v1/flags" -H "Authorization: Bearer $THEO_TOKEN" -H 'Content-Type: application/json' -d "{\"targetType\":\"post\",\"targetId\":\"$POST_ID\",\"reason\":\"spam\"}")"
expect "flag status" "$(echo "$flag" | field flag.status)" "new"

step "public pages carry og tags"
page="$(req "$BASE/@maya")"
echo "$page" | grep -o '<meta property="og:title"[^>]*>' || fail "profile og:title"
echo "$page" | grep -o '<meta property="og:image"[^>]*>' || fail "profile og:image"
echo "$page" | grep -o '<meta name="twitter:card"[^>]*>' || fail "profile twitter:card"
ppage="$(req "$BASE/p/$POST_ID")"
echo "$ppage" | grep -o '<meta property="og:image"[^>]*>' || fail "post og:image"
echo "$ppage" | grep -q "$LOCAL_SHA" && echo "ok  post page shows the proof hash"

step "a friend likes and comments, the author is notified"
expect "like count" "$(req -X POST "$BASE/v1/posts/$POST_ID/like" -H "$AUTH2" | field likeCount)" "1"
cm="$(req -X POST "$BASE/v1/posts/$POST_ID/comments" -H "$AUTH2" -H 'Content-Type: application/json' -d '{"body":"Lovely gradient"}')"
COMMENT_ID="$(echo "$cm" | field comment.id)"
expect "reply" "$(req -X POST "$BASE/v1/posts/$POST_ID/comments" -H "$AUTH" -H 'Content-Type: application/json' -d "{\"body\":\"Thanks\",\"parentId\":\"$COMMENT_ID\"}" | field comment.parentId)" "$COMMENT_ID"
thread="$(req "$BASE/v1/posts/$POST_ID/comments")"
expect "comment total" "$(echo "$thread" | field total)" "2"
expect "reply nested" "$(echo "$thread" | field comments.0.replies.0.body)" "Thanks"
post="$(req "$BASE/v1/posts/$POST_ID" -H "$AUTH2")"
expect "viewer liked" "$(echo "$post" | field post.viewer.liked)" "true"
expect "unread for author" "$(req "$BASE/v1/notifications/unread-count" -H "$AUTH" | field unread)" "2"
expect "mark read" "$(req -X POST "$BASE/v1/notifications/read" -H "$AUTH" | field unread)" "0"
expect "unlike" "$(req -X DELETE "$BASE/v1/posts/$POST_ID/like" -H "$AUTH2" | field likeCount)" "0"
expect "delete comment" "$(req -X DELETE "$BASE/v1/comments/$COMMENT_ID" -H "$AUTH" | field ok)" "true"

step "delete the post, then it is gone"
expect "delete" "$(req -X DELETE "$BASE/v1/posts/$POST_ID" -H "$AUTH" | field ok)" "true"
expect "post after delete" "$(req -o /dev/null -w '%{http_code}' "$BASE/v1/posts/$POST_ID")" "404"

step "logout"
expect "logout" "$(req -X POST "$BASE/v1/auth/logout" -H "$AUTH" | field ok)" "true"
expect "me after logout" "$(req -o /dev/null -w '%{http_code}' "$BASE/v1/me" -H "$AUTH")" "401"

printf '\nSMOKE PASSED\n'
