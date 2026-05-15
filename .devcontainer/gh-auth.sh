#!/usr/bin/env bash
set -euo pipefail

TOKEN_FILE="$(dirname "$0")/github-token"

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo ""
  echo "ℹ️  GitHub CLI: no token found."
  echo "   To authenticate, create .devcontainer/github-token containing a"
  echo "   GitHub personal access token (classic) with repo + read:org scopes,"
  echo "   then restart the container or run: bash .devcontainer/gh-auth.sh"
  echo ""
else
  gh auth login --with-token < "$TOKEN_FILE"
  gh auth setup-git
  echo "✅ GitHub CLI authenticated as $(gh api user --jq .login)"
fi

echo "✅ ClassroomIO devcontainer is ready. Run: pnpm dev:container"
