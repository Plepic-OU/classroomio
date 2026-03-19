#!/usr/bin/env bash
# Authenticates GitHub CLI using a personal access token from .devcontainer/github-token

TOKEN_FILE="$(dirname "$0")/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "ℹ️  GitHub token not found at .devcontainer/github-token — skipping gh auth."
  echo "   To enable: echo 'YOUR_TOKEN' > .devcontainer/github-token"
  exit 0
fi

token=$(tr -d '[:space:]' < "$TOKEN_FILE")

if [ -z "$token" ]; then
  echo "⚠️  .devcontainer/github-token is empty — skipping gh auth."
  exit 0
fi

echo "$token" | gh auth login --with-token
gh auth setup-git
echo "✅ GitHub CLI authenticated and git credentials configured."
