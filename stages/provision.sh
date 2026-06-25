#!/usr/bin/env bash
# provision.sh — given a deploy-app.config.json, creates the Firebase project
# and writes firebase.json / .firebaserc / firestore.rules into the app dir.
set -euo pipefail

APP_DIR="$1"
CONFIG="$APP_DIR/deploy-app.config.json"
TOOLKIT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

[ -f "$CONFIG" ] || { echo "✗ Missing $CONFIG"; exit 1; }

cd "$APP_DIR"

# Resolve project ID: .firebaserc (most authoritative) → folder name.
# deploy-app.config.json is intentionally skipped — the planner appends a
# random suffix that doesn't match the actual Firebase project name.
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

echo "▸ Using Firebase project: $PROJECT_ID"

# If .firebaserc already points at this project the project exists — skip creation.
FIREBASERC_PROJECT=$(node -e '
try {
  const rc = JSON.parse(require("fs").readFileSync(".firebaserc","utf8"));
  process.stdout.write(rc.projects && rc.projects.default ? rc.projects.default : "");
} catch { process.stdout.write(""); }
')

if [ "$FIREBASERC_PROJECT" = "$PROJECT_ID" ]; then
  echo "▸ Project $PROJECT_ID already exists (.firebaserc); skipping create"
else
  # New project — create it.
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
        exit $CREATE_EXIT
      elif echo "$CREATE_OUTPUT" | grep -qi "already in use\|already exists"; then
        echo "▸ Project $PROJECT_ID already exists; continuing"
      else
        exit $CREATE_EXIT
      fi
    fi
  fi
fi

# Set as the active project
echo "{\"projects\":{\"default\":\"$PROJECT_ID\"}}" > .firebaserc

# Generate firebase.json — Firestore and Hosting always included.
node -e "
const cfg = require('$CONFIG');
const fs = require('fs');
const obj = { hosting: { public: cfg.hosting.publicDir, ignore: ['firebase.json','**/.*','**/node_modules/**'], rewrites: cfg.hosting.rewrites } };
obj.firestore = { rules: 'firestore.rules' };
if (cfg.functions) obj.functions = [{ source: cfg.functions.dir, codebase: 'default' }];
fs.writeFileSync('firebase.json', JSON.stringify(obj, null, 2));
"

# Always ensure firestore.rules exists.
if [ ! -f firestore.rules ]; then
  cp "$TOOLKIT_DIR/templates/firestore.rules" firestore.rules
  echo "▸ Wrote default firestore.rules"
fi

# Check if Firestore database exists; create it if not.
echo "▸ Checking Firestore database…"
set +e
DB_LIST=$(firebase firestore:databases:list --project "$PROJECT_ID" 2>&1)
set -e
if echo "$DB_LIST" | grep -q "No databases found"; then
  echo "▸ Firestore not enabled — creating database…"
  set +e
  firebase firestore:databases:create \
    --project "$PROJECT_ID" \
    --location "us-central1" 2>&1
  set -e
else
  echo "▸ Firestore database already exists"
fi

# Explicitly create the default Firebase Hosting site (idempotent).
# `firebase deploy --only hosting` also enables Hosting on first run, but
# doing it here means the site is ready before the build even starts.
echo "▸ Ensuring Firebase Hosting site exists…"
set +e
firebase hosting:sites:create "$PROJECT_ID" \
  --project "$PROJECT_ID" 2>&1 | grep -v "already exists" || true
set -e

echo "✓ Provisioning done"
