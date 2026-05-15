#!/usr/bin/env python3
import json, os, sys

data = json.load(sys.stdin)
tool_name = data.get('tool_name', 'unknown')
tool_input = data.get('tool_input', {})

log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tool-logs')
os.makedirs(log_dir, exist_ok=True)

with open(os.path.join(log_dir, f'{tool_name}.json'), 'w') as f:
    json.dump(tool_input, f, indent=2)
