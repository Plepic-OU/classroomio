#!/usr/bin/env bash
#
# PreToolUse hook: logs the last tool input to a per-tool file.
# Each invocation overwrites the previous content so you always see
# the most recent call for that tool.

set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
TOOL_INPUT=$(echo "$INPUT" | jq '.tool_input')

OUT_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/hook-output"
mkdir -p "$OUT_DIR"

# Write tool input to a per-tool file (overwrites = last message only)
echo "$TOOL_INPUT" | jq . > "$OUT_DIR/${TOOL_NAME}.json"

exit 0
