#!/usr/bin/env bash
# extract-database.sh — Extracts schema from the local Supabase PostgreSQL container.
#
# Output: docs/c4/database.md (only written when schema has changed)
# Requires: docker + supabase start
#
# Run from workspace root:
#   bash .claude/skills/c4-model/extract-database.sh

set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
OUTPUT_DIR="$WORKSPACE_ROOT/docs/c4"
OUTPUT="$OUTPUT_DIR/database.md"
TMP_OUTPUT="$OUTPUT_DIR/.database.md.tmp"

mkdir -p "$OUTPUT_DIR"

# Locate the supabase db container (name varies by supabase-cli version)
CONTAINER=$(docker ps --format '{{.Names}}' 2>/dev/null \
  | grep -E 'supabase_db_|supabase-db' \
  | head -1 || true)

if [ -z "$CONTAINER" ]; then
  echo "Error: Supabase DB container not found." >&2
  echo "Run 'supabase start' first, then retry." >&2
  exit 1
fi

echo "Using container: $CONTAINER"

# Dump columns
docker exec "$CONTAINER" psql -U postgres -d postgres \
  --no-align --tuples-only --field-separator='|' -c "
SELECT t.table_name,
       c.column_name,
       c.data_type,
       CASE WHEN c.is_nullable = 'NO' THEN 'NOT NULL' ELSE '' END AS nullable,
       COALESCE(c.column_default, '') AS col_default
FROM information_schema.tables t
JOIN information_schema.columns c
  ON c.table_schema = t.table_schema AND c.table_name = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;
" > /tmp/c4_columns.txt

# Dump foreign keys
docker exec "$CONTAINER" psql -U postgres -d postgres \
  --no-align --tuples-only --field-separator='|' -c "
SELECT tc.table_name,
       kcu.column_name,
       ccu.table_name  AS foreign_table,
       ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
" > /tmp/c4_fkeys.txt

# Dump enums (token-efficient)
docker exec "$CONTAINER" psql -U postgres -d postgres \
  --no-align --tuples-only --field-separator='|' -c "
SELECT t.typname, e.enumlabel
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;
" > /tmp/c4_enums.txt

# Generate markdown into a temp file, then compare with existing
python3 - "$TMP_OUTPUT" "$OUTPUT" <<'PYEOF'
import sys
import os
import re
from collections import defaultdict

tmp_path   = sys.argv[1]
out_path   = sys.argv[2]

def parse_psql(path):
    rows = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(line.split('|'))
    return rows

cols_rows  = parse_psql('/tmp/c4_columns.txt')
fkeys_rows = parse_psql('/tmp/c4_fkeys.txt')
enums_rows = parse_psql('/tmp/c4_enums.txt')

# Build table → columns list
tables = defaultdict(list)
for row in cols_rows:
    if len(row) < 3:
        continue
    table, col, dtype = row[0], row[1], row[2]
    nullable = row[3].strip() if len(row) > 3 else ''
    default  = row[4].strip() if len(row) > 4 else ''
    tables[table].append((col, dtype, nullable, default))

# Build FK map: (table, column) → (foreign_table, foreign_column)
fk_map = {}
for row in fkeys_rows:
    if len(row) < 4:
        continue
    fk_map[(row[0], row[1])] = (row[2], row[3])

# Build enum map
enums = defaultdict(list)
for row in enums_rows:
    if len(row) >= 2:
        enums[row[0]].append(row[1])

lines = [
    '# Database Schema — ClassroomIO (Supabase PostgreSQL)',
    '',
    'Token-efficient schema extract for AI context. Public schema only.',
    f'Tables: {len(tables)}',
    '',
]

if enums:
    lines.append('## Enums')
    lines.append('')
    for enum_name, values in sorted(enums.items()):
        lines.append(f'- **{enum_name}**: {", ".join(f"`{v}`" for v in values)}')
    lines.append('')

lines.append('## Tables')
lines.append('')

for table_name in sorted(tables.keys()):
    lines.append(f'### {table_name}')
    for col, dtype, nullable, default in tables[table_name]:
        parts = [f'- **{col}**', f'`{dtype}`']
        if nullable:
            parts.append(nullable)
        fk = fk_map.get((table_name, col))
        if fk:
            parts.append(f'→ `{fk[0]}.{fk[1]}`')
        # Only include non-trivial defaults (skip sequences)
        if default and not default.startswith('nextval') and len(default) < 80:
            parts.append(f'default:`{default}`')
        lines.append(' '.join(parts))
    lines.append('')

new_content = '\n'.join(lines)

# Write to temp file
with open(tmp_path, 'w') as f:
    f.write(new_content)

new_tables = set(tables.keys())

# Compare with existing output
if os.path.exists(out_path):
    with open(out_path) as f:
        old_content = f.read()

    if old_content == new_content:
        print(f'No changes — {len(tables)} tables, schema is up to date.')
        sys.exit(0)

    # Detect table additions/removals
    old_tables = set(re.findall(r'^### (\w+)', old_content, re.MULTILINE))
    added   = sorted(new_tables - old_tables)
    removed = sorted(old_tables - new_tables)

    # Copy temp to real output
    import shutil
    shutil.move(tmp_path, out_path)

    print(f'Updated — {len(new_tables)} tables.')
    if added:
        print(f'  + tables: {", ".join(added)}')
    if removed:
        print(f'  - tables: {", ".join(removed)}')
    if not added and not removed:
        print('  (column or type changes only)')
else:
    import shutil
    shutil.move(tmp_path, out_path)
    print(f'Wrote {len(tables)} tables to {out_path}')

PYEOF

# Clean up temp file if still present (means no-change path, Python exited 0 without moving)
rm -f "$TMP_OUTPUT"

echo "✓ $OUTPUT"
