#!/usr/bin/env bash
# PreToolUse hook: block any tool call that references the github-token file.

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

case "$TOOL_NAME" in
  Read|Edit|Write)
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
    if [[ "$FILE_PATH" == *"github-token"* ]]; then
      echo "Blocked: reading or writing github-token is prohibited" >&2
      exit 2
    fi
    ;;
  Bash)
    COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
    if [[ "$COMMAND" == *"github-token"* ]]; then
      echo "Blocked: command references github-token" >&2
      exit 2
    fi
    ;;
  Grep|Glob)
    PATTERN=$(echo "$INPUT" | jq -r '.tool_input.pattern // empty')
    PATH_ARG=$(echo "$INPUT" | jq -r '.tool_input.path // empty')
    if [[ "$PATTERN" == *"github-token"* || "$PATH_ARG" == *"github-token"* ]]; then
      echo "Blocked: search references github-token" >&2
      exit 2
    fi
    ;;
esac

exit 0
