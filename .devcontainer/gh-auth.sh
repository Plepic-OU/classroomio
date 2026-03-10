#!/usr/bin/env bash
# Authenticate GitHub CLI using a personal access token from .devcontainer/github-token

set -euo pipefail

TOKEN_FILE="$(dirname "$0")/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "ℹ️  GitHub CLI not authenticated."
  echo "   To enable gh and git credential support, create:"
  echo "   .devcontainer/github-token"
  echo "   with a GitHub personal access token (one line, no newline)."
  exit 0
fi

echo "$(<"$TOKEN_FILE")" | gh auth login --with-token
gh auth setup-git
echo "✅ GitHub CLI authenticated and git credentials configured."
