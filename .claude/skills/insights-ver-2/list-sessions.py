#!/usr/bin/env python3
"""List sessions for a given Claude Code project directory.

Usage: python3 list-sessions.py <project_dir_name> [limit]

Output: JSON array of objects with fields:
  - session_id: UUID of the session
  - message_count: total messages in the session
  - last_modified: human-readable date string
  - first_user_message: first user message text (truncated)
  - duration_minutes: approximate session duration
"""
import json
import os
import glob
import sys
from datetime import datetime


def extract_first_user_message(filepath: str) -> str:
    """Extract the first meaningful user message from a session JSONL."""
    with open(filepath, "r") as fh:
        for line in fh:
            try:
                msg = json.loads(line.strip())
            except (json.JSONDecodeError, ValueError):
                continue
            if msg.get("type") != "user":
                continue
            content = msg.get("message", {}).get("content", "")
            if isinstance(content, str):
                text = content.strip()
            elif isinstance(content, list):
                text = ""
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        t = block.get("text", "")
                        if not t.startswith("<system-reminder>"):
                            text = t.strip()
                            break
            else:
                continue
            if text and not text.startswith("<"):
                # Clean up: collapse whitespace, truncate
                text = " ".join(text.split())
                return text[:120]
    return "(no user message)"


def get_session_duration(filepath: str) -> float:
    """Get approximate duration in minutes from first to last timestamp."""
    first_ts = None
    last_ts = None
    with open(filepath, "r") as fh:
        for line in fh:
            try:
                msg = json.loads(line.strip())
            except (json.JSONDecodeError, ValueError):
                continue
            ts = msg.get("timestamp")
            if not ts:
                continue
            if first_ts is None:
                first_ts = ts
            last_ts = ts

    if not first_ts or not last_ts:
        return 0.0

    try:
        t0 = datetime.fromisoformat(first_ts.replace("Z", "+00:00"))
        t1 = datetime.fromisoformat(last_ts.replace("Z", "+00:00"))
        return max(0, (t1 - t0).total_seconds() / 60)
    except (ValueError, TypeError):
        return 0.0


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 list-sessions.py <project_dir_name> [limit]", file=sys.stderr)
        sys.exit(1)

    project_dir_name = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 20

    config_dir = os.environ.get("CLAUDE_CONFIG_DIR", os.path.expanduser("~/.claude"))
    proj_dir = os.path.join(config_dir, "projects", project_dir_name)

    if not os.path.isdir(proj_dir):
        print(f"Project directory not found: {proj_dir}", file=sys.stderr)
        print("[]")
        return

    jsonl_files = [
        f for f in glob.glob(os.path.join(proj_dir, "*.jsonl"))
        if os.sep + "subagents" + os.sep not in f
    ]

    # Sort by modification time, newest first
    jsonl_files.sort(key=os.path.getmtime, reverse=True)

    sessions = []
    for filepath in jsonl_files[:limit]:
        try:
            # Count messages
            msg_count = 0
            with open(filepath, "r") as fh:
                for line in fh:
                    if line.strip():
                        msg_count += 1

            mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
            sid = os.path.basename(filepath).replace(".jsonl", "")
            first_msg = extract_first_user_message(filepath)
            duration = round(get_session_duration(filepath), 1)

            sessions.append({
                "session_id": sid,
                "message_count": msg_count,
                "last_modified": mtime.strftime("%Y-%m-%d %H:%M"),
                "first_user_message": first_msg,
                "duration_minutes": duration,
            })
        except Exception:
            continue

    print(json.dumps(sessions, indent=2))


if __name__ == "__main__":
    main()
