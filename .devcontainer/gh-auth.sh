#!/usr/bin/env bash
set -euo pipefail

TOKEN_FILE="$(dirname "$0")/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "No GitHub token found. To enable gh CLI auth:"
  echo "  1. Create a personal access token at https://github.com/settings/tokens"
  echo "  2. Save it to .devcontainer/github-token"
  echo "  3. Restart the container (the file is gitignored)"
  exit 0
fi

GITHUB_TOKEN="$(cat "$TOKEN_FILE")"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "GitHub token file is empty. Skipping gh auth."
  exit 0
fi

echo "$GITHUB_TOKEN" | gh auth login --with-token
gh auth setup-git
echo "GitHub CLI authenticated and git credentials configured."
