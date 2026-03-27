#!/usr/bin/env bash
# ---------------------------------------------------------------
# Launch a devcontainer for a git worktree with unique host ports.
#
# Usage:
#   ./scripts/launch-worktree-devcontainer.sh <branch> [worktree-dir]
#
# Examples:
#   ./scripts/launch-worktree-devcontainer.sh feature-x
#   ./scripts/launch-worktree-devcontainer.sh feature-x /tmp/wt-feature-x
#
# Each devcontainer gets its own Docker-in-Docker daemon, so ports
# inside the container never conflict. This script only remaps the
# HOST-side ports so multiple containers can coexist on the host.
#
# Prerequisites:
#   sudo npm i -g @devcontainers/cli
# ---------------------------------------------------------------
set -euo pipefail

# --- Port definitions (container-side, never change) -----------
#          Dashboard  Website  Docs   API   Playwright  SB-API  SB-DB  SB-Studio  SB-Inbucket
PORTS=(     5173      5174     3000   3002  9323        54321   54322  54323      54324       )
LABELS=(   "Dashboard" "Website" "Docs" "API" "Playwright" "Supabase API" "Supabase DB" "Supabase Studio" "Supabase Inbucket")

# --- Helpers ---------------------------------------------------

die()  { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*"; }

# File to track ports claimed during this run (subshells lose
# associative array state, so we use a temp file instead).
CLAIMED_FILE=$(mktemp)
trap "rm -f $CLAIMED_FILE" EXIT

# Check if a TCP port is free on the host AND not already claimed
port_is_free() {
  grep -qx "$1" "$CLAIMED_FILE" 2>/dev/null && return 1
  ! ss -tlnH "sport = :$1" 2>/dev/null | grep -q .
}

# Find the nearest free port starting from $1, mark it as claimed
find_free_port() {
  local port=$1
  local max=$((port + 200))
  while ! port_is_free "$port"; do
    port=$((port + 1))
    if (( port > max )); then
      die "Could not find a free port near $1 (searched up to $max)"
    fi
  done
  echo "$port" >> "$CLAIMED_FILE"
  echo "$port"
}

# --- Argument parsing ------------------------------------------

BRANCH="${1:-}"
if [ -z "$BRANCH" ]; then
  echo "Usage: $0 <branch> [worktree-dir]"
  echo ""
  echo "Creates (or reuses) a git worktree and launches a devcontainer"
  echo "with dynamically assigned host ports."
  exit 1
fi

WORKTREE_DIR="${2:-/tmp/worktree-$BRANCH}"

# --- Ensure devcontainer CLI is available ----------------------

if ! command -v devcontainer &>/dev/null; then
  die "devcontainer CLI not found. Install with: sudo npm i -g @devcontainers/cli"
fi

# --- Create worktree if needed ---------------------------------

if [ ! -d "$WORKTREE_DIR" ]; then
  info "Creating git worktree at $WORKTREE_DIR for branch '$BRANCH'..."
  # Try to check out existing branch, or create a new one
  git worktree add "$WORKTREE_DIR" "$BRANCH" 2>/dev/null \
    || git worktree add -b "$BRANCH" "$WORKTREE_DIR" \
    || die "Failed to create worktree for branch '$BRANCH'"
else
  info "Worktree already exists at $WORKTREE_DIR"
fi

# --- Find free host ports --------------------------------------

info "Scanning for available host ports..."
declare -a HOST_PORTS=()
for container_port in "${PORTS[@]}"; do
  host_port=$(find_free_port "$container_port")
  HOST_PORTS+=("$host_port")
done

# --- Build JSON fragments --------------------------------------

# appPort: ["hostPort:containerPort", ...]
APP_PORT_JSON="["
for i in "${!PORTS[@]}"; do
  if (( i > 0 )); then APP_PORT_JSON+=","; fi
  APP_PORT_JSON+="\"${HOST_PORTS[$i]}:${PORTS[$i]}\""
done
APP_PORT_JSON+="]"

# forwardPorts: [hostPort, ...]
FWD_PORTS="["
for i in "${!HOST_PORTS[@]}"; do
  if (( i > 0 )); then FWD_PORTS+=","; fi
  FWD_PORTS+="${HOST_PORTS[$i]}"
done
FWD_PORTS+="]"

# portsAttributes: {"hostPort": {"label": "..."}, ...}
PORTS_ATTR="{"
for i in "${!PORTS[@]}"; do
  if (( i > 0 )); then PORTS_ATTR+=","; fi
  PORTS_ATTR+="\"${HOST_PORTS[$i]}\":{\"label\":\"${LABELS[$i]}\"}"
done
PORTS_ATTR+="}"

# Unique volume suffix per branch
VOLUME_SUFFIX=$(echo "$BRANCH" | tr '/' '-' | tr '[:upper:]' '[:lower:]')

# --- Read base config and merge --------------------------------
# devcontainer up --override-config still requires "build" in the
# base config. To avoid issues we write a single merged config that
# includes the Dockerfile reference plus our port overrides.

CONFIG_FILE="$WORKTREE_DIR/.devcontainer/devcontainer.json"
BACKUP_FILE="$WORKTREE_DIR/.devcontainer/devcontainer.original.json"

# Back up the original config (only on first run for this worktree)
if [ ! -f "$BACKUP_FILE" ]; then
  cp "$CONFIG_FILE" "$BACKUP_FILE"
fi

# Merge base config + our overrides → devcontainer.json
node -e "
const fs = require('fs');
const base = JSON.parse(fs.readFileSync('$BACKUP_FILE', 'utf8'));
const overrides = {
  name: 'ClassroomIO ($BRANCH)',
  appPort: $APP_PORT_JSON,
  forwardPorts: $FWD_PORTS,
  portsAttributes: $PORTS_ATTR,
  mounts: [
    'source=classroomio-pnpm-store-${VOLUME_SUFFIX},target=/home/node/.local/share/pnpm/store,type=volume',
    'source=classroomio-claude-config-${VOLUME_SUFFIX},target=/home/node/.claude,type=volume'
  ]
};
const merged = { ...base, ...overrides };
fs.writeFileSync('$CONFIG_FILE', JSON.stringify(merged, null, 2));
"

info "Merged config written to $CONFIG_FILE"

# --- Launch the devcontainer -----------------------------------

info "Launching devcontainer for worktree '$BRANCH'..."
devcontainer up \
  --workspace-folder "$WORKTREE_DIR"

# --- Print the port map ----------------------------------------

echo ""
echo "============================================"
echo "  Devcontainer '$BRANCH' is running!"
echo "============================================"
echo ""
printf "  %-20s %-12s %s\n" "Service" "Host Port" "Container Port"
printf "  %-20s %-12s %s\n" "-------" "---------" "--------------"
for i in "${!PORTS[@]}"; do
  if [ "${HOST_PORTS[$i]}" = "${PORTS[$i]}" ]; then
    marker=""
  else
    marker=" (remapped)"
  fi
  printf "  %-20s %-12s %s%s\n" "${LABELS[$i]}" "${HOST_PORTS[$i]}" "${PORTS[$i]}" "$marker"
done
echo ""
echo "  Worktree: $WORKTREE_DIR"
echo "  Dashboard: http://localhost:${HOST_PORTS[0]}"
echo ""
echo "  To open in VS Code:"
echo "    code $WORKTREE_DIR"
echo ""
echo "  To stop:"
echo "    devcontainer down --workspace-folder $WORKTREE_DIR"
echo "    git worktree remove $WORKTREE_DIR"
echo "============================================"
