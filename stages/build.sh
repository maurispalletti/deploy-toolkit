#!/usr/bin/env bash
# build.sh — runs the build command from deploy-app.config.json (skip if none),
# then installs Cloud Functions deps if a functions/ subdir is present.
set -euo pipefail

APP_DIR="$1"
CONFIG="$APP_DIR/deploy-app.config.json"

BUILD_CMD=$(node -p "require('$CONFIG').build.command || ''")

cd "$APP_DIR"

if [ -z "$BUILD_CMD" ]; then
  echo "▸ No build command configured (static app); skipping root build"
else
  if [ ! -d node_modules ]; then
    echo "▸ Installing dependencies (npm install)"
    npm install
  fi

  # Patch package.json to remove any embedded `firebase deploy` from the
  # build script. Older scaffolds baked `next build && firebase deploy ...`
  # into it; the deploy toolkit always runs deploy.sh separately, so keeping
  # it there causes "No active project" errors and double-deploys.
  node -e '
const fs = require("fs");
try {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const s = pkg.scripts && pkg.scripts.build;
  if (s && /firebase\s+deploy/.test(s)) {
    pkg.scripts.build = s.replace(/\s*&&\s*firebase\s+deploy\b[^|&]*/g, "").trim();
    fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
    console.log("▸ Removed embedded firebase deploy from package.json build script");
  }
} catch {}
' 2>/dev/null || true

  # Also strip from BUILD_CMD itself in case it directly embeds firebase deploy.
  CLEAN_CMD=$(node -e "process.stdout.write(process.argv[1].replace(/\s*&&\s*firebase\s+deploy\b[^|&]*/g,'').trim())" "$BUILD_CMD")
  echo "▸ Building: $CLEAN_CMD"
  eval "$CLEAN_CMD"
fi

# Shape C: pre-install Cloud Functions deps so `firebase deploy --only
# functions` doesn't fail. We do this whenever the user shipped a
# functions/ subdirectory with its own package.json — not just when the
# planner picked Shape C — so the script stays correct if the config and
# the disk layout drift. Skip if functions/node_modules already exists.
if [ -f functions/package.json ]; then
  if [ ! -d functions/node_modules ]; then
    echo "▸ Installing functions dependencies (npm install --prefix functions)"
    npm install --prefix functions
  else
    echo "▸ functions/node_modules already present; skipping install"
  fi
fi

echo "✓ Build done"
