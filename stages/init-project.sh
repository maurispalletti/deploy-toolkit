#!/usr/bin/env bash
# init-project.sh — initialize a brand-new project: git repo and GitHub repo.
# Firebase project creation happens in the following wizard step (init-firebase.sh).
# Usage: init-project.sh PARENT_DIR PROJECT_NAME
set -euo pipefail

PARENT_DIR="$1"
PROJECT_NAME="$2"
APP_DIR="$PARENT_DIR/$PROJECT_NAME"

step() { printf "▸ %s\n" "$1"; }
info() { printf "  %s\n" "$1"; }
toolkit_error() { printf "DEPLOY_TOOLKIT_ERROR:%s:%s\n" "$1" "$2"; }

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
    set +e
    GH_OUTPUT=$(gh repo create "$PROJECT_NAME" --private --source=. --remote=origin --push 2>&1)
    GH_EXIT=$?
    set -e
    if [ $GH_EXIT -ne 0 ]; then
      printf "%s\n" "$GH_OUTPUT"
      if echo "$GH_OUTPUT" | grep -qi "already exist\|Name already"; then
        toolkit_error "GITHUB_REPO_EXISTS" "A GitHub repo named '$PROJECT_NAME' already exists under your account. Delete it on GitHub or pick a different project name."
      elif echo "$GH_OUTPUT" | grep -qi "authentication\|credentials\|auth\|permission"; then
        toolkit_error "GITHUB_AUTH_FAILED" "GitHub authentication failed. Go back to Prerequisites and sign in to GitHub again."
      else
        toolkit_error "GITHUB_CREATE_FAILED" "Couldn't create the GitHub repository. Check the output above for details."
      fi
      exit $GH_EXIT
    fi
    REPO_URL=$(gh repo view "$PROJECT_NAME" --json url -q '.url' 2>/dev/null || true)
    info "Created: $REPO_URL"
  fi
fi

echo "✓ Git and GitHub setup complete"
printf "DEPLOY_TOOLKIT_SCRATCH_DONE:%s\t%s\t%s\n" "$PROJECT_NAME" "$APP_DIR" "$REPO_URL"
