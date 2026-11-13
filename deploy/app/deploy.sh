#!/bin/zsh
set -e
ENV=${1:-staging}
API=$([ "$ENV" = production ] && echo https://api.emera.social || echo https://emera-api-staging.techguyver1337.workers.dev)
HERE=${0:A:h}
ROOT=${HERE:h:h}
SRC=$(mktemp -d)
git -C "$ROOT" archive HEAD apps/mobile packages | tar -x -C "$SRC"
cp -Rc "$ROOT/apps/mobile/node_modules" "$SRC/apps/mobile/node_modules"
(cd "$SRC/apps/mobile" && EXPO_PUBLIC_API_URL=$API npx expo export --platform web --output-dir "$HERE/dist.new")
mv "$HERE/dist" "$HERE/dist.old.$$" 2>/dev/null || true
mv "$HERE/dist.new" "$HERE/dist"
cd "$HERE"
if [ "$ENV" = production ]; then npx wrangler@4 deploy --env production; else npx wrangler@4 deploy; fi
