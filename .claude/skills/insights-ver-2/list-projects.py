#!/usr/bin/env python3
"""List Claude Code projects with session counts, sorted by last activity.

Output: JSON array of objects with fields:
  - dir_name: raw directory name (e.g., "-Users-joosep-dev-foo")
  - label: human-readable short path (e.g., "dev/foo")
  - session_count: number of session JSONL files
  - last_active: ISO date string of most recent session modification
"""
import json
import os
import glob
import sys
from datetime import datetime


def decode_project_path(dir_name: str) -> str:
    """Convert encoded dir name to a human-readable short label.

    The encoding replaces / with -, which is lossy (original dashes become
    indistinguishable from path separators). We only decode the known-safe
    home directory prefix and leave the rest as-is with dashes preserved.
    """
    # Strip leading dash
    path = dir_name.lstrip("-")

    # Try to find home dir prefix and strip it
    home = os.path.expanduser("~").lstrip("/")  # e.g., "Users/joosep"
    home_encoded = home.replace("/", "-")  # e.g., "Users-joosep"

    if path == home_encoded:
        return "~ (home)"

    if path.startswith(home_encoded + "-"):
        remainder = path[len(home_encoded) + 1:]
        return "~/" + remainder

    return path


def main():
    config_dir = os.environ.get("CLAUDE_CONFIG_DIR", os.path.expanduser("~/.claude"))
    projects_dir = os.path.join(config_dir, "projects")

    if not os.path.isdir(projects_dir):
        print("[]")
        return

    projects = []
    for proj_dir in sorted(glob.glob(os.path.join(projects_dir, "*"))):
        if not os.path.isdir(proj_dir):
            continue
        proj_name = os.path.basename(proj_dir)
        jsonl_files = [
            f for f in glob.glob(os.path.join(proj_dir, "*.jsonl"))
            if os.sep + "subagents" + os.sep not in f
        ]
        if not jsonl_files:
            continue

        latest_mtime = max(os.path.getmtime(f) for f in jsonl_files)
        projects.append({
            "dir_name": proj_name,
            "label": decode_project_path(proj_name),
            "session_count": len(jsonl_files),
            "last_active": datetime.fromtimestamp(latest_mtime).strftime("%Y-%m-%d %H:%M"),
        })

    # Sort by last_active descending
    projects.sort(key=lambda x: x["last_active"], reverse=True)

    # Limit for display
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    projects = projects[:limit]

    print(json.dumps(projects, indent=2))


if __name__ == "__main__":
    main()
