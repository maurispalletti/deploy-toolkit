#!/usr/bin/env bash
# inject-auth.sh — runs between inject-secrets.sh and build.sh.
#
# Reads <appDir>/deploy-app.config.json and acts based on plan.auth:
#
#   - plan.auth === null
#       → no-op (user said no to sign-in).
#
#   - plan.auth.scaffoldMode === "auto" (Vite-React happy path)
#       1. Fetch the Firebase Web SDK config and write firebase-config.js
#          into <appDir>/src/.
#       2. Copy templates/auth/vite-react/SignInWithGoogle.jsx into
#          <appDir>/src/ (only when missing).
#       3. Idempotently splice an import + <SignInWithGoogle /> into
#          <appDir>/src/App.jsx via lib/inject-auth/splice-vite-react.
#       4. Run `npm install firebase` if it isn't already a dep.
#
#   - plan.auth.scaffoldMode === "prompt"
#       1. Fetch and write firebase-config.js only.
#       2. Skip splice / template / install. The REFACTOR-FOR-AUTH.md
#          generated mid-wizard already told the user/AI how to wire
#          the rest up.
#
# Unsupported framework (anything other than vite-react in this pass):
#   - Try to write firebase-config.js where it makes sense (src/ or
#     app root). Print a clear "manual setup required" notice so the
#     user knows to add the sign-in component themselves. Never fail
#     the deploy here.
#
# Every step is idempotent — re-running this stage on the same app is
# safe and produces deterministic output.

set -euo pipefail

APP_DIR="$1"
CONFIG="$APP_DIR/deploy-app.config.json"
TOOLKIT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

[ -f "$CONFIG" ] || { echo "✗ Missing $CONFIG"; exit 1; }

# Bail out silently when there's no auth in the plan.
HAS_AUTH=$(node -p "require('$CONFIG').auth !== null ? 'yes' : 'no'")
if [ "$HAS_AUTH" = "no" ]; then
  echo "▸ Sign-in not requested; skipping auth wiring."
  echo "✓ Auth wiring done"
  exit 0
fi

PROJECT_ID=$(node -p "require('$CONFIG').firebase.projectId")
SCAFFOLD_MODE=$(node -p "(require('$CONFIG').auth && require('$CONFIG').auth.scaffoldMode) || 'auto'")

# Re-derive the framework from the user's package.json (the saved plan
# doesn't currently carry the inspection result).
FRAMEWORK=$(node -e '
const fs = require("fs");
const path = require("path");
function pick() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.argv[1], "package.json"), "utf8"));
    const deps = { ...(pkg.dependencies||{}), ...(pkg.devDependencies||{}) };
    if (deps["vite"] && (deps["react"] || deps["react-dom"])) return "vite-react";
    if (deps["next"]) return "nextjs";
    if (deps["react-scripts"]) return "cra";
    if (deps["express"]) return "express";
    return "unknown";
  } catch { return "none"; }
}
process.stdout.write(pick());
' "$APP_DIR")

echo "▸ Wiring sign-in (framework=$FRAMEWORK, mode=$SCAFFOLD_MODE)…"

# ── Step 1: fetch the Firebase Web SDK config ───────────────────────
# We use a tiny ESM wrapper script via `node` because lib/sdk-config.mjs
# is ESM and can't be required directly. Output is JSON on stdout:
#   { "ok": true, "config": {...}, "module": "<rendered js>" }
#   { "ok": false, "code": "...", "message": "..." }

TMP_DIR="$(mktemp -d -t inject-auth.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT
WRAPPER="$TMP_DIR/fetch-sdk.mjs"
SDK_JSON="$TMP_DIR/sdk.json"
cat > "$WRAPPER" <<'WRAPPER_EOF'
import { fetchWebSdkConfig, renderFirebaseConfigModule } from "__TOOLKIT_DIR__/lib/sdk-config.mjs";
const projectId = process.argv[2];
try {
  const config = await fetchWebSdkConfig(projectId);
  process.stdout.write(JSON.stringify({
    ok: true,
    config,
    module: renderFirebaseConfigModule(config, { projectId })
  }));
} catch (err) {
  process.stdout.write(JSON.stringify({
    ok: false,
    code: err.code || "UNKNOWN",
    message: err.message
  }));
}
WRAPPER_EOF
# Inline-substitute the toolkit path into the wrapper. We use a sentinel
# instead of $TOOLKIT_DIR directly because the wrapper is in a heredoc
# with single-quoted delimiter (no bash interpolation).
sed -i.bak "s|__TOOLKIT_DIR__|$TOOLKIT_DIR|g" "$WRAPPER" && rm -f "${WRAPPER}.bak"

set +e
node "$WRAPPER" "$PROJECT_ID" > "$SDK_JSON" 2>"$TMP_DIR/fetch.err"
FETCH_EXIT=$?
set -e

if [ $FETCH_EXIT -ne 0 ] || [ ! -s "$SDK_JSON" ]; then
  echo "▸ ⚠  Couldn't run the SDK-config helper. stderr was:"
  cat "$TMP_DIR/fetch.err"
  echo "  Skipping auth wiring this run; the deploy will still proceed."
  echo "✓ Auth wiring done (skipped — see message above)"
  exit 0
fi

SDK_OK=$(node -p "JSON.parse(require('fs').readFileSync('$SDK_JSON','utf8')).ok")
if [ "$SDK_OK" != "true" ]; then
  ERR_MSG=$(node -p "JSON.parse(require('fs').readFileSync('$SDK_JSON','utf8')).message")
  ERR_CODE=$(node -p "JSON.parse(require('fs').readFileSync('$SDK_JSON','utf8')).code")
  echo "▸ ⚠  Couldn't fetch Firebase Web SDK config ($ERR_CODE): $ERR_MSG"
  echo "  You can add a Web App in the Firebase Console and copy the"
  echo "  config into $APP_DIR/src/firebase-config.js manually."
  echo "  See https://console.firebase.google.com/project/$PROJECT_ID/settings/general"
  echo "✓ Auth wiring done (partial — manual setup required)"
  exit 0
fi

# ── Step 2: pick where firebase-config.js goes ──────────────────────
case "$FRAMEWORK" in
  vite-react|cra)
    CONFIG_TARGET="$APP_DIR/src/firebase-config.js" ;;
  nextjs)
    CONFIG_TARGET="$APP_DIR/lib/firebase-config.js" ;;
  *)
    if [ -d "$APP_DIR/src" ]; then
      CONFIG_TARGET="$APP_DIR/src/firebase-config.js"
    else
      CONFIG_TARGET="$APP_DIR/firebase-config.js"
    fi
    ;;
esac

mkdir -p "$(dirname "$CONFIG_TARGET")"
node -p "JSON.parse(require('fs').readFileSync('$SDK_JSON','utf8')).module" > "$CONFIG_TARGET"
echo "▸ Wrote $(echo "$CONFIG_TARGET" | sed "s|^$APP_DIR/||")"

# ── Step 3: prompt mode — done ──────────────────────────────────────
if [ "$SCAFFOLD_MODE" = "prompt" ]; then
  echo "▸ Auto-inject skipped: you chose the 'prompt' path. Apply the"
  echo "  changes from REFACTOR-FOR-AUTH.md before re-running."
  echo "✓ Auth wiring done"
  exit 0
fi

# ── Step 4: auto mode — vite-react only in this pass ────────────────
if [ "$FRAMEWORK" != "vite-react" ]; then
  echo "▸ Auto-inject for framework '$FRAMEWORK' is not implemented yet."
  echo "  $(basename "$CONFIG_TARGET") was written; add a sign-in"
  echo "  component manually. Vite-React auto-inject is supported today;"
  echo "  Next.js + plain HTML are tracked as REVISIT follow-ups."
  echo "✓ Auth wiring done (config written; manual component step required)"
  exit 0
fi

# Copy SignInWithGoogle.jsx (only when missing — never overwrite the
# user's edits to the component).
COMPONENT_TARGET="$APP_DIR/src/SignInWithGoogle.jsx"
if [ -f "$COMPONENT_TARGET" ]; then
  echo "▸ src/SignInWithGoogle.jsx already exists; not overwriting."
else
  cp "$TOOLKIT_DIR/templates/auth/vite-react/SignInWithGoogle.jsx" "$COMPONENT_TARGET"
  echo "▸ Wrote src/SignInWithGoogle.jsx"
fi

# Splice into App.jsx via the regex helper. If the helper bails, leave
# App.jsx untouched and print a clear notice — the firebase-config.js +
# SignInWithGoogle.jsx are still usable; the user can import + render
# manually or fall back to the prompt path.
APP_JSX="$APP_DIR/src/App.jsx"
if [ ! -f "$APP_JSX" ]; then
  echo "▸ ⚠  $APP_DIR/src/App.jsx not found. Add <SignInWithGoogle />"
  echo "  to your entry component manually."
else
  SPLICE_WRAPPER="$TMP_DIR/splice.mjs"
  cat > "$SPLICE_WRAPPER" <<'SPLICE_EOF'
import { readFile, writeFile } from "node:fs/promises";
import { spliceViteReactAppJsx } from "__TOOLKIT_DIR__/lib/inject-auth/splice-vite-react.mjs";
const target = process.argv[2];
const src = await readFile(target, "utf8");
const result = spliceViteReactAppJsx(src);
if (!result.ok) {
  process.stdout.write(JSON.stringify({ ok: false, reason: result.reason }));
  process.exit(0);
}
if (result.changed) await writeFile(target, result.content);
process.stdout.write(JSON.stringify({ ok: true, changed: result.changed, notes: result.notes }));
SPLICE_EOF
  sed -i.bak "s|__TOOLKIT_DIR__|$TOOLKIT_DIR|g" "$SPLICE_WRAPPER" && rm -f "${SPLICE_WRAPPER}.bak"
  SPLICE_OUT=$(node "$SPLICE_WRAPPER" "$APP_JSX")
  SPLICE_OK=$(node -p "($SPLICE_OUT).ok")
  if [ "$SPLICE_OK" = "true" ]; then
    SPLICE_CHANGED=$(node -p "($SPLICE_OUT).changed")
    if [ "$SPLICE_CHANGED" = "true" ]; then
      echo "▸ Spliced <SignInWithGoogle /> into src/App.jsx"
    else
      echo "▸ src/App.jsx already wired up; no change needed."
    fi
  else
    SPLICE_REASON=$(node -p "($SPLICE_OUT).reason")
    echo "▸ ⚠  Couldn't splice into src/App.jsx (reason: $SPLICE_REASON)."
    echo "  firebase-config.js and SignInWithGoogle.jsx are in place;"
    echo "  add the import + <SignInWithGoogle /> render to your entry"
    echo "  component manually, or re-run the wizard and pick the"
    echo "  'prompt' path."
  fi
fi

# Ensure `firebase` is in package.json deps. Only install when missing.
HAS_FIREBASE_DEP=$(node -e '
const fs = require("fs");
try {
  const pkg = JSON.parse(fs.readFileSync(process.argv[1] + "/package.json", "utf8"));
  const deps = { ...(pkg.dependencies||{}), ...(pkg.devDependencies||{}) };
  process.stdout.write(deps["firebase"] ? "yes" : "no");
} catch { process.stdout.write("no"); }
' "$APP_DIR")

if [ "$HAS_FIREBASE_DEP" = "no" ]; then
  echo "▸ Installing 'firebase' into your app (npm install firebase)…"
  (cd "$APP_DIR" && npm install firebase --no-fund --no-audit --loglevel=error)
  echo "▸ firebase dep installed."
else
  echo "▸ 'firebase' already in package.json; skipping install."
fi

# Pre-open the Firebase Console's Auth providers page on macOS so the user
# can flip Google sign-in on while the rest of the deploy finishes. There
# is no programmatic way to enable an auth provider (REVISIT A2); the
# best we can do is get them to the right page before they need it.
if [ "$(uname -s)" = "Darwin" ]; then
  AUTH_URL="https://console.firebase.google.com/project/$PROJECT_ID/authentication/providers"
  echo "▸ 📋 Opening Firebase Console so you can enable Google sign-in:"
  echo "    $AUTH_URL"
  echo "    (one-time per project; you can come back to it later if you prefer)"
  open "$AUTH_URL" >/dev/null 2>&1 || true
fi

echo "✓ Auth wiring done"
