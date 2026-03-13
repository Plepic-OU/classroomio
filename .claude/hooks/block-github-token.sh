#!/bin/bash
input=$(cat)

if echo "$input" | grep -q "github-token"; then
  echo "Blocked: attempt to access .devcontainer/github-token" >&2
  exit 2
fi
