#!/usr/bin/env bash
# Authenticate GitHub CLI using a personal access token stored in
# .devcontainer/github-token. Runs on every container start so that
# gh and git credentials stay configured across restarts.

set -euo pipefail

TOKEN_FILE="$(dirname "$0")/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "No GitHub token found. To enable gh CLI auth:"
  echo "   1. Create a file at .devcontainer/github-token"
  echo "   2. Paste a GitHub PAT with the scopes you need (e.g. repo, read:org)"
  echo "   3. Rebuild or restart the container"
  echo "   (This file is already in .gitignore and will not be committed.)"
  exit 0
fi

TOKEN=$(cat "$TOKEN_FILE" | tr -d '[:space:]')

if [ -z "$TOKEN" ]; then
  echo "WARNING: .devcontainer/github-token exists but is empty. Skipping gh auth."
  exit 0
fi

echo "$TOKEN" | gh auth login --with-token
gh auth setup-git
echo "GitHub CLI authenticated and git credentials configured."
