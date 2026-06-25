#!/usr/bin/env bash
# restore-env.sh — regenerate .env.local from the Firebase Web SDK config.
#
# Only acts on Next.js projects. Exits 0 silently for everything else.
# Skips if .env.local already has a non-empty NEXT_PUBLIC_FIREBASE_API_KEY.
#
# Project ID resolution order:
#   1. .firebaserc → projects.default
#   2. basename of APP_DIR (folder name)
set -euo pipefail

APP_DIR="$1"

cd "$APP_DIR"

# ── 1. Detect Next.js ────────────────────────────────────────────────────────
IS_NEXT=$(node -e '
const fs = require("fs"), path = require("path");
const dir = process.argv[1];
const hasConfig =
  fs.existsSync(path.join(dir, "next.config.js")) ||
  fs.existsSync(path.join(dir, "next.config.mjs")) ||
  fs.existsSync(path.join(dir, "next.config.ts"));
let hasDep = false;
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  hasDep = "next" in { ...(pkg.dependencies||{}), ...(pkg.devDependencies||{}) };
} catch {}
process.stdout.write((hasConfig || hasDep) ? "yes" : "no");
' "$APP_DIR")

if [ "$IS_NEXT" = "no" ]; then
  echo "▸ Not a Next.js project; skipping .env.local restore."
  echo "✓ Environment restore done"
  exit 0
fi

# ── 2. Skip if .env.local already has the key ───────────────────────────────
HAS_KEY=$(node -e '
const fs = require("fs"), path = require("path");
const f = path.join(process.argv[1], ".env.local");
if (!fs.existsSync(f)) { process.stdout.write("no"); process.exit(0); }
const m = fs.readFileSync(f, "utf8").match(/^NEXT_PUBLIC_FIREBASE_API_KEY=(.+)$/m);
process.stdout.write((m && m[1].trim()) ? "yes" : "no");
' "$APP_DIR")

if [ "$HAS_KEY" = "yes" ]; then
  echo "▸ .env.local already contains Firebase config; skipping."
  echo "✓ Environment restore done"
  exit 0
fi

# ── 3. Resolve Firebase project ID ──────────────────────────────────────────
# Resolution order: .firebaserc → folder name.
# deploy-app.config.json is intentionally skipped — the planner adds a random
# suffix (e.g. "my-app-a1b2") that doesn't match the actual Firebase project.
PROJECT_ID=$(node -e '
const fs = require("fs"), path = require("path");
const dir = process.argv[1];
try {
  const rc = JSON.parse(fs.readFileSync(path.join(dir, ".firebaserc"), "utf8"));
  const id = rc?.projects?.default;
  if (id) { process.stdout.write(id); process.exit(0); }
} catch {}
process.stdout.write(path.basename(dir));
' "$APP_DIR")

echo "▸ Fetching Firebase SDK config for project: $PROJECT_ID"

firebase apps:sdkconfig WEB \
  --project "$PROJECT_ID" --json >/tmp/dt_restore_env.json 2>&1 || true

node - "$APP_DIR" << 'JSEOF'
const fs = require('fs'), path = require('path');
const appDir = process.argv[1];

let c = null;
try {
  const raw = fs.readFileSync('/tmp/dt_restore_env.json', 'utf8');
  const parsed = JSON.parse(raw);
  const r = parsed.result || {};
  // CLI wraps config in result.sdkConfig on some versions
  const candidate = (r.sdkConfig && r.sdkConfig.apiKey) ? r.sdkConfig : r;
  if (candidate.apiKey) c = candidate;
} catch {}

if (!c) {
  console.log('▸ Warning: could not parse SDK config — .env.local not written.');
  console.log('  Check that `firebase login` is current and the project exists.');
  process.exit(0);
}

const lines = [
  'NEXT_PUBLIC_FIREBASE_API_KEY='              + (c.apiKey             || ''),
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN='         + (c.authDomain         || ''),
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID='          + (c.projectId          || ''),
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET='      + (c.storageBucket      || ''),
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=' + (c.messagingSenderId  || ''),
  'NEXT_PUBLIC_FIREBASE_APP_ID='              + (c.appId              || ''),
].join('\n') + '\n';

fs.writeFileSync(path.join(appDir, '.env.local'), lines);
console.log('  ✓ .env.local written with Firebase config');
JSEOF

echo "✓ Environment restore done"
