#!/usr/bin/env bash
# init-firebase.sh — create a Firebase project for an already-initialized project.
# Called by the wizard's "Firebase" step, after git + GitHub are set up.
# Usage: init-firebase.sh APP_DIR PROJECT_NAME
set -euo pipefail

APP_DIR="$1"
PROJECT_NAME="$2"

step() { printf "▸ %s\n" "$1"; }
info() { printf "  %s\n" "$1"; }
toolkit_error() { printf "DEPLOY_TOOLKIT_ERROR:%s:%s\n" "$1" "$2"; }

cd "$APP_DIR"

step "Creating Firebase project"
PROJECT_LIST_JSON=$(firebase projects:list --json 2>/dev/null || true)
PROJECT_EXISTS=$(node -e '
const data = JSON.parse(process.argv[1] || "{}");
const ids = (data.result || []).map(p => p.projectId);
process.stdout.write(ids.includes(process.argv[2]) ? "yes" : "no");
' "$PROJECT_LIST_JSON" "$PROJECT_NAME")

if [ "$PROJECT_EXISTS" = "yes" ]; then
  info "Firebase project '$PROJECT_NAME' already exists — reusing"
else
  set +e
  CREATE_OUTPUT=$(firebase projects:create "$PROJECT_NAME" --display-name "$PROJECT_NAME" 2>&1)
  CREATE_EXIT=$?
  set -e
  printf "%s\n" "$CREATE_OUTPUT"

  if [ $CREATE_EXIT -ne 0 ]; then
    DEBUG_LOG=""
    if [ -f "firebase-debug.log" ]; then
      DEBUG_LOG=$(cat "firebase-debug.log")
    fi

    if echo "$CREATE_OUTPUT" | grep -q "PERMISSION_DENIED\|caller does not have permission"; then
      echo "DEPLOY_TOOLKIT_SENTINEL:NEEDS_BOOTSTRAP"
    elif echo "$DEBUG_LOG" | grep -q "PERMISSION_DENIED\|caller does not have permission"; then
      echo "DEPLOY_TOOLKIT_SENTINEL:NEEDS_BOOTSTRAP"
    elif echo "$DEBUG_LOG" | grep -qi "project quota\|exceeded.*quota\|RESOURCE_EXHAUSTED"; then
      toolkit_error "PROJECT_QUOTA_EXCEEDED" "You've hit your Google Cloud project limit. Delete unused projects at console.cloud.google.com/iam-admin/projects, then try again."
    elif echo "$CREATE_OUTPUT" | grep -qi "already in use\|already exists"; then
      toolkit_error "PROJECT_ID_TAKEN" "The project ID '$PROJECT_NAME' is already taken globally. Try a different name."
    elif echo "$DEBUG_LOG" | grep -qi "already in use\|already exists"; then
      toolkit_error "PROJECT_ID_TAKEN" "The project ID '$PROJECT_NAME' is already taken globally. Try a different name."
    else
      toolkit_error "FIREBASE_CREATE_FAILED" "Firebase project creation failed. Check the output above for details."
    fi
    exit $CREATE_EXIT
  fi
fi

echo "✓ Firebase project ready"

# ── Create Firebase web app + write .env.local ─────────────────────────────
step "Creating Firebase web app"
firebase apps:create web "$PROJECT_NAME" \
  --project "$PROJECT_NAME" --json >/tmp/dt_create_app.json 2>/dev/null || true

APP_ID=$(node -e "
let d=''; process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try { process.stdout.write(JSON.parse(d).result?.appId||''); }
  catch { process.stdout.write(''); }
});
" </tmp/dt_create_app.json 2>/dev/null || true)

if [ -z "$APP_ID" ]; then
  info "Checking for existing web app…"
  firebase apps:list WEB --project "$PROJECT_NAME" --json \
    >/tmp/dt_apps_list.json 2>/dev/null || echo '{}' >/tmp/dt_apps_list.json
  APP_ID=$(node -e "
let d=''; process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try { process.stdout.write((JSON.parse(d).result||[])[0]?.appId||''); }
  catch { process.stdout.write(''); }
});
" </tmp/dt_apps_list.json 2>/dev/null || true)
fi

if [ -n "$APP_ID" ]; then
  info "Web app ID: $APP_ID"
  step "Writing .env.local"
  # Capture both forms: --json and plain JS snippet (fallback)
  # Redirect stderr to stdout so we see everything in the log
  firebase apps:sdkconfig "$APP_ID" \
    --project "$PROJECT_NAME" --json >/tmp/dt_sdk.json 2>&1 || true
  firebase apps:sdkconfig "$APP_ID" \
    --project "$PROJECT_NAME"        >/tmp/dt_sdk.txt  2>&1 || true

  info "--- sdkconfig JSON output ---"
  cat /tmp/dt_sdk.json
  info "--- sdkconfig plain output ---"
  cat /tmp/dt_sdk.txt

  cat > /tmp/dt_write_env.js << 'JSEOF'
const fs = require('fs');
const appDir = process.argv[2];

function extract(txt, key) {
  const m = txt.match(new RegExp(key + '[^"]*"([^"]+)"'));
  return m ? m[1] : '';
}

let c = {};
let source = 'none';

try {
  const raw = fs.readFileSync('/tmp/dt_sdk.json', 'utf8');
  const parsed = JSON.parse(raw);
  const r = parsed.result || {};
  const candidate = (r.sdkConfig && r.sdkConfig.apiKey) ? r.sdkConfig : r;
  if (candidate.apiKey) { c = candidate; source = 'json'; }
} catch {}

if (!c.apiKey) {
  try {
    const txt = fs.readFileSync('/tmp/dt_sdk.txt', 'utf8');
    const candidate = {
      apiKey:            extract(txt, 'apiKey'),
      authDomain:        extract(txt, 'authDomain'),
      projectId:         extract(txt, 'projectId'),
      storageBucket:     extract(txt, 'storageBucket'),
      messagingSenderId: extract(txt, 'messagingSenderId'),
      appId:             extract(txt, 'appId'),
    };
    if (candidate.apiKey) { c = candidate; source = 'plain'; }
  } catch {}
}

console.log('  SDK config source:', source);
console.log('  apiKey found:', !!c.apiKey);

fs.writeFileSync(appDir + '/.env.local', [
  'NEXT_PUBLIC_FIREBASE_API_KEY='              + (c.apiKey             || ''),
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN='         + (c.authDomain         || ''),
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID='          + (c.projectId          || ''),
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET='      + (c.storageBucket      || ''),
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=' + (c.messagingSenderId  || ''),
  'NEXT_PUBLIC_FIREBASE_APP_ID='              + (c.appId              || ''),
].join('\n') + '\n');
console.log('  Wrote .env.local');
JSEOF

  node /tmp/dt_write_env.js "$APP_DIR"
else
  info "Warning: could not create Firebase web app — .env.local will be written during scaffold"
fi

printf "DEPLOY_TOOLKIT_FIREBASE_DONE:%s\n" "$APP_DIR"
