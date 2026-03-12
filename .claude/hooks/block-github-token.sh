#!/bin/bash
input=$(cat)
if echo "$input" | grep -q '.devcontainer/github-token'; then
  echo "BLOCKED: Access to .devcontainer/github-token is not allowed" >&2
  echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") BLOCKED: $input" >> /workspaces/classroomio/.claude/logs/block-github-token.log
  exit 2
fi
