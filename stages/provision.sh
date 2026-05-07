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

# Create the Firebase project (idempotent: skip if exists)
if ! firebase projects:list 2>/dev/null | grep -q " $PROJECT_ID "; then
  echo "▸ Creating Firebase project: $PROJECT_ID"
  firebase projects:create "$PROJECT_ID" --display-name "$PROJECT_ID"
else
  echo "▸ Project $PROJECT_ID already exists; reusing"
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
