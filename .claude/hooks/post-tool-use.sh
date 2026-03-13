#!/bin/bash
# Catch-all postToolUse hook: saves the last tool input to .claude/tool-inputs/<tool_name>.json

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name','unknown'))" 2>/dev/null || echo "unknown")

mkdir -p "$(dirname "$0")/../tool-inputs"
echo "$INPUT" > "$(dirname "$0")/../tool-inputs/${TOOL_NAME}.json"
