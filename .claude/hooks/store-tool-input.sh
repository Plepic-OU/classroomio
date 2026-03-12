#!/usr/bin/env bash
# Reads a PreToolUse hook event from stdin and writes the tool_input
# to .claude/tool-inputs/<tool_name>.json, overwriting the previous run.

input=$(cat)

tool_name=$(printf '%s' "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name','unknown'))" 2>/dev/null)
tool_name="${tool_name:-unknown}"

dir="$(cd "$(dirname "$0")/.." && pwd)/tool-inputs"
mkdir -p "$dir"

printf '%s' "$input" | python3 -c "
import sys, json
d = json.load(sys.stdin)
payload = d.get('tool_input', d)
print(json.dumps(payload, indent=2))
" > "$dir/${tool_name}.json" 2>/dev/null

exit 0
