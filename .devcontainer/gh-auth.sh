#!/usr/bin/env bash
# Authenticate GitHub CLI from a local token file.
# This runs on every container start (postStartCommand).

TOKEN_FILE=".devcontainer/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "ℹ️  GitHub CLI not authenticated."
  echo "   To enable gh and git credential support:"
  echo "   1. Create a Personal Access Token at https://github.com/settings/tokens"
  echo "   2. Save it to .devcontainer/github-token (this file is gitignored)"
  echo "   3. Rebuild or restart the container"
  exit 0
fi

TOKEN=$(cat "$TOKEN_FILE" | tr -d '[:space:]')

if [ -z "$TOKEN" ]; then
  echo "⚠️  .devcontainer/github-token exists but is empty. Skipping gh auth."
  exit 0
fi

echo "$TOKEN" | gh auth login --with-token
gh auth setup-git
echo "✅ GitHub CLI authenticated and git credentials configured."
