#!/usr/bin/env bash
# Authenticate GitHub CLI using a personal access token stored in .devcontainer/github-token

TOKEN_FILE="$(dirname "$0")/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "GitHub CLI: No token file found at .devcontainer/github-token"
  echo "  To enable gh authentication, create that file with a GitHub personal access token."
  echo "  Skipping gh auth setup."
  exit 0
fi

TOKEN="$(cat "$TOKEN_FILE" | tr -d '[:space:]')"

if [ -z "$TOKEN" ]; then
  echo "GitHub CLI: Token file exists but is empty. Skipping gh auth setup."
  exit 0
fi

echo "$TOKEN" | gh auth login --with-token
gh auth setup-git
echo "GitHub CLI: Authenticated and git credentials configured."
