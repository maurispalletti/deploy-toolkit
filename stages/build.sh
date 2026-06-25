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

  # For Next.js projects targeting static export (publicDir = "out"), ensure
  # next.config.mjs has output: "export". Without it the build writes to
  # .next/ and firebase deploy fails with "Directory 'out' does not exist".
  node -e '
const fs = require("fs"), path = require("path");
try {
  const cfg = JSON.parse(fs.readFileSync("'"$CONFIG"'", "utf8"));
  if (cfg.hosting?.publicDir !== "out") process.exit(0);
  const candidates = ["next.config.mjs", "next.config.js"];
  let file = candidates.find(f => fs.existsSync(f));
  if (!file) {
    // No config at all — create a minimal one
    fs.writeFileSync("next.config.mjs",
      "/** @type {import(\"next\").NextConfig} */\nconst nextConfig = {\n  output: \"export\",\n  images: { unoptimized: true },\n};\nexport default nextConfig;\n");
    console.log("▸ Created next.config.mjs with output: \"export\" for static hosting");
    process.exit(0);
  }
  const src = fs.readFileSync(file, "utf8");
  if (/output\s*:/.test(src)) process.exit(0); // already set
  // Inject after the opening brace of the config object
  const patched = src.replace(
    /(const\s+nextConfig\s*=\s*\{)/,
    "$1\n  output: \"export\",\n  images: { unoptimized: true },"
  );
  if (patched === src) {
    console.log("▸ Warning: could not auto-patch " + file + " — add output: \"export\" manually if deploy fails");
  } else {
    fs.writeFileSync(file, patched);
    console.log("▸ Patched " + file + " to add output: \"export\" for static hosting");
  }
} catch {}
' 2>/dev/null || true

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
