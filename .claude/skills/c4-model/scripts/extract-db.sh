#!/usr/bin/env bash
# Extracts the Supabase Postgres schema into a token-efficient markdown summary.
# Reads from the local Supabase container via `docker exec`, querying
# information_schema + pg_catalog. Does NOT dump full DDL — just:
#   - table name
#   - columns (name : type [nullable] [default])
#   - primary key
#   - foreign keys (col -> ref_table.ref_col)
#
# Requires:
#   - docker
#   - `supabase start` running locally (container name supabase_db_<project>)
#
# Usage:
#   ./extract-db.sh [--out docs/c4/database.md] [--repo /workspaces/classroomio]
#                   [--schema public]
#
# Writes the markdown to <out>; prints the path on stdout.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REPO=""
OUT=""
SCHEMA="public"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)   REPO="$2"; shift 2 ;;
    --out)    OUT="$2"; shift 2 ;;
    --schema) SCHEMA="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$REPO" ]]; then
  REPO="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
fi
if [[ -z "$OUT" ]]; then
  OUT="$REPO/docs/c4/database.md"
fi

# Locate Supabase DB container. The CLI uses names like supabase_db_<project>.
DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_' | head -n1 || true)"
if [[ -z "$DB_CONTAINER" ]]; then
  cat >&2 <<EOF
[c4-model] No running Supabase DB container found.
          Start the local stack with: supabase start
          (from the repo root, with Docker running)
EOF
  exit 1
fi

# Build a single PSQL query that emits the schema in our compact format.
# Output rows look like:
#   TBL|<table>
#   COL|<table>|<col>|<type>|<nullable>|<default>
#   PK|<table>|<col>
#   FK|<table>|<col>|<ref_table>|<ref_col>
read -r -d '' SQL <<EOF || true
\\set ON_ERROR_STOP on
SELECT 'TBL|' || table_name AS line
FROM information_schema.tables
WHERE table_schema = '${SCHEMA}'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT 'COL|' || c.table_name || '|' || c.column_name || '|'
       || c.data_type
       || COALESCE('(' || c.character_maximum_length || ')', '')
       || '|' || c.is_nullable
       || '|' || COALESCE(c.column_default, '') AS line
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE c.table_schema = '${SCHEMA}' AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name, c.ordinal_position;

SELECT 'PK|' || tc.table_name || '|' || kcu.column_name AS line
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = '${SCHEMA}' AND tc.constraint_type = 'PRIMARY KEY'
ORDER BY tc.table_name, kcu.ordinal_position;

SELECT 'FK|' || tc.table_name || '|' || kcu.column_name || '|'
       || ccu.table_name || '|' || ccu.column_name AS line
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = '${SCHEMA}' AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;
EOF

RAW="$(docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -At -F '' -v ON_ERROR_STOP=1 -c "$SQL")"

mkdir -p "$(dirname "$OUT")"

# Render into markdown
{
  echo "# Database schema — \`${SCHEMA}\`"
  echo
  echo "_Generated from the running Supabase container (\`${DB_CONTAINER}\`)._"
  echo "_Format: \`col : type [nullable] [default]\`. \`PK\` marks primary keys; \`→ table.col\` marks foreign keys._"
  echo

  # Group lines by table
  python3 - "$RAW" <<'PY'
import sys, collections
raw = sys.argv[1]
tables = collections.OrderedDict()
cols = collections.defaultdict(list)
pks = collections.defaultdict(set)
fks = collections.defaultdict(dict)  # table -> col -> (reftable, refcol)

for line in raw.splitlines():
    if not line or '|' not in line:
        continue
    kind, *rest = line.split('|')
    if kind == 'TBL':
        tables[rest[0]] = True
    elif kind == 'COL':
        tbl, col, typ, nullable, default = rest
        cols[tbl].append((col, typ, nullable, default))
    elif kind == 'PK':
        tbl, col = rest
        pks[tbl].add(col)
    elif kind == 'FK':
        tbl, col, rtbl, rcol = rest
        fks[tbl][col] = (rtbl, rcol)

for tbl in tables:
    print(f"## `{tbl}`")
    print()
    for col, typ, nullable, default in cols[tbl]:
        flags = []
        if col in pks[tbl]:
            flags.append("PK")
        if col in fks[tbl]:
            rtbl, rcol = fks[tbl][col]
            flags.append(f"→ {rtbl}.{rcol}")
        if nullable == 'NO':
            flags.append("NOT NULL")
        if default:
            d = default
            if len(d) > 40:
                d = d[:37] + "..."
            flags.append(f"default `{d}`")
        flagstr = f"  ({', '.join(flags)})" if flags else ""
        print(f"- `{col}` : {typ}{flagstr}")
    print()
PY
} >"$OUT"

echo "$OUT"
