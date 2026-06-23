#!/usr/bin/env bash
# init-project.sh — initialize a brand-new project: git repo, GitHub repo,
# and Firebase project.  Called by the wizard's "start from scratch" path.
# Usage: init-project.sh PARENT_DIR PROJECT_NAME
set -euo pipefail

PARENT_DIR="$1"
PROJECT_NAME="$2"
APP_DIR="$PARENT_DIR/$PROJECT_NAME"

step() { printf "▸ %s\n" "$1"; }
info() { printf "  %s\n" "$1"; }
fail() { printf "✗ %s\n" "$1" >&2; exit 1; }

# 1. Create project folder
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# 2. Git init
step "Initializing git repository"
if [ -d .git ]; then
  info "Git repository already exists — skipping"
else
  git init -b main
  info "Initialized empty repository in $APP_DIR"
fi

# 3. Ensure at least one commit so gh repo create --source=. --push works
if ! git log --oneline -1 >/dev/null 2>&1; then
  if [ ! -f .gitignore ]; then
    printf 'node_modules/\ndist/\n.env\n*.local\n.firebase/\n' > .gitignore
  fi
  git add .gitignore
  git commit -m "Initial commit"
  info "Created initial commit"
fi

# 4. GitHub auth
step "Checking GitHub login"
if ! gh auth status >/dev/null 2>&1; then
  info "Not logged in to GitHub — opening browser to authenticate..."
  gh auth login --hostname github.com --web --git-protocol https
fi
GH_USER=$(gh api user --jq '.login' 2>/dev/null || echo "")
if [ -n "$GH_USER" ]; then
  info "Logged in as: $GH_USER"
fi

# 5. GitHub repo
step "Creating GitHub repository"
REPO_URL=""
if git remote get-url origin >/dev/null 2>&1; then
  REPO_URL=$(git remote get-url origin)
  info "Remote 'origin' already set: $REPO_URL — skipping repo creation"
else
  REPO_EXISTS=$(gh repo view "$PROJECT_NAME" --json name -q '.name' 2>/dev/null || true)
  if [ -n "$REPO_EXISTS" ]; then
    REPO_URL=$(gh repo view "$PROJECT_NAME" --json url -q '.url' 2>/dev/null || true)
    git remote add origin "$REPO_URL"
    git push -u origin main >/dev/null 2>&1 || true
    info "GitHub repo already exists — linked: $REPO_URL"
  else
    gh repo create "$PROJECT_NAME" --private --source=. --remote=origin --push
    REPO_URL=$(gh repo view "$PROJECT_NAME" --json url -q '.url' 2>/dev/null || true)
    info "Created: $REPO_URL"
  fi
fi

# 6. Firebase project
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
    if echo "$CREATE_OUTPUT" | grep -q "PERMISSION_DENIED\|caller does not have permission"; then
      echo "DEPLOY_TOOLKIT_SENTINEL:NEEDS_BOOTSTRAP"
    fi
    exit $CREATE_EXIT
  fi
fi

echo "✓ Project setup complete"
printf "DEPLOY_TOOLKIT_SCRATCH_DONE:%s\t%s\t%s\n" "$PROJECT_NAME" "$APP_DIR" "$REPO_URL"
