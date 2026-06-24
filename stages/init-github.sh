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
printf "DEPLOY_TOOLKIT_FIREBASE_DONE:%s\n" "$APP_DIR"
