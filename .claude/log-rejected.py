#!/usr/bin/env python3
import json, os, sys
from datetime import datetime

data = json.load(sys.stdin)
raw = json.dumps(data)

BLOCKED_PATTERNS = ["github" + "-token"]

if not any(p in raw for p in BLOCKED_PATTERNS):
    sys.exit(0)

tool_name = data.get("tool_name", "unknown")
log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rejected-logs")
os.makedirs(log_dir, exist_ok=True)

timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
filename = os.path.join(log_dir, f"{timestamp}_{tool_name}.json")

with open(filename, "w") as f:
    json.dump(data, f, indent=2)

sys.exit(2)
