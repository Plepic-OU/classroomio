#!/bin/bash

TOKEN_FILE="$(dirname "$0")/github-token"

if [ ! -f "$TOKEN_FILE" ] || [ ! -s "$TOKEN_FILE" ]; then
  echo "ℹ️  GitHub auth skipped: no token found at .devcontainer/github-token"
  echo "   To enable, add a GitHub PAT to that file and restart the container."
  exit 0
fi

TOKEN=$(cat "$TOKEN_FILE")

echo "$TOKEN" | gh auth login --with-token
gh auth setup-git
echo "✅ GitHub CLI authenticated and git credentials configured."
