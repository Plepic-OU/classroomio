#!/usr/bin/env bash
# Wrapper that ensures ts-morph + tsx are installed locally, then runs the
# extractor for one or more apps. The skill should call this rather than
# invoking tsx directly.
#
# Usage:
#   ./run.sh dashboard
#   ./run.sh dashboard api
#   ./run.sh --repo /workspaces/classroomio dashboard api

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

REPO=""
APPS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --) shift; APPS+=("$@"); break ;;
    *)   APPS+=("$1"); shift ;;
  esac
done

if [[ -z "$REPO" ]]; then
  # Resolve repo root from the skill location: .claude/skills/c4-model/scripts -> repo
  REPO="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
fi

if [[ ${#APPS[@]} -eq 0 ]]; then
  APPS=(dashboard api)
fi

if [[ ! -d node_modules ]]; then
  echo "[c4-model] installing extractor deps (ts-morph + tsx) into $SCRIPT_DIR ..." >&2
  pnpm install --ignore-workspace --silent
fi

for app in "${APPS[@]}"; do
  ./node_modules/.bin/tsx extract.ts --app "$app" --repo "$REPO"
done
