#!/bin/bash
set -euo pipefail

TOKEN_FILE="$(dirname "$0")/github-token"

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "ℹ️  GitHub CLI not authenticated. To enable gh and git credentials:"
  echo "   echo 'YOUR_GITHUB_TOKEN' > .devcontainer/github-token"
  echo "   Then restart the container or run: bash .devcontainer/gh-auth.sh"
  exit 0
fi

TOKEN="$(cat "$TOKEN_FILE")"
if [[ -z "$TOKEN" ]]; then
  echo "⚠️  .devcontainer/github-token is empty — skipping gh auth."
  exit 0
fi

echo "$TOKEN" | gh auth login --with-token
gh auth setup-git
echo "✅ GitHub CLI authenticated and git credentials configured."
