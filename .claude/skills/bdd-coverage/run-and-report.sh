#!/usr/bin/env bash
# Generates BDD spec files from .feature files, runs Playwright, and writes
# a JSON result to /tmp/bdd-results.json for the skill to parse.
#
# Usage: bash run-and-report.sh [--grep <pattern>] [--spec <path>]
#   --grep  pattern   Run only scenarios matching this string/regex
#   --spec  path      Run a single generated spec file (relative to repo root)
#
# Exit codes: 0 = all passed, 1 = failures/errors, 2 = service not reachable

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

GREP_ARG=""
SPEC_ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --grep) GREP_ARG="--grep $2"; shift 2 ;;
    --spec) SPEC_ARG="$2";        shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# ── Pre-flight: verify required services are up ───────────────────────────────
check_service() {
  local name=$1 url=$2
  if ! curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
    echo "ERROR: $name is not reachable at $url"
    echo "Start it before running tests:"
    echo "  supabase start"
    echo "  pnpm dev:container"
    exit 2
  fi
}

check_service "Dashboard" "http://localhost:5173/login"
check_service "API"        "http://localhost:3002"
check_service "Supabase"   "http://localhost:54321"

# ── Generate BDD spec files ───────────────────────────────────────────────────
echo "Generating BDD specs from feature files..."
npx bddgen --config tests/e2e/playwright.config.ts

# ── Run Playwright ────────────────────────────────────────────────────────────
RESULTS_FILE="/tmp/bdd-results.json"
echo "Running Playwright tests (output → $RESULTS_FILE)..."

set +e
npx playwright test \
  --config tests/e2e/playwright.config.ts \
  --reporter="json:$RESULTS_FILE" \
  $GREP_ARG \
  $SPEC_ARG
EXIT_CODE=$?
set -e

# ── Summary ───────────────────────────────────────────────────────────────────
if [[ -f "$RESULTS_FILE" ]]; then
  node - "$RESULTS_FILE" <<'EOF'
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const suites = data.suites ?? [];
let passed = 0, failed = 0, skipped = 0;
function walk(suite) {
  for (const t of suite.specs ?? []) {
    for (const r of t.tests ?? []) {
      if (r.status === 'passed')  passed++;
      else if (r.status === 'skipped') skipped++;
      else failed++;
    }
  }
  for (const s of suite.suites ?? []) walk(s);
}
suites.forEach(walk);
console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed > 0) {
  console.log('\nFailed scenarios:');
  function printFailed(suite, prefix) {
    for (const t of suite.specs ?? []) {
      for (const r of t.tests ?? []) {
        if (r.status !== 'passed' && r.status !== 'skipped') {
          const msg = r.results?.[0]?.errors?.[0]?.message ?? 'unknown error';
          console.log(`  ✗ ${prefix}${t.title}`);
          console.log(`    ${msg.split('\n')[0]}`);
        }
      }
    }
    for (const s of suite.suites ?? []) printFailed(s, `${s.title} > `);
  }
  suites.forEach(s => printFailed(s, ''));
}
EOF
fi

exit $EXIT_CODE
