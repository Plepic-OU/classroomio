#!/usr/bin/env bash
# Extract database schema from local Supabase PostgreSQL container
# Outputs a token-efficient schema format suitable for C4 documentation

set -euo pipefail

# Find the Supabase Postgres container
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'supabase.*db' | head -1)

if [ -z "$CONTAINER" ]; then
    echo "ERROR: No Supabase database container found. Run 'supabase start' first." >&2
    exit 1
fi

echo "# Database Schema (auto-extracted)"
echo ""
echo "Extracted from local Supabase PostgreSQL on $(date -I)"
echo ""

# Extract tables with columns
echo "## Tables"
echo ""

docker exec "$CONTAINER" psql -U postgres -d postgres -t -A -F'|' -c "
SELECT
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c
    ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;
" | awk -F'|' '
BEGIN { current_table = "" }
{
    table = $1; col = $2; dtype = $3; nullable = $4; defval = $5
    if (table != current_table) {
        if (current_table != "") print ""
        printf "### %s\n", table
        printf "| Column | Type | Nullable | Default |\n"
        printf "|--------|------|----------|---------|\n"
        current_table = table
    }
    gsub(/^ +| +$/, "", defval)
    if (length(defval) > 40) defval = substr(defval, 1, 37) "..."
    printf "| %s | %s | %s | %s |\n", col, dtype, nullable, defval
}'

echo ""
echo "## Foreign Keys"
echo ""
echo "| Source Table | Source Column | Target Table | Target Column |"
echo "|-------------|--------------|-------------|--------------|"

docker exec "$CONTAINER" psql -U postgres -d postgres -t -A -F'|' -c "
SELECT
    tc.table_name AS source_table,
    kcu.column_name AS source_column,
    ccu.table_name AS target_table,
    ccu.column_name AS target_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
" | awk -F'|' '{ printf "| %s | %s | %s | %s |\n", $1, $2, $3, $4 }'

echo ""
echo "## Row-Level Security Policies"
echo ""

docker exec "$CONTAINER" psql -U postgres -d postgres -t -A -F'|' -c "
SELECT
    schemaname || '.' || tablename AS table_name,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
" | awk -F'|' '
BEGIN {
    printf "| Table | Policy | Permissive | Command |\n"
    printf "|-------|--------|------------|---------|\n"
}
{ printf "| %s | %s | %s | %s |\n", $1, $2, $3, $4 }'
