#!/bin/bash
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input')

TRACE_DIR="/workspaces/classroomio/.claude/tool-traces"
mkdir -p "$TRACE_DIR"
echo "$TOOL_INPUT" | jq '.' > "$TRACE_DIR/$TOOL_NAME.json"
exit 0
