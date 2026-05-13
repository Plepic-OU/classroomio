#!/usr/bin/env bash
set -euo pipefail

TOKEN_FILE="$(dirname "$0")/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  cat <<EOF
==> Skipping GitHub CLI auth: no token file found at $TOKEN_FILE
    To enable gh authentication, create the file with a GitHub token:
        echo "ghp_yourtoken" > $TOKEN_FILE
    The file is gitignored and will be picked up on the next container start.
EOF
  exit 0
fi

TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"

if [ -z "$TOKEN" ]; then
  echo "==> Skipping GitHub CLI auth: $TOKEN_FILE is empty."
  exit 0
fi

echo "==> Authenticating GitHub CLI..."
echo "$TOKEN" | gh auth login --with-token

echo "==> Configuring git to use gh credentials..."
gh auth setup-git

echo "==> GitHub CLI authentication complete."
