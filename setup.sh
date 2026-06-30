#!/bin/bash
set -e

echo "--- homebrew ---"
if brew --version &>/dev/null; then
  echo "Already installed — updating..."
  brew update && brew upgrade
else
  echo "Installing Homebrew..."
  sudo /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/homebrew/install/HEAD/install.sh)"
fi

echo "--- git ---"
if git --version &>/dev/null; then brew upgrade git 2>/dev/null || true; else brew install git; fi
git --version

echo "--- gh ---"
if gh --version &>/dev/null; then brew upgrade gh 2>/dev/null || true; else brew install gh; fi
gh --version

echo "--- node ---"
if node --version &>/dev/null; then brew upgrade node 2>/dev/null || true; else brew install node; fi
node --version

echo "--- firebase ---"
if firebase --version &>/dev/null; then npm update -g firebase-tools; else npm install -g firebase-tools; fi
firebase --version

echo "--- GitHub auth ---"
gh auth status || gh auth login --web

echo "--- Firebase auth ---"
firebase projects:list || (echo "Not logged in. Run: firebase login" && exit 1)

echo "--- Repo ---"
if [ -d "$HOME/Documents/deploy-toolkit" ]; then
  echo "Repo exists — pulling..."
  git -C "$HOME/Documents/deploy-toolkit" pull
else
  echo "Cloning..."
  git clone https://github.com/maurispalletti/deploy-toolkit "$HOME/Documents/deploy-toolkit"
fi

echo "=== Done ==="
