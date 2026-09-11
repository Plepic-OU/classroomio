#!/usr/bin/env bash
set -euo pipefail

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

target=""
case "$tool_name" in
  Read|NotebookEdit)
    target=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
    ;;
  Grep|Glob)
    target=$(echo "$input" | jq -r '[.tool_input.path, .tool_input.glob, .tool_input.pattern] | map(select(. != null)) | join(" ")')
    ;;
  Bash)
    target=$(echo "$input" | jq -r '.tool_input.command // empty')
    ;;
  *)
    exit 0
    ;;
esac

# Match the full relative/absolute path, or just the bare filename (catches
# `cd .devcontainer && cat github-token`, variable indirection referencing the
# same basename, globs like `git*-token`, etc.). This is a heuristic text
# match, not a hard boundary — see note below.
if [[ "$target" == *"github-token"* ]]; then
  echo "Blocked: .devcontainer/github-token is a protected credential file and cannot be read (attempted via $tool_name)." >&2
  exit 2
fi

exit 0

# NOTE: this hook is a heuristic text match on tool arguments, not a kernel-
# enforced boundary. A sufficiently creative Bash command (dd, xxd/od on the
# raw device path, a python/node one-liner that never spells "github-token",
# reading via a symlink under a different name, etc.) can still get around
# it. The only airtight mechanism is OS-level sandbox filesystem denial
# (sandbox.credentials.files / sandbox.filesystem.denyRead in settings.json),
# which requires bubblewrap (bwrap) on Linux — not installed in this
# devcontainer. Install bwrap and set sandbox.enabled: true for a real
# kernel-level guarantee; until then, this hook plus the permissions.deny
# rules in .claude/settings.json are defense-in-depth, not a hard guarantee.
