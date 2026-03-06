#!/bin/bash
set -e

TOKEN_FILE="$(dirname "$0")/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "ℹ️  GitHub CLI auth skipped: no token file found at .devcontainer/github-token"
  echo "   To enable, create that file with a GitHub personal access token."
  exit 0
fi

TOKEN=$(cat "$TOKEN_FILE")

echo "$TOKEN" | gh auth login --with-token
gh auth setup-git
echo "GitHub CLI authenticated and git credentials configured."
