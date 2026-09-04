#!/usr/bin/env bash
# Catch-all observability hook (PreToolUse, matcher "*").
#
# Writes the MOST RECENT invocation input of each tool to its own file under
# .claude/tool-log/<ToolName>.json — so the directory is a live snapshot of
# "what did each tool last get called with", not an append-only audit trail.
#
# This hook never blocks: it always exits 0, whatever happens.
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
LOG_DIR="$PROJECT_DIR/.claude/tool-log"

payload="$(cat)"

mkdir -p "$LOG_DIR" 2>/dev/null || exit 0

tool="$(printf '%s' "$payload" | jq -r '.tool_name // "unknown"' 2>/dev/null)"
[ -z "$tool" ] && tool="unknown"

# MCP tools are named like "mcp__server__tool" and agent types can contain
# spaces or slashes — squash anything that is not filename-safe.
safe="$(printf '%s' "$tool" | tr -c 'A-Za-z0-9._-' '_')"

printf '%s' "$payload" \
  | jq '{
      logged_at:  (now | todate),
      session_id: .session_id,
      cwd:        .cwd,
      tool_name:  .tool_name,
      tool_input: .tool_input
    }' > "$LOG_DIR/$safe.json" 2>/dev/null \
  || printf '%s' "$payload" > "$LOG_DIR/$safe.json" 2>/dev/null

exit 0
