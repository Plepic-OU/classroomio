#!/bin/bash
# Pre-tool-use hook: logs the last tool input to a per-tool file.
# Each invocation overwrites the previous content so you always see the last call.

LOG_DIR="/workspaces/classroomio/.claude/hook-logs"
mkdir -p "$LOG_DIR"

# Read the hook payload from stdin
INPUT=$(cat)

# Extract tool name from the JSON payload
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')

# Sanitize tool name for use as filename (replace non-alphanumeric with underscore)
SAFE_NAME=$(echo "$TOOL_NAME" | sed 's/[^a-zA-Z0-9_-]/_/g')

# Write the full input payload to a per-tool file (overwrite = last message only)
echo "$INPUT" | jq '.' > "$LOG_DIR/${SAFE_NAME}.json" 2>/dev/null || echo "$INPUT" > "$LOG_DIR/${SAFE_NAME}.json"
