#!/bin/bash
set -e

TOKEN_FILE=".devcontainer/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "ℹ️  GitHub CLI: no token file found at $TOKEN_FILE — skipping auth."
  echo "   To enable: echo 'ghp_yourtoken' > $TOKEN_FILE"
  exit 0
fi

token=$(cat "$TOKEN_FILE")

echo "$token" | gh auth login --with-token
gh auth setup-git
echo "✅ GitHub CLI authenticated and git credentials configured."
