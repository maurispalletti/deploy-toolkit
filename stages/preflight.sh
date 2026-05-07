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

step "Checking Node.js (>= 20)"
check_cmd node "https://nodejs.org/"
node_major=$(node -p 'process.versions.node.split(".")[0]')
if [ "$node_major" -lt 20 ]; then
  fail "Node $node_major found; need 20+. Upgrade at https://nodejs.org/"
fi

step "Checking firebase CLI"
check_cmd firebase "npm install -g firebase-tools"

step "Checking firebase login"
if ! firebase projects:list >/dev/null 2>&1; then
  printf "You're not logged in to Firebase. Running 'firebase login' now...\n"
  firebase login
fi

step "All preflight checks passed"
