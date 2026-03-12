#!/usr/bin/env bash
# PreToolUse hook: block any tool call that references the github-token file

set -euo pipefail

INPUT=$(cat)

# Serialize the full tool input to a single string for matching
if echo "$INPUT" | jq -r '.tool_input | tostring' | grep -qi 'github-token'; then
  echo "Blocked: access to .devcontainer/github-token is prohibited" >&2
  exit 2
fi

exit 0
