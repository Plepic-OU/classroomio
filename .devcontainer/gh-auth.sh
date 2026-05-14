#!/usr/bin/env bash
set -euo pipefail

TOKEN_FILE=".devcontainer/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "GitHub CLI auth skipped: $TOKEN_FILE not found. Add a personal access token there to enable 'gh' auth."
  exit 0
fi

TOKEN="$(tr -d '\r\n' < "$TOKEN_FILE")"

if [ -z "$TOKEN" ] || [ "$TOKEN" = "GITHUB_TOKEN_PLACEHOLDER" ]; then
  echo "GitHub CLI auth skipped: $TOKEN_FILE is empty or still using the placeholder value."
  exit 0
fi

printf '%s' "$TOKEN" | gh auth login --hostname github.com --with-token
gh auth setup-git

