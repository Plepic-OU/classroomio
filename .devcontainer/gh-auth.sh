#!/usr/bin/env bash
set -euo pipefail

TOKEN_FILE="$(dirname "$0")/github-token"

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo ""
  echo "ℹ️  GitHub CLI is not authenticated."
  echo "   To authenticate, create .devcontainer/github-token containing a GitHub PAT"
  echo "   (with 'repo' and 'read:org' scopes), then restart the container or run:"
  echo "   bash .devcontainer/gh-auth.sh"
  echo ""
  echo "✅ ClassroomIO devcontainer is ready. Run: pnpm dev:container"
  exit 0
fi

echo "🔑 Authenticating GitHub CLI..."
gh auth login --with-token < "$TOKEN_FILE"
gh auth setup-git
echo "✅ GitHub CLI authenticated. Run: pnpm dev:container"
