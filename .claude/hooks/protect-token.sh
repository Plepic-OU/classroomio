#!/usr/bin/env bash
# Protects the GH token file from being read by tool calls.
# Exit code 2 = block the tool call.

input=$(cat)

# Construct the protected filename from parts
_p="github"; _s="token"; _TFILE="${_p}-${_s}"
TOKEN_PATH="/workspaces/classroomio/.devcontainer/${_TFILE}"

# Block Read tool from directly accessing the token file
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""' 2>/dev/null)
if [[ "$file_path" == *"${_TFILE}" ]]; then
  echo '{"decision":"block","reason":"Blocked: attempted to read token file"}'
  exit 2
fi

# Block Bash commands that read the token file
cmd=$(echo "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)
if echo "$cmd" | grep -qE "(cat|head|tail|less|more|open)\s[^ ]*${_TFILE}"; then
  echo '{"decision":"block","reason":"Blocked: shell command reads token file"}'
  exit 2
fi

# Block if the actual token value appears anywhere in the input
if [ -f "$TOKEN_PATH" ]; then
  _tok=$(tr -d '[:space:]' < "$TOKEN_PATH")
  if [ -n "$_tok" ] && echo "$input" | grep -qF "$_tok"; then
    echo '{"decision":"block","reason":"Blocked: token value detected in tool input"}'
    exit 2
  fi
fi
