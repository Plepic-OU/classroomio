#!/usr/bin/env bash
# Extracts a token-efficient schema summary (tables, columns, PK/FK) from the
# running local Supabase Postgres instance into docs/c4/database.md.
#
# Not full DDL — just enough for C4/AI context: column name, type, PK/FK/nullability.
# Requires `supabase start` to already be running.
#
# Usage: extract-database.sh [output-path]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
OUT="${1:-$REPO_ROOT/docs/c4/database.md}"

CONTAINER="$(docker ps --format '{{.Names}}' | grep -m1 '^supabase_db_' || true)"
if [ -z "$CONTAINER" ]; then
  echo "No running Supabase Postgres container found (expected name matching supabase_db_*)." >&2
  echo "Run 'supabase start' first." >&2
  exit 1
fi

for bin in jq docker; do
  command -v "$bin" >/dev/null 2>&1 || { echo "Missing required tool: $bin" >&2; exit 1; }
done

# One query, per-table columns as a nested jsonb array, so the whole schema comes
# back in a single round trip and we do all formatting in jq (no N+1 docker execs).
SQL=$(cat <<'SQL'
SELECT jsonb_agg(t ORDER BY t->>'table')
FROM (
  SELECT jsonb_build_object(
    'table', c.table_name,
    'columns', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', col.column_name,
          'type', col.udt_name,
          'nullable', col.is_nullable = 'YES',
          'pk', EXISTS (
            SELECT 1
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON kcu.constraint_name = tc.constraint_name
             AND kcu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = c.table_schema
              AND tc.table_name = c.table_name
              AND kcu.column_name = col.column_name
          ),
          'fk', (
            SELECT jsonb_build_object('table', ccu.table_name, 'column', ccu.column_name)
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON kcu.constraint_name = tc.constraint_name
             AND kcu.table_schema = tc.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
             AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = c.table_schema
              AND tc.table_name = c.table_name
              AND kcu.column_name = col.column_name
            LIMIT 1
          )
        )
        ORDER BY col.ordinal_position
      )
      FROM information_schema.columns col
      WHERE col.table_schema = c.table_schema AND col.table_name = c.table_name
    )
  ) AS t
  FROM information_schema.tables c
  WHERE c.table_schema = 'public' AND c.table_type = 'BASE TABLE'
) x;
SQL
)

RAW_JSON="$(docker exec -i "$CONTAINER" psql -U postgres -d postgres -t -A -c "$SQL")"

if [ -z "$RAW_JSON" ] || [ "$RAW_JSON" = "null" ]; then
  echo "Query returned no tables in schema 'public' — is the local DB migrated/seeded?" >&2
  exit 1
fi

TABLE_COUNT="$(echo "$RAW_JSON" | jq 'length')"
GENERATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

{
  echo "# Database Schema (public)"
  echo
  echo "Extracted from the local Supabase Postgres instance (\`information_schema\`), container \`$CONTAINER\`."
  echo "Not full DDL — name, type, PK/FK/nullability only. Regenerate: \`.claude/skills/c4-model/scripts/extract-database.sh\` (requires \`supabase start\`)."
  echo
  echo "Generated: $GENERATED_AT · tables: $TABLE_COUNT"
  echo
  echo "$RAW_JSON" | jq -r '
    .[] |
    "### \(.table)\n" +
    ( [ .columns[] |
        "- " + .name + " (" + .type + ")"
        + (if .pk then " PK" else "" end)
        + (if .fk then " → " + .fk.table + "." + .fk.column else "" end)
        + (if .nullable then "" else " NOT NULL" end)
      ] | join("\n")
    ) + "\n"
  '
} > "$OUT"

echo "wrote $(realpath --relative-to="$REPO_ROOT" "$OUT" 2>/dev/null || echo "$OUT") ($TABLE_COUNT tables)"
