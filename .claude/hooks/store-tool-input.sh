#\!/usr/bin/env bash
# Stores the last invocation input for each tool in .claude/tool-inputs/<tool_name>.json
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../tool-inputs"
input=$(cat)
tool=$(echo "$input" | jq -r '.tool_name' | tr -d '')
mkdir -p "$OUTPUT_DIR"
echo "$input" | jq '.tool_input' > "$OUTPUT_DIR/${tool}.json"
