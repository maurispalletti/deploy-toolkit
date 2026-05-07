#!/usr/bin/env bash
# build.sh — runs the build command from deploy-app.config.json (skip if none).
set -euo pipefail

APP_DIR="$1"
CONFIG="$APP_DIR/deploy-app.config.json"

BUILD_CMD=$(node -p "require('$CONFIG').build.command || ''")

if [ -z "$BUILD_CMD" ]; then
  echo "▸ No build command configured (static app); skipping"
  exit 0
fi

cd "$APP_DIR"

if [ ! -d node_modules ]; then
  echo "▸ Installing dependencies (npm install)"
  npm install
fi

echo "▸ Building: $BUILD_CMD"
eval "$BUILD_CMD"
echo "✓ Build done"
