#!/usr/bin/env bash
# report.sh — prints the live URL and a short "what now?" message.
set -euo pipefail

APP_DIR="$1"
CONFIG="$APP_DIR/deploy-app.config.json"

PROJECT_ID=$(node -p "require('$CONFIG').firebase.projectId")
SHAPE=$(node -p "require('$CONFIG').shape")
HAS_AUTH=$(node -p "require('$CONFIG').auth !== null")
HAS_FN=$(node -p "require('$CONFIG').functions !== null")

URL="https://${PROJECT_ID}.web.app"
CONSOLE="https://console.firebase.google.com/project/${PROJECT_ID}/overview"
AUTH_PROVIDERS_URL="https://console.firebase.google.com/project/${PROJECT_ID}/authentication/providers"

cat <<EOF

🎉  Your app is live: $URL

What you might want next:
  • Make changes? Edit your code, then run: deploy-app $APP_DIR
  • Manage the project: $CONSOLE
EOF

if [ "$HAS_AUTH" = "true" ]; then
  cat <<EOF
  • 🔐 One-time setup: enable Google sign-in in the Firebase Console:
      $AUTH_PROVIDERS_URL
      (Click "Google" → toggle Enable → Save. Auth won't work until you do this.)
EOF
fi

if [ "$HAS_FN" = "true" ]; then
  cat <<EOF
  • View function logs: firebase --project $PROJECT_ID functions:log
EOF
fi

echo
