#!/usr/bin/env bash
# inject-secrets.sh — given a deploy-app.config.json whose plan.secrets
# has been populated by the Classify wizard page, write out the values
# in the right places:
#
#   - "browser-safe" → append NAME=value to <app>/.env.production
#     (idempotent — same-NAME lines are overwritten).
#   - "server-only" + plan.functions !== null + value provided →
#     run `firebase functions:secrets:set NAME` with the value piped in.
#     (Skipped when value is empty; the user gets a heads-up to do it
#     manually for v1. P2 follow-up: surface a separate UI prompt for
#     missing values.)
#
# When plan.secrets is null or empty, the stage prints a one-liner and
# exits 0 — there's nothing to ingest.
set -euo pipefail

APP_DIR="$1"
CONFIG="$APP_DIR/deploy-app.config.json"

[ -f "$CONFIG" ] || { echo "✗ Missing $CONFIG"; exit 1; }

cd "$APP_DIR"

# Read plan.secrets.perKey. Use a small node helper because jq isn't
# guaranteed to be installed on the user's box and the rest of the
# toolkit reads JSON via `node -p` already.
PERKEY_JSON=$(node -e '
const cfg = require(process.argv[1]);
const perKey = (cfg.secrets && cfg.secrets.perKey) || [];
process.stdout.write(JSON.stringify(perKey));
' "$CONFIG")

PERKEY_COUNT=$(node -p "($PERKEY_JSON).length")

if [ "$PERKEY_COUNT" = "0" ]; then
  echo "▸ No config values to ingest; skipping."
  echo "✓ Secrets ingestion done"
  exit 0
fi

PROJECT_ID=$(node -p "require('$CONFIG').firebase.projectId")
HAS_FUNCTIONS=$(node -p "require('$CONFIG').functions !== null ? 'yes' : 'no'")

echo "▸ Ingesting $PERKEY_COUNT config value(s)…"

# Step 1: write browser-safe values to .env.production. We use a tiny
# node helper to be careful about idempotency (overwrite same-NAME
# lines, preserve everything else).
node -e '
const fs = require("fs");
const cfg = require(process.argv[1]);
const perKey = (cfg.secrets && cfg.secrets.perKey) || [];
const targets = perKey.filter(k => k.classification === "browser-safe");
if (targets.length === 0) { console.log("▸ No browser-safe values to write."); process.exit(0); }

const path = ".env.production";
const existing = fs.existsSync(path) ? fs.readFileSync(path, "utf8").split(/\r?\n/) : [];
const seen = new Set();
const out = [];
for (const line of existing) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=/);
  if (!m) { out.push(line); continue; }
  const name = m[1];
  const replacement = targets.find(t => t.name === name);
  if (!replacement) { out.push(line); continue; }
  seen.add(name);
  const v = replacement.value || "";
  out.push(`${name}=${v}`);
}
for (const t of targets) {
  if (seen.has(t.name)) continue;
  const v = t.value || "";
  out.push(`${t.name}=${v}`);
}
// Strip trailing blank lines, then append exactly one.
while (out.length > 0 && out[out.length - 1] === "") out.pop();
out.push("");
fs.writeFileSync(path, out.join("\n"));
console.log(`▸ Wrote ${targets.length} browser-safe value(s) to ${path}`);
' "$CONFIG"

# Step 2: server-only secrets — only when this app has a functions block.
# We pipe each value into `firebase functions:secrets:set <NAME>` so it
# never lands on stdout or in process args (the firebase CLI accepts the
# value on stdin when invoked this way).
if [ "$HAS_FUNCTIONS" = "no" ]; then
  # Edge case: user classified something as server-only on a Shape A/B
  # plan. The Classify UI already warned them; we surface a one-liner
  # here so the deploy log shows the same context, but we don't fail.
  NEEDS_NOTICE=$(node -p "((require('$CONFIG').secrets || {}).perKey || []).filter(k=>k.classification==='server-only').length")
  if [ "$NEEDS_NOTICE" != "0" ]; then
    echo "▸ ⚠  $NEEDS_NOTICE server-only value(s) classified but this app has no backend."
    echo "  These values have no safe home in a static deploy. Re-run the wizard"
    echo "  and either flip them to browser-safe or add a backend (Shape C)."
  fi
fi

if [ "$HAS_FUNCTIONS" = "yes" ]; then
  # Emit a newline-separated NAME<TAB>VALUE list of server-only keys
  # with non-empty values. Empty-value keys get a manual-setup hint
  # printed and are skipped.
  TMPLIST=$(node -e '
const cfg = require(process.argv[1]);
const perKey = (cfg.secrets && cfg.secrets.perKey) || [];
const out = [];
for (const k of perKey) {
  if (k.classification !== "server-only") continue;
  out.push(`${k.name}\t${(k.value || "").length}\t${(k.value || "").replace(/[\r\n]/g, " ")}`);
}
process.stdout.write(out.join("\n"));
' "$CONFIG")

  if [ -z "$TMPLIST" ]; then
    echo "▸ No server-only values to ingest."
  else
    # POSIX-friendly per-line read.
    OLD_IFS="$IFS"
    IFS=$'\n'
    for entry in $TMPLIST; do
      NAME=$(printf "%s" "$entry" | cut -f1)
      VALEN=$(printf "%s" "$entry" | cut -f2)
      VALUE=$(printf "%s" "$entry" | cut -f3-)
      if [ "$VALEN" = "0" ]; then
        echo "▸ ⚠  $NAME has no value yet."
        echo "  Run manually when ready:"
        echo "    firebase functions:secrets:set $NAME --project $PROJECT_ID"
        continue
      fi
      echo "▸ Setting Firebase secret $NAME (length: $VALEN)"
      # The firebase CLI accepts the secret value on stdin when invoked
      # this way. We use `--data-file -` if supported, else fall back to
      # the standard stdin behavior.
      if printf "%s" "$VALUE" | firebase functions:secrets:set "$NAME" --project "$PROJECT_ID" --data-file - >/dev/null 2>&1; then
        echo "  ✓ $NAME set"
      else
        # Some CLI versions don't support --data-file; retry with bare stdin.
        if printf "%s" "$VALUE" | firebase functions:secrets:set "$NAME" --project "$PROJECT_ID" >/dev/null 2>&1; then
          echo "  ✓ $NAME set"
        else
          echo "  ⚠  failed to set $NAME — run manually:"
          echo "    firebase functions:secrets:set $NAME --project $PROJECT_ID"
        fi
      fi
    done
    IFS="$OLD_IFS"
  fi
fi

echo "✓ Secrets ingestion done"
