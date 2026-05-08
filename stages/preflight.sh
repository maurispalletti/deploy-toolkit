#!/usr/bin/env bash
# preflight.sh — verifies required CLIs are available and authenticated.
# Exits 0 on success; prints actionable error and exits 1 on failure.
set -euo pipefail

step() { printf "▸ %s\n" "$1"; }
fail() { printf "✗ %s\n" "$1" >&2; exit 1; }

check_cmd() {
  local cmd="$1"; local install_hint="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Missing '$cmd'. Install it: $install_hint"
  fi
}

step "Checking Node.js (>= 22)"
check_cmd node "https://nodejs.org/ (or use nvm: 'nvm install 22')"
node_major=$(node -p 'process.versions.node.split(".")[0]')
if [ "$node_major" -lt 22 ]; then
  fail "Node $node_major found; need 22+. The orchestrator tries to switch via nvm automatically — install nvm or upgrade Node manually."
fi

step "Checking firebase CLI"
if ! command -v firebase >/dev/null 2>&1; then
  printf "  Firebase CLI not found. Install it now via 'npm install -g firebase-tools'? [Y/n] "
  read -r reply
  case "${reply:-Y}" in
    [Nn]*)
      fail "Firebase CLI required. Install manually: npm install -g firebase-tools"
      ;;
    *)
      npm install -g firebase-tools || fail "Install failed. Try manually: npm install -g firebase-tools"
      ;;
  esac
fi

step "Checking firebase login"
if ! firebase projects:list >/dev/null 2>&1; then
  printf "You're not logged in to Firebase. Running 'firebase login' now...\n"
  firebase login
fi

# Show which account is active so the user can catch wrong-account issues early.
ACTIVE_ACCOUNT=$(firebase login:list 2>/dev/null | awk '/User:/ {print $2; exit}')
if [ -n "$ACTIVE_ACCOUNT" ]; then
  printf "  Logged in as: %s\n" "$ACTIVE_ACCOUNT"
  printf "  If this is the wrong account, run: firebase logout && firebase login\n"
fi

step "All preflight checks passed"
