#!/usr/bin/env bash
set -euo pipefail

TOKEN_FILE=".devcontainer/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "⚠️  GitHub token file not found at $TOKEN_FILE"
  echo "   To enable gh CLI authentication:"
  echo "   1. Create a personal access token at https://github.com/settings/tokens"
  echo "   2. Save it to $TOKEN_FILE (this file is gitignored)"
  echo "   Skipping gh auth setup."
  exit 0
fi

TOKEN="$(cat "$TOKEN_FILE" | tr -d '[:space:]')"

if [ -z "$TOKEN" ]; then
  echo "⚠️  GitHub token file is empty. Skipping gh auth setup."
  exit 0
fi

echo "$TOKEN" | gh auth login --with-token
gh auth setup-git
echo "✅ GitHub CLI authenticated and git credentials configured."
