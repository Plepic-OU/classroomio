#!/usr/bin/env python3
import sys, json, re, os
from datetime import datetime, timezone

data = sys.stdin.buffer.read()
text = data.decode('utf-8', errors='replace')

tool_match = re.search(r'"tool_name":"([^"]+)"', text)
tool = tool_match.group(1) if tool_match else 'unknown'

try:
    obj = json.loads(text)
except json.JSONDecodeError:
    # Literal newlines/tabs inside string values make the payload invalid JSON.
    # Escape any bare control characters that appear inside quoted strings.
    sanitized = re.sub(
        r'"((?:[^"\\]|\\.)*)"',
        lambda m: '"' + re.sub(r'[\x00-\x1f]', lambda c: '\\n' if c.group() == '\n' else '\\r' if c.group() == '\r' else '\\t' if c.group() == '\t' else '', m.group(1)) + '"',
        text,
        flags=re.DOTALL,
    )
    try:
        obj = json.loads(sanitized)
    except json.JSONDecodeError:
        obj = {}

entry = {
    'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'tool': tool,
    'input': obj.get('tool_input'),
    'output': obj.get('tool_response'),
}

os.makedirs('.claude/tool-calls', exist_ok=True)
with open(f'.claude/tool-calls/{tool}.json', 'w', encoding='utf-8') as f:
    json.dump(entry, f, indent=2, ensure_ascii=False)
