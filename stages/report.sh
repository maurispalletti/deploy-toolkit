#!/usr/bin/env bash
# report.sh — prints the live URL and a short "what now?" message.
set -euo pipefail

APP_DIR="$1"
CONFIG="$APP_DIR/deploy-app.config.json"

PROJECT_ID=$(node -p "require('$CONFIG').firebase.projectId")
SHAPE=$(node -p "require('$CONFIG').shape")

URL="https://${PROJECT_ID}.web.app"
CONSOLE="https://console.firebase.google.com/project/${PROJECT_ID}/overview"

cat <<EOF

🎉  Your app is live: $URL

What you might want next:
  • Make changes? Edit your code, then run: deploy-app $APP_DIR
  • Manage the project: $CONSOLE
  • View logs: firebase --project $PROJECT_ID functions:log

EOF
