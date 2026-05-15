#!/usr/bin/env bash
# Extracts database schema from the local Supabase PostgreSQL into docs/c4/database.md.
# Requires: supabase start (container supabase_db_classroomio must be running)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
OUTPUT="$REPO_ROOT/docs/c4/database.md"
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_classroomio}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-postgres}"

if ! docker ps --filter "name=^/${CONTAINER}$" --format '{{.Names}}' 2>/dev/null | grep -q .; then
  echo "Error: container '${CONTAINER}' is not running."
  echo "Run 'supabase start' first, or set SUPABASE_DB_CONTAINER to the correct name."
  exit 1
fi

q() { docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -F$'\t' -c "$1" 2>/dev/null; }

mkdir -p "$(dirname "$OUTPUT")"

{
  echo "# ClassroomIO Database Schema"
  echo ""
  echo "_Extracted from local Supabase on $(date -u +%Y-%m-%d)_"
  echo ""

  # ── Tables ──────────────────────────────────────────────────────────────
  echo "## Tables"
  echo ""

  TABLES=$(q "SELECT table_name FROM information_schema.tables
              WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
              ORDER BY table_name;")

  while IFS=$'\t' read -r tbl; do
    [[ -z "$tbl" ]] && continue
    echo "### \`$tbl\`"
    echo ""
    echo "| column | type | null | default |"
    echo "|--------|------|------|---------|"

    q "SELECT column_name,
              data_type,
              is_nullable,
              COALESCE(column_default, '')
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = '$tbl'
       ORDER BY ordinal_position;" \
    | while IFS=$'\t' read -r col dtype nullable dflt; do
        # Shorten verbose type names
        dtype="${dtype/character varying/varchar}"
        dtype="${dtype/timestamp with time zone/timestamptz}"
        dtype="${dtype/timestamp without time zone/timestamp}"
        dtype="${dtype/double precision/float8}"
        # Truncate long defaults
        if [[ ${#dflt} -gt 45 ]]; then dflt="${dflt:0:42}..."; fi
        echo "| \`$col\` | \`$dtype\` | $nullable | \`$dflt\` |"
      done

    echo ""
  done <<< "$TABLES"

  # ── Foreign keys ────────────────────────────────────────────────────────
  echo "## Foreign Keys"
  echo ""
  echo "| table | column | → table |"
  echo "|-------|--------|---------|"

  q "SELECT tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema    = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema    = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema    = 'public'
     ORDER BY tc.table_name, kcu.column_name;" \
  | while IFS=$'\t' read -r tbl col ref; do
      echo "| \`$tbl\` | \`$col\` | \`$ref\` |"
    done

  echo ""

  # ── Enum types ──────────────────────────────────────────────────────────
  ENUMS=$(q "SELECT t.typname, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS labels
             FROM pg_type t
             JOIN pg_enum e ON e.enumtypid = t.oid
             JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
             WHERE n.nspname = 'public'
             GROUP BY t.typname
             ORDER BY t.typname;" 2>/dev/null || true)

  if [[ -n "$ENUMS" ]]; then
    echo "## Enum Types"
    echo ""
    echo "| type | values |"
    echo "|------|--------|"
    while IFS=$'\t' read -r ename elabels; do
      echo "| \`$ename\` | $elabels |"
    done <<< "$ENUMS"
    echo ""
  fi

} > "$OUTPUT"

echo "✓ Schema written to $OUTPUT"
