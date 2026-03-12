#!/bin/bash
# Log the last invocation input for each tool to a separate file

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

if [ -n "$TOOL_NAME" ]; then
  LOG_DIR="$CLAUDE_PROJECT_DIR/.claude/hook-logs"
  mkdir -p "$LOG_DIR"
  echo "$INPUT" | jq '.' > "$LOG_DIR/$TOOL_NAME.json"
fi

exit 0
