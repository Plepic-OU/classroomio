#!/usr/bin/env bash
set -euo pipefail

TOKEN_FILE=".devcontainer/github-token"

if [ ! -f "$TOKEN_FILE" ] || [ ! -s "$TOKEN_FILE" ]; then
  echo "ℹ️  GitHub CLI: no token found at $TOKEN_FILE — skipping auth."
  echo "   To authenticate, add a GitHub personal access token to $TOKEN_FILE and restart the container."
else
  echo "==> Authenticating GitHub CLI..."
  gh auth login --with-token < "$TOKEN_FILE"
  gh auth setup-git
  echo "✅ GitHub CLI authenticated."
fi

echo "✅ ClassroomIO devcontainer is ready. Run: pnpm dev:container"
