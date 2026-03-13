#!/bin/bash
set -e

TOKEN_FILE="$(dirname "$0")/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "ℹ️  GitHub CLI not authenticated."
  echo "   To enable gh and git authentication, create .devcontainer/github-token"
  echo "   containing a GitHub personal access token, then restart the container."
  exit 0
fi

TOKEN=$(cat "$TOKEN_FILE")

echo "$TOKEN" | gh auth login --with-token
gh auth setup-git

echo "✅ GitHub CLI authenticated and git credentials configured."
