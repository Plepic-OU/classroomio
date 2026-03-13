#!/usr/bin/env bash
# db-schema.sh — extract DB schema from local Supabase → docs/c4/database.md
#
# Usage:
#   bash .claude/skills/c4-model/db-schema.sh [repo-root] [output-file]
#
# Requires: supabase start (docker must be running)

set -euo pipefail

REPO_ROOT="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
OUTPUT="${2:-$REPO_ROOT/docs/c4/database.md}"

# ---------------------------------------------------------------------------
# Find Supabase DB container
# ---------------------------------------------------------------------------
CONTAINER=$(docker ps --format "{{.Names}}" | grep "supabase_db" | head -1 || true)

if [ -z "$CONTAINER" ]; then
  echo "Error: No supabase_db container found." >&2
  echo "Run 'supabase start' first, then re-run this script." >&2
  exit 1
fi

echo "Container: $CONTAINER"
mkdir -p "$(dirname "$OUTPUT")"

GENERATED=$(date -u "+%Y-%m-%dT%H:%M:%SZ")

# ---------------------------------------------------------------------------
# Helper: run psql in the container
# ---------------------------------------------------------------------------
psql_q() {
  docker exec "$CONTAINER" psql -U postgres -d postgres -qAt -c "$1"
}

# ---------------------------------------------------------------------------
# Build Markdown
# ---------------------------------------------------------------------------
{
  echo "# ClassroomIO Database Schema"
  echo ""
  echo "_Generated: $GENERATED from local Supabase. Schema: \`public\`._"
  echo ""
  echo "## Tables"

  # Get all user tables in public schema
  TABLES=$(psql_q "
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  ")

  for TABLE in $TABLES; do
    # Count columns for the header
    COL_COUNT=$(psql_q "
      SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '$TABLE';
    ")

    echo ""
    echo "### $TABLE ($COL_COUNT cols)"

    # Per-column: name, type, PK flag, FK reference, NOT NULL flag
    psql_q "
      SELECT
        '- ' || c.column_name || ': ' || c.data_type ||
        CASE WHEN pk.column_name IS NOT NULL THEN ' PK' ELSE '' END ||
        CASE
          WHEN fk.foreign_table IS NOT NULL
          THEN ' FK→' || fk.foreign_table || '.' || fk.foreign_col
          ELSE ''
        END ||
        CASE
          WHEN c.is_nullable = 'NO' AND pk.column_name IS NULL THEN ' NN'
          ELSE ''
        END
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
      ) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
      LEFT JOIN (
        SELECT
          kcu.table_name,
          kcu.column_name,
          ccu.table_name  AS foreign_table,
          ccu.column_name AS foreign_col
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
      ) fk ON fk.table_name = c.table_name AND fk.column_name = c.column_name
      WHERE c.table_schema = 'public' AND c.table_name = '$TABLE'
      ORDER BY c.ordinal_position;
    "
  done

  # ---------------------------------------------------------------------------
  # Enum types
  # ---------------------------------------------------------------------------
  ENUMS=$(psql_q "
    SELECT typname || ': ' || string_agg(enumlabel, ', ' ORDER BY enumsortorder)
    FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY typname
    ORDER BY typname;
  " || true)

  if [ -n "$ENUMS" ]; then
    echo ""
    echo "## Enums"
    echo ""
    while IFS= read -r line; do
      echo "- $line"
    done <<< "$ENUMS"
  fi

} > "$OUTPUT"

echo "✓ Written to $OUTPUT"
