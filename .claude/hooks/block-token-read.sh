#\!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
PATTERN="github-token"
if echo "$FILE_PATH" | grep -qi "$PATTERN"; then
  echo "BLOCKED: Access to this file is prohibited." >&2
  echo "BLOCKED: Access to this file is prohibited."
  exit 2
fi
if echo "$CMD" | grep -qi "$PATTERN"; then
  echo "BLOCKED: Access to this file is prohibited." >&2
  echo "BLOCKED: Access to this file is prohibited."
  exit 2
fi
exit 0
