#!/bin/bash
# Pre-tool hook: blocks any tool access to github-token files
# Exit code 2 blocks the tool call and shows an error to the user

input=$(cat)

if echo "$input" | grep -qi "github-token"; then
  echo "Blocked: Access to .devcontainer/github-token file is not allowed." >&2
  exit 2
fi

exit 0
