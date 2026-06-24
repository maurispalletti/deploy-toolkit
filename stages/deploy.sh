#!/usr/bin/env bash
# deploy.sh — runs firebase deploy for the configured services.
#
# When the rules-deploy fails because Firestore hasn't been initialized
# on a brand-new project (REVISIT B6), translate the cryptic
# `firebaserules ... HTTP Error: 403` into a friendly message with the
# right console link and the exact recovery step. The user can finish
# creating the database and re-run; idempotency takes over.

set -euo pipefail

APP_DIR="$1"
CONFIG="$APP_DIR/deploy-app.config.json"

cd "$APP_DIR"

# .firebaserc → folder name (same resolution as provision/restore-env).
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
NEEDS_DB=$(node -p "require('./deploy-app.config.json').firestore !== null")
NEEDS_FN=$(node -p "require('./deploy-app.config.json').functions !== null")

TARGETS="hosting"
[ "$NEEDS_DB" = "true" ] && TARGETS="$TARGETS,firestore"
[ "$NEEDS_FN" = "true" ] && TARGETS="$TARGETS,functions"

echo "▸ Deploying targets: $TARGETS"

set +e
DEPLOY_OUTPUT=$(firebase deploy --only "$TARGETS" --project "$PROJECT_ID" 2>&1)
DEPLOY_EXIT=$?
set -e

# Always print the raw output so the user can see what happened.
echo "$DEPLOY_OUTPUT"

if [ $DEPLOY_EXIT -ne 0 ]; then
  # Translate the most common first-time error into something actionable.
  # The firebaserules:test 403 happens when the Firestore database doesn't
  # exist yet on a brand-new project (the API is enabled but no actual
  # database has been created with a region + mode).
  if echo "$DEPLOY_OUTPUT" | grep -q "firebaserules.googleapis.com.*HTTP Error: 403"; then
    cat <<EOF

──────────────────────────────────────────────────────────────────────
✗ Your Firestore database isn't ready yet on this project.

Brand-new Firebase projects have the Firestore API enabled but the
database itself still needs to be created once. We can't pick a region
or security mode for you — that's a choice you have to make.

Fix it in ~30 seconds:

  1. Open: https://console.firebase.google.com/project/$PROJECT_ID/firestore
  2. Click "Create database"
  3. Pick any region (eur3 or us-central1 are common)
  4. Start in "Production mode" — we already wrote secure rules
  5. Wait ~30s for the database to spin up

Then run './deploy-app' again — we remember your choices and will
pick up from this stage automatically.

(We pre-opened this page earlier during 'Setting up your Firebase
project'; check your open tabs.)
──────────────────────────────────────────────────────────────────────
EOF
    echo "DEPLOY_TOOLKIT_SENTINEL:NEEDS_FIRESTORE_INIT"
    exit $DEPLOY_EXIT
  fi

  # Some other failure — leave the raw output above as the message.
  exit $DEPLOY_EXIT
fi

echo "✓ Deploy done"
