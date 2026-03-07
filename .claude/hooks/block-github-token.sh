#!/bin/bash
# PreToolUse hook: block access to .devcontainer/github-token
# Exit code 2 = block the tool call

TOOL_INPUT=$(cat)

if echo "$TOOL_INPUT" | grep -q "github-token"; then
  echo "BLOCKED: Access to .devcontainer/github-token is not allowed."
  exit 2
fi

exit 0
