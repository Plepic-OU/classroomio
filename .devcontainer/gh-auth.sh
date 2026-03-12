#!/usr/bin/env bash
# Runs on every container start (postStartCommand).
# Authenticates the gh CLI using the token stored in .devcontainer/github-token.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN_FILE="$SCRIPT_DIR/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "ℹ️  GitHub CLI: no token found at .devcontainer/github-token — skipping auth."
  echo "   To enable: echo 'ghp_yourtoken' > .devcontainer/github-token"
  exit 0
fi

TOKEN="$(cat "$TOKEN_FILE" | tr -d '[:space:]')"

if [ -z "$TOKEN" ]; then
  echo "⚠️  GitHub CLI: .devcontainer/github-token is empty — skipping auth."
  exit 0
fi

echo "$TOKEN" | gh auth login --with-token
gh auth setup-git
echo "✅ GitHub CLI authenticated and git credentials configured."