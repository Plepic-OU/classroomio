#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN_FILE="$SCRIPT_DIR/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "⚠️  No GitHub token found at $TOKEN_FILE — skipping gh CLI authentication."
  echo "   Create that file (containing a GitHub personal access token) and restart the container to enable 'gh' and git credential authentication."
  exit 0
fi

if gh auth login --with-token < "$TOKEN_FILE" && gh auth setup-git; then
  echo "✅ GitHub CLI authenticated and git credentials configured."
else
  echo "⚠️  GitHub CLI authentication failed. Check that $TOKEN_FILE contains a valid, non-expired token."
fi
