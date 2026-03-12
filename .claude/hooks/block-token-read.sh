#!/bin/bash
# PreToolUse hook: block any tool invocation that references the github-token file.
# Exit code 2 tells Claude Code to reject the tool call.

INPUT=$(cat)
TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input')

if echo "$TOOL_INPUT" | grep -q 'github-token'; then
  echo "BLOCKED: access to .devcontainer/github-token is prohibited."
  exit 2
fi

exit 0
