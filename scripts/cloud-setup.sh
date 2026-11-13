#!/bin/bash
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
for d in apps/api apps/mobile apps/site tools/atlas; do
  [ -f "$CLAUDE_PROJECT_DIR/$d/package-lock.json" ] || continue
  (cd "$CLAUDE_PROJECT_DIR/$d" && npm ci --no-audit --no-fund) || exit 2
done
