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
import os

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

# Find .git directory by walking up from cwd
def find_git_dir():
    d = os.getcwd()
    while True:
        git_path = os.path.join(d, ".git")
        if os.path.isdir(git_path):
            return git_path
        if os.path.isfile(git_path):
            # worktree: .git file contains "gitdir: <path>"
            with open(git_path) as f:
                line = f.read().strip()
            if line.startswith("gitdir:"):
                return line[7:].strip()
        parent = os.path.dirname(d)
        if parent == d:
            return None
        d = parent

GIT_DIR = find_git_dir()

# Read git branch from HEAD file (no subprocess, no lock)
def get_git_branch():
    if not GIT_DIR:
        return None
    try:
        head_file = os.path.join(GIT_DIR, "HEAD")
        with open(head_file) as f:
            head = f.read().strip()
        if head.startswith("ref: refs/heads/"):
            return head[16:]
        return head[:8]  # detached HEAD, show short sha
    except:
        return None

# Read ref sha from packed-refs or loose ref file
def read_ref(ref_name):
    if not GIT_DIR:
        return None
    try:
        # Try loose ref first
        ref_path = os.path.join(GIT_DIR, ref_name)
        if os.path.isfile(ref_path):
            with open(ref_path) as f:
                return f.read().strip()
        # Fall back to packed-refs
        packed = os.path.join(GIT_DIR, "packed-refs")
        if os.path.isfile(packed):
            with open(packed) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("#") or not line:
                        continue
                    parts = line.split()
                    if len(parts) >= 2 and parts[1] == ref_name:
                        return parts[0]
    except:
        pass
    return None

# Count commits between two refs by walking parent chain (read-only)
def count_commits_between(from_sha, to_sha):
    """Count commits reachable from to_sha but not from from_sha (simple linear walk)."""
    if not GIT_DIR or not from_sha or not to_sha or from_sha == to_sha:
        return 0
    try:
        import subprocess
        # git rev-list is read-only and doesn't acquire index lock
        result = subprocess.run(
            ["git", "--no-optional-locks", "rev-list", "--count", f"{from_sha}..{to_sha}"],
            capture_output=True, text=True, timeout=2,
            env={**os.environ, "GIT_INDEX_FILE": ""}
        )
        if result.returncode == 0:
            return int(result.stdout.strip())
    except:
        pass
    return 0

# Check for local changes (uncommitted + unpushed)
def get_git_changes():
    try:
        branch_name = get_git_branch()
        if not branch_name or not GIT_DIR:
            return 0, 0, 0, 0

        head_sha = read_ref("HEAD")
        if not head_sha:
            # resolve HEAD -> ref -> sha
            head_file = os.path.join(GIT_DIR, "HEAD")
            with open(head_file) as f:
                head = f.read().strip()
            if head.startswith("ref: "):
                head_sha = read_ref(head[5:])

        remote_sha = read_ref(f"refs/remotes/origin/{branch_name}")

        # Unpushed/behind counts
        unpushed = count_commits_between(remote_sha, head_sha) if remote_sha and head_sha else 0
        behind_remote = count_commits_between(head_sha, remote_sha) if remote_sha and head_sha else 0

        # Dirty working tree - use --no-optional-locks to avoid index.lock
        import subprocess
        dirty = subprocess.run(
            ["git", "--no-optional-locks", "status", "--porcelain"],
            capture_output=True, text=True, timeout=2
        )
        dirty_count = len([l for l in dirty.stdout.strip().splitlines() if l]) if dirty.returncode == 0 else 0

        # Behind dev
        behind_dev = 0
        if branch_name != "dev":
            dev_sha = read_ref("refs/remotes/origin/dev")
            if dev_sha and head_sha:
                behind_dev = count_commits_between(head_sha, dev_sha)

        return unpushed, dirty_count, behind_dev, behind_remote
    except:
        return 0, 0, 0, 0

# Get project directory name from git root
def get_project_dir(workspace_data):
    try:
        cwd = os.getcwd()
        if GIT_DIR:
            # GIT_DIR is <root>/.git, so parent is the repo root
            if GIT_DIR.endswith(".git") or GIT_DIR.endswith(".git/"):
                git_root = os.path.normpath(os.path.dirname(GIT_DIR))
            else:
                git_root = os.path.normpath(GIT_DIR)
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
