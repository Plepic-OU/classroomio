#!/usr/bin/env bash
set -euo pipefail

TOKEN_FILE=".devcontainer/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "ℹ️  GitHub CLI: no token file found at $TOKEN_FILE"
  echo "   Create it with a GitHub personal access token to enable gh CLI auth:"
  echo "   echo 'ghp_yourtoken' > .devcontainer/github-token"
else
  echo "==> Authenticating GitHub CLI..."
  gh auth login --with-token < "$TOKEN_FILE"
  gh auth setup-git
  echo "==> GitHub CLI authenticated (run 'gh auth status' to verify)"
fi

echo "✅ ClassroomIO devcontainer is ready. Run: pnpm dev:container"
