#!/usr/bin/env bash
# provision.sh — given a deploy-app.config.json, creates the Firebase project
# and writes firebase.json / .firebaserc / firestore.rules into the app dir.
set -euo pipefail

APP_DIR="$1"
CONFIG="$APP_DIR/deploy-app.config.json"
TOOLKIT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

[ -f "$CONFIG" ] || { echo "✗ Missing $CONFIG"; exit 1; }

PROJECT_ID=$(node -p "require('$CONFIG').firebase.projectId")
SHAPE=$(node -p "require('$CONFIG').shape")
PUBLIC_DIR=$(node -p "require('$CONFIG').hosting.publicDir")
NEEDS_DB=$(node -p "require('$CONFIG').firestore !== null")
NEEDS_FN=$(node -p "require('$CONFIG').functions !== null")

cd "$APP_DIR"

# Create the Firebase project (idempotent: skip if exists).
# Capture output first to avoid `set -o pipefail` flagging SIGPIPE when grep -q
# closes stdin early. Use --json for stable parsing across CLI versions.
PROJECT_LIST_JSON=$(firebase projects:list --json 2>/dev/null || true)
PROJECT_EXISTS=$(node -e '
const data = JSON.parse(process.argv[1] || "{}");
const ids = (data.result || []).map(p => p.projectId);
process.stdout.write(ids.includes(process.argv[2]) ? "yes" : "no");
' "$PROJECT_LIST_JSON" "$PROJECT_ID")

if [ "$PROJECT_EXISTS" = "yes" ]; then
  echo "▸ Project $PROJECT_ID already exists; reusing"
else
  echo "▸ Creating Firebase project: $PROJECT_ID"
  set +e
  CREATE_OUTPUT=$(firebase projects:create "$PROJECT_ID" --display-name "$PROJECT_ID" 2>&1)
  CREATE_EXIT=$?
  set -e
  echo "$CREATE_OUTPUT"
  if [ $CREATE_EXIT -ne 0 ]; then
    if echo "$CREATE_OUTPUT" | grep -q "PERMISSION_DENIED\|caller does not have permission"; then
      echo "DEPLOY_TOOLKIT_SENTINEL:NEEDS_BOOTSTRAP"
    fi
    exit $CREATE_EXIT
  fi
fi

# Set as the active project
echo "{\"projects\":{\"default\":\"$PROJECT_ID\"}}" > .firebaserc

# Generate firebase.json based on shape
node -e "
const cfg = require('$CONFIG');
const fs = require('fs');
const obj = { hosting: { public: cfg.hosting.publicDir, ignore: ['firebase.json','**/.*','**/node_modules/**'], rewrites: cfg.hosting.rewrites } };
if (cfg.firestore) obj.firestore = { rules: 'firestore.rules' };
if (cfg.functions) obj.functions = [{ source: cfg.functions.dir, codebase: 'default' }];
fs.writeFileSync('firebase.json', JSON.stringify(obj, null, 2));
"

# Copy default firestore rules if needed and not present
if [ "$NEEDS_DB" = "true" ] && [ ! -f firestore.rules ]; then
  cp "$TOOLKIT_DIR/templates/firestore.rules" firestore.rules
  echo "▸ Wrote default firestore.rules"
fi

echo "✓ Provisioning done"
