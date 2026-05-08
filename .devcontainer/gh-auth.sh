#!/usr/bin/env bash
set -euo pipefail

TOKEN_FILE="$(dirname "$0")/github-token"

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
