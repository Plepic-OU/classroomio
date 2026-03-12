#!/bin/bash
input=$(cat)
if echo "$input" | grep -q '.devcontainer/github-token'; then
  echo "BLOCKED: Access to .devcontainer/github-token is not allowed" >&2
  exit 2
fi