#!/usr/bin/env bash
# Authenticate GitHub CLI using a personal access token stored in .devcontainer/github-token

TOKEN_FILE="$(dirname "$0")/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "ℹ️  GitHub CLI not authenticated."
  echo "   To enable gh auth, create .devcontainer/github-token with a GitHub personal access token."
  echo "   The file is gitignored and will not be committed."
  exit 0
fi

TOKEN="$(cat "$TOKEN_FILE" | tr -d '[:space:]')"

if [ -z "$TOKEN" ]; then
  echo "⚠️  .devcontainer/github-token exists but is empty. Skipping gh auth."
  exit 0
fi

echo "$TOKEN" | gh auth login --with-token
gh auth setup-git
echo "✅ GitHub CLI authenticated and git credentials configured."
