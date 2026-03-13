#!/usr/bin/env bash
# Authenticate GitHub CLI from a local token file.
# Runs on every container start (postStartCommand).

TOKEN_FILE="$(dirname "$0")/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "ℹ️  No GitHub token found. To enable gh CLI and git credential auth:"
  echo "   1. Create a personal access token at https://github.com/settings/tokens"
  echo "   2. Save it to .devcontainer/github-token (this file is git-ignored)"
  echo "   3. Restart the container or run: bash .devcontainer/gh-auth.sh"
  exit 0
fi

TOKEN="$(cat "$TOKEN_FILE")"

if [ -z "$TOKEN" ]; then
  echo "⚠️  .devcontainer/github-token exists but is empty. Skipping gh auth."
  exit 0
fi

echo "$TOKEN" | gh auth login --with-token
gh auth setup-git
echo "✅ gh CLI authenticated and git credentials configured."
