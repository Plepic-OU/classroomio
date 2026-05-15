#!/bin/bash
# Reads pre-tool-call JSON from stdin and writes it to .claude/tool-logs/<tool_name>.json
# Each file holds only the last invocation (overwrites on each call).

input=$(cat)
tool_name=$(printf '%s' "$input" | jq -r '.tool_name // "unknown"')

mkdir -p "$(dirname "$0")/../tool-logs"
log_dir="$(dirname "$0")/../tool-logs"

printf '%s' "$input" | jq '.' > "${log_dir}/${tool_name}.json"
