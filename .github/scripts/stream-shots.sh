#!/bin/bash
dir=$1; platform=$2; seen=" "; i=0
api="https://api.github.com/repos/$GITHUB_REPOSITORY/contents/runs/$GITHUB_RUN_ID/$platform"
push() {
  for try in 1 2 3; do
    code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" "$api/$1" --data @"$RUNNER_TEMP/shot.json")
    [ "$code" = 201 ] && { echo "streamed $1"; return; }
    sleep 2
  done
  echo "stream failed $1 ($code)"
}
while :; do
  for f in $(find "$dir" -path '*takeScreenshot*' -name '*.png' 2>/dev/null | sort); do
    n=$(basename "$f"); case "$seen" in *" $n "*) continue;; esac
    sleep 1; i=$((i+1)); out="$RUNNER_TEMP/small.png"
    if command -v sips >/dev/null; then sips -Z 900 "$f" --out "$out" >/dev/null; else cp "$f" "$out"; fi
    printf '{"message":"ci shot %s","branch":"ci-shots","content":"%s"}' "$n" "$(base64 < "$out" | tr -d '\n')" > "$RUNNER_TEMP/shot.json"
    push "$(printf %02d $i)-$n"; seen="$seen$n "
  done
  [ -f "$dir/.done" ] && exit 0
  sleep 3
done
