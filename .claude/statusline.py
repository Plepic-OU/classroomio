#!/usr/bin/env python3
# Claude Code Status Line - Context Usage Monitor
#
# MANUAL SETUP REQUIRED:
# This script is NOT auto-executed. To enable it, add to your personal
# Claude Code settings (~/.claude/settings.json or via claude settings):
#
#   "statusLine": {
#     "type": "command",
#     "command": "python3 C:\\<project-location>\\.claude\\statusline.py"
#   }
#
# (Replace the path with your actual Palk directory)
# Review this script's contents before enabling.

import sys
import json
import subprocess

# Fix encoding on Windows
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

try:
    data = json.load(sys.stdin)
except:
    print("Context: --")
    sys.exit(0)

# Extract data
model = data.get("model", {}).get("display_name", "Claude")
version = data.get("version", "")
ctx = data.get("context_window", {})
percent = int(ctx.get("used_percentage") or 0)
input_tokens = ctx.get("total_input_tokens", 0)
output_tokens = ctx.get("total_output_tokens", 0)

# Format token counts
def fmt(n):
    return f"{n // 1000}k" if n >= 1000 else str(n)

# Get git branch
def get_git_branch():
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            timeout=2
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except:
        return None

# Check for local changes (uncommitted + unpushed)
def get_git_changes():
    try:
        branch = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=2
        )
        branch_name = branch.stdout.strip() if branch.returncode == 0 else None

        # Unpushed commits (ahead of own remote tracking branch)
        unpushed = 0
        # Behind own remote tracking branch (e.g. after git reset --hard)
        behind_remote = 0
        if branch_name:
            result = subprocess.run(
                ["git", "rev-list", "--count", f"origin/{branch_name}..HEAD"],
                capture_output=True, text=True, timeout=2
            )
            if result.returncode == 0:
                unpushed = int(result.stdout.strip())
            result = subprocess.run(
                ["git", "rev-list", "--count", f"HEAD..origin/{branch_name}"],
                capture_output=True, text=True, timeout=2
            )
            if result.returncode == 0:
                behind_remote = int(result.stdout.strip())

        # Dirty working tree (uncommitted changes)
        dirty = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True, timeout=2
        )
        dirty_count = len([l for l in dirty.stdout.strip().splitlines() if l]) if dirty.returncode == 0 else 0

        # Commits on dev that are not on current branch (only for non-dev branches,
        # and only the portion not already counted in behind_remote)
        behind_dev = 0
        if branch_name and branch_name != "dev":
            result = subprocess.run(
                ["git", "rev-list", "--count", f"HEAD..origin/dev"],
                capture_output=True, text=True, timeout=2
            )
            if result.returncode == 0:
                behind_dev = int(result.stdout.strip())

        return unpushed, dirty_count, behind_dev, behind_remote
    except:
        return 0, 0, 0, 0

# Get project directory name from git root
def get_project_dir(workspace_data):
    try:
        import os
        cwd = os.getcwd()
        # Use git root so subdirectories show as "Palk/client-app" not just "client-app"
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, timeout=2
        )
        if result.returncode == 0:
            git_root = os.path.normpath(result.stdout.strip())
            git_parent = os.path.dirname(git_root)
            return os.path.relpath(cwd, git_parent).replace(os.sep, "/")
        # Fallback: workspace data
        project_dir = workspace_data.get("project_dir", "")
        if project_dir:
            parent = os.path.dirname(project_dir)
            return os.path.relpath(cwd, parent)
        return os.path.basename(cwd)
    except:
        return None


# Color based on usage level
if percent < 50:
    color = "\033[32m"  # Green
elif percent < 70:
    color = "\033[33m"  # Yellow
elif percent < 85:
    color = "\033[38;5;208m"  # Orange
else:
    color = "\033[31m"  # Red
reset = "\033[0m"

# Build progress bar
bar_width = 10
filled = percent * bar_width // 100
bar = "█" * filled + "░" * (bar_width - filled)

# Get git info
branch = get_git_branch()
unpushed, dirty, behind_dev, behind_remote = get_git_changes()
project = get_project_dir(data.get("workspace", {}))

# Build status string parts
parts = []
parts.append(f"{color}{bar}{reset} {percent}%")
parts.append(f"in:{fmt(input_tokens)} out:{fmt(output_tokens)}")

if project:
    parts.append(project)

if branch:
    branch_info = branch
    # Indicators:
    #   yellow  ~N  = N uncommitted files in working tree
    #   cyan    +N  = N commits ahead of own remote (unpushed)
    #   red     -N  = N commits behind own remote (e.g. after git reset --hard)
    #   magenta devN = N commits behind origin/dev (non-dev branches only)
    indicators = []
    if dirty:
        indicators.append(f"\033[33m~{dirty}\033[0m")
    if unpushed > 0:
        indicators.append(f"\033[36m+{unpushed}\033[0m")
    if behind_remote > 0:
        indicators.append(f"\033[31m-{behind_remote}\033[0m")
    if behind_dev > 0:
        indicators.append(f"\033[35mdev-{behind_dev}\033[0m")
    if indicators:
        branch_info += " " + " ".join(indicators)
    parts.append(branch_info)

parts.append(model)

if version:
    parts.append(f"v{version}")

# Output
print(" | ".join(parts))
