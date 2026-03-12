#!/usr/bin/env bash
# PreToolUse hook: exits 2 (block) if the GitHub token appears in the tool input.

TOKEN_FILE="/workspaces/classroomio/.devcontainer/github-token"

# Nothing to check if the token file doesn't exist or is empty.
if [ ! -s "$TOKEN_FILE" ]; then
  exit 0
fi

TOKEN="$(cat "$TOKEN_FILE" | tr -d '[:space:]')"

input=$(cat)

if printf '%s' "$input" | grep -qF "$TOKEN"; then
  echo "Blocked: GitHub token detected in tool input." >&2
  exit 2
fi
