#!/usr/bin/env bash
# Database schema extractor for ClassroomIO local Supabase instance.
# Queries information_schema + pg_catalog via docker exec and writes docs/c4/database.md.
# Requires: supabase start (Docker must be running).
#
# Usage (from repo root):
#   bash .claude/skills/c4-model/db-extract.sh
set -euo pipefail

# ---------------------------------------------------------------------------
# Find the Supabase postgres container
# ---------------------------------------------------------------------------

CONTAINER=$(docker ps --filter "name=supabase_db" --format "{{.Names}}" 2>/dev/null | head -1)

if [[ -z "$CONTAINER" ]]; then
  echo "ERROR: No running container matching 'supabase_db' found." >&2
  echo "       Run 'supabase start' first, then retry." >&2
  exit 1
fi

echo "Using container: $CONTAINER"
mkdir -p docs/c4
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# ---------------------------------------------------------------------------
# Query 1: All columns in public schema (with types and nullability)
# ---------------------------------------------------------------------------

docker exec "$CONTAINER" psql -U postgres -d postgres -At -c "
SELECT json_agg(
  json_build_object(
    'table',  c.table_name,
    'col',    c.column_name,
    'type',   c.data_type,
    'nn',     (c.is_nullable = 'NO')
  )
  ORDER BY c.table_name, c.ordinal_position
)
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE c.table_schema = 'public'
  AND t.table_type  = 'BASE TABLE'
" > "$TMP/cols.json"

# ---------------------------------------------------------------------------
# Query 2: Foreign key relationships
# ---------------------------------------------------------------------------

docker exec "$CONTAINER" psql -U postgres -d postgres -At -c "
SELECT json_agg(
  json_build_object(
    'ft', kcu.table_name,
    'fc', kcu.column_name,
    'tt', ccu.table_name,
    'tc', ccu.column_name
  )
)
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema    = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema    = 'public'
" > "$TMP/fks.json"

# ---------------------------------------------------------------------------
# Format as compact Markdown via Python
# ---------------------------------------------------------------------------

python3 - "$TMP/cols.json" "$TMP/fks.json" << 'PYEOF' > docs/c4/database.md
import json, sys, pathlib, datetime

cols_raw = pathlib.Path(sys.argv[1]).read_text().strip()
fks_raw  = pathlib.Path(sys.argv[2]).read_text().strip()

cols = json.loads(cols_raw) if cols_raw and cols_raw != '' else []
fks  = json.loads(fks_raw)  if fks_raw  and fks_raw  != '' else []

# Build FK lookup: "table.col" -> "ref_table.ref_col"
fk_map = {}
for r in (fks or []):
    fk_map[f"{r['ft']}.{r['fc']}"] = f"{r['tt']}.{r['tc']}"

# Group columns by table
tables: dict = {}
for c in (cols or []):
    tables.setdefault(c['table'], []).append(c)

out = [
    '# Database Schema',
    '',
    f'> Auto-generated {datetime.date.today()}. Source: public schema. Requires `supabase start`.',
    '',
    f'**Tables:** {len(tables)}',
    '',
]

for tbl in sorted(tables):
    out.append(f'## {tbl}')
    for c in tables[tbl]:
        fk  = fk_map.get(f"{tbl}.{c['col']}", '')
        nn  = '  `NOT NULL`' if c['nn'] else ''
        fkl = f'  → `{fk}`'  if fk  else ''
        out.append(f"- `{c['col']}` {c['type']}{nn}{fkl}")
    out.append('')

print('\n'.join(out))
PYEOF

echo "Wrote docs/c4/database.md"
