Check and install all required CLI tools, then ensure the user is authenticated with GitHub CLI and Firebase CLI.

Run each step below in sequence:

## 1. Install or update all tools

For each tool below, if it is **already installed** run the update command; if it is **not installed** run the install command:

- **homebrew**
  - check: `brew --version`
  - install: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/homebrew/install/HEAD/install.sh)"`
  - update: `brew update && brew upgrade`

- **bru**
  - check: `bru --version`
  - install: `npm install -g @usebruno/cli`
  - update: `npm update -g @usebruno/cli`

- **git**
  - check: `git --version`
  - install: `brew install git`
  - update: `brew upgrade git`

- **gh**
  - check: `gh --version`
  - install: `brew install gh`
  - update: `brew upgrade gh`

- **node**
  - check: `node --version`
  - install: `brew install node`
  - update: `brew upgrade node`

- **firebase**
  - check: `firebase --version`
  - install: `npm install -g firebase-tools`
  - update: `npm update -g firebase-tools`

Report each tool's status (updated / freshly installed / failed) and the version after the operation.

## 2. Check GitHub CLI auth

Run `gh auth status`. If the user is not logged in (exit code non-zero or output says "not logged in"), tell them to run:
```
gh auth login
```
and wait for them to confirm before continuing.

## 3. Check Firebase CLI auth

Run `firebase projects:list` (a lightweight authenticated call). If it fails with an auth error, tell the user to run:
```
firebase login
```
and wait for them to confirm they've completed the login before continuing.

## 4. Summary

Print a table showing each tool's installed version and auth status.
