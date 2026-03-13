#!/bin/bash
set -euo pipefail

TOKEN_FILE="$(dirname "$0")/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "⚠️  GitHub token not found at $TOKEN_FILE"
  echo "    Create it with: echo 'your_token' > .devcontainer/github-token"
  exit 0
fi

TOKEN=$(cat "$TOKEN_FILE")
echo "$TOKEN" | gh auth login --with-token
gh auth setup-git
echo "✅ GitHub CLI authenticated successfully"
