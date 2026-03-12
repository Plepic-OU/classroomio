#!/bin/bash
# Block Claude Code from accessing the GitHub token file

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

if [ "$TOOL_NAME" = "Bash" ]; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
  if echo "$COMMAND" | grep -q 'github-token'; then
    echo "Blocked: command references github-token" >&2
    exit 2
  fi
else
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
  if echo "$FILE_PATH" | grep -q 'github-token'; then
    echo "Blocked: access to github-token is prohibited" >&2
    exit 2
  fi
fi

exit 0
