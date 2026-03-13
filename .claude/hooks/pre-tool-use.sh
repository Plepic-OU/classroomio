#!/bin/bash
# preToolUse hook: block Claude from using any tool that contains the GitHub token

TOKEN_FILE="$(cd "$(dirname "$0")/../.." && pwd)/.devcontainer/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  exit 0
fi

TOKEN=$(cat "$TOKEN_FILE" | tr -d '[:space:]')

if [ -z "$TOKEN" ]; then
  exit 0
fi

INPUT=$(cat)

if echo "$INPUT" | grep -qF "$TOKEN"; then
  echo "🚫 Blocked: GitHub token detected in tool input. Refusing to proceed." >&2
  exit 2
fi
