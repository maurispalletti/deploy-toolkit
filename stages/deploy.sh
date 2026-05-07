#!/usr/bin/env bash
# deploy.sh — runs firebase deploy for the configured services.
set -euo pipefail

APP_DIR="$1"
CONFIG="$APP_DIR/deploy-app.config.json"

cd "$APP_DIR"

NEEDS_DB=$(node -p "require('./deploy-app.config.json').firestore !== null")
NEEDS_FN=$(node -p "require('./deploy-app.config.json').functions !== null")

TARGETS="hosting"
[ "$NEEDS_DB" = "true" ] && TARGETS="$TARGETS,firestore"
[ "$NEEDS_FN" = "true" ] && TARGETS="$TARGETS,functions"

echo "▸ Deploying targets: $TARGETS"
firebase deploy --only "$TARGETS"
echo "✓ Deploy done"
