#!/usr/bin/env bash
# setup-dev-tools.sh — install Homebrew, Git, and GitHub CLI in order.
# Called from preflight.sh before Node/Firebase checks.
# Each tool is checked immediately before any install attempt.
set -euo pipefail

step() { printf "▸ %s\n" "$1"; }
fail() { printf "✗ %s\n" "$1" >&2; exit 1; }
info() { printf "  %s\n" "$1"; }

confirm_install() {
  local prompt="$1"
  if [ "${DEPLOY_TOOLKIT_YES:-}" = "1" ]; then return 0; fi
  printf "  %s [Y/n] " "$prompt"
  read -r reply
  case "${reply:-Y}" in
    [Nn]*) return 1 ;;
    *) return 0 ;;
  esac
}

ensure_brew_path() {
  if command -v brew >/dev/null 2>&1; then return 0; fi
  if [ -x /opt/homebrew/bin/brew ]; then
    # shellcheck disable=SC1091
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    # shellcheck disable=SC1091
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

is_brew_installed() {
  ensure_brew_path
  command -v brew >/dev/null 2>&1
}

is_cmd_installed() {
  local cmd="$1"
  ensure_brew_path
  command -v "$cmd" >/dev/null 2>&1
}

is_brew_formula_installed() {
  local formula="$1"
  is_brew_installed || return 1
  brew list --formula "$formula" &>/dev/null 2>&1
}

setup_brew() {
  step "Checking Homebrew"
  if is_brew_installed; then
    info "Homebrew already installed ($(command -v brew))"
    return 0
  fi

  if ! confirm_install "Homebrew not found. Install it now? (needs your password)"; then
    fail "Homebrew required on macOS. Install manually: https://brew.sh"
  fi

  if is_brew_installed; then
    info "Homebrew already installed — skipping"
    return 0
  fi

  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  if ! is_brew_installed; then
    fail "Homebrew install finished but 'brew' is not on PATH. Follow the post-install instructions in your terminal, then re-run."
  fi
  info "Homebrew installed ($(command -v brew))"
}

setup_git() {
  step "Checking Git"
  if is_cmd_installed git; then
    info "Git already installed ($(command -v git))"
    return 0
  fi

  if [[ "$(uname -s)" == "Darwin" ]]; then
    if is_brew_formula_installed git; then
      fail "Git is installed via Homebrew but not on PATH. Open a new terminal or add Homebrew to your shell profile, then re-run."
    fi
    if ! is_brew_installed; then
      fail "Homebrew is required to install Git. Run setup again after Homebrew is available."
    fi
    if ! confirm_install "Git not found. Install it now via Homebrew?"; then
      fail "Git required. Install manually: brew install git"
    fi
    if is_cmd_installed git; then
      info "Git already installed — skipping"
      return 0
    fi
    if is_brew_formula_installed git; then
      info "Git already installed via Homebrew — skipping"
      return 0
    fi
    brew install git
    if ! is_cmd_installed git; then
      fail "Git install finished but 'git' is not on PATH."
    fi
    info "Git installed ($(command -v git))"
    return 0
  fi

  fail "Git not found. Install via your package manager (e.g. apt install git)."
}

setup_gh() {
  step "Checking GitHub CLI (gh)"
  if is_cmd_installed gh; then
    info "GitHub CLI already installed ($(command -v gh))"
    return 0
  fi

  if [[ "$(uname -s)" == "Darwin" ]]; then
    if is_brew_formula_installed gh; then
      fail "GitHub CLI is installed via Homebrew but not on PATH. Open a new terminal or add Homebrew to your shell profile, then re-run."
    fi
    if ! is_brew_installed; then
      fail "Homebrew is required to install GitHub CLI. Run setup again after Homebrew is available."
    fi
    if ! confirm_install "GitHub CLI (gh) not found. Install it now via Homebrew?"; then
      fail "GitHub CLI required. Install manually: brew install gh"
    fi
    if is_cmd_installed gh; then
      info "GitHub CLI already installed — skipping"
      return 0
    fi
    if is_brew_formula_installed gh; then
      info "GitHub CLI already installed via Homebrew — skipping"
      return 0
    fi
    brew install gh
    if ! is_cmd_installed gh; then
      fail "GitHub CLI install finished but 'gh' is not on PATH."
    fi
    info "GitHub CLI installed ($(command -v gh))"
    return 0
  fi

  fail "GitHub CLI not found. Install manually: https://github.com/cli/cli#installation"
}

if [[ "$(uname -s)" == "Darwin" ]]; then
  setup_brew
fi
setup_git
setup_gh

if [[ "$(uname -s)" == "Darwin" ]]; then
  step "Dev tools ready (Homebrew, Git, GitHub CLI)"
else
  step "Dev tools ready (Git, GitHub CLI)"
fi
