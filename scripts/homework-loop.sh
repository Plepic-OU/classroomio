#!/usr/bin/env bash
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH"

SCENARIO="Search the course list by title"
FEATURE_FILE="tests/e2e/features/courses/course-search.feature"
MAX_ROUNDS=5
OUTPUT_TAIL_LINES=80

LOG_FILE="scripts/homework-loop.log"
RESULT_FILE="scripts/homework-loop-result.json"
WORK_DIR="$(mktemp -d)"
ROUNDS_FILE="$WORK_DIR/rounds.jsonl"
touch "$ROUNDS_FILE"

ALLOWED_TOOLS="Read,Edit,Write,Glob,Grep,Bash(pnpm test:e2e*),Bash(pnpm exec*),Bash(ls*),Bash(cat*)"

log() {
  printf '%s\n' "$*" | tee -a "$LOG_FILE"
}

record_round() {
  ROUND="$1" TEST_EXIT="$2" CLAUDE_CALLED="$3" CLAUDE_JSON="$4" python3 - >>"$ROUNDS_FILE" <<'PY'
import json, os

claude_json_path = os.environ["CLAUDE_JSON"]
result = {}
if claude_json_path and os.path.exists(claude_json_path):
    try:
        with open(claude_json_path) as handle:
            result = json.load(handle)
    except (ValueError, OSError):
        result = {}

summary_text = (result.get("result") or "").strip().replace("\n", " ")
print(json.dumps({
    "round": int(os.environ["ROUND"]),
    "test_exit": int(os.environ["TEST_EXIT"]),
    "claude_called": os.environ["CLAUDE_CALLED"] == "true",
    "duration_ms": result.get("duration_ms"),
    "cost_usd": result.get("total_cost_usd"),
    "num_turns": result.get("num_turns"),
    "summary": summary_text[:500] or None,
}))
PY
}

write_result() {
  FINAL="$1" ROUNDS_USED="$2" ROUNDS_FILE="$ROUNDS_FILE" SCENARIO="$SCENARIO" FEATURE_FILE="$FEATURE_FILE" \
    python3 - >"$RESULT_FILE" <<'PY'
import json, os

with open(os.environ["ROUNDS_FILE"]) as handle:
    rounds = [json.loads(line) for line in handle if line.strip()]

print(json.dumps({
    "scenario": os.environ["SCENARIO"],
    "feature_file": os.environ["FEATURE_FILE"],
    "rounds": rounds,
    "final": os.environ["FINAL"],
    "rounds_used": int(os.environ["ROUNDS_USED"]),
}, indent=2))
PY
}

build_prompt() {
  local failing_output="$1"
  cat <<EOF
You are fixing a failing Playwright-BDD end-to-end scenario in the ClassroomIO monorepo (repo root: $REPO_ROOT).

Feature file (do NOT edit it): $FEATURE_FILE
Scenario name: "$SCENARIO"

Feature file contents:
$(cat "$FEATURE_FILE")

Command that must pass: pnpm test:e2e --grep "$SCENARIO"

Last $OUTPUT_TAIL_LINES lines of its output:
----
$failing_output
----

Pointers:
- Existing step definitions: tests/e2e/steps/auth/login.steps.ts and tests/e2e/steps/courses/course-creation.steps.ts. Reuse steps already defined there (for example "I am logged in as {string}" and "I am on the courses page"); never define a step text twice.
- Helpers: tests/e2e/helpers/ (login.ts, hydration.ts, test-users.ts). Playwright config: tests/e2e/playwright.config.ts.
- Test-id registry and locator rules: e2e/README.md. Locator priority is getByRole / getByLabel, then #id, then getByTestId. Never select by CSS class or Tailwind utility.
- The admin course list lives in apps/dashboard/src/routes/(app)/org/[slug]/courses/+page.svelte and its components.
- Project rules: CLAUDE.md and skills/writing-code/SKILL.md (no comments by default, kebab-case file names, readable variable names, blank line after an early return).

Instructions:
1. Implement or fix the missing/failing step definitions in a new file tests/e2e/steps/courses/course-search.steps.ts using createBdd() from playwright-bdd, following the style of the existing step files.
2. Only change app code if the behaviour is genuinely impossible to test otherwise (for example adding a testId prop), and keep any such change minimal.
3. Do not edit the .feature file and do not edit other scenarios' steps unless required to remove a duplicate.
4. Do not restart dev servers or reseed the database; they are already running.
5. Run "pnpm test:e2e --grep \"$SCENARIO\"" yourself to verify before finishing.
6. Finish with a one-paragraph summary of what you changed and whether the scenario passed.
EOF
}

: >"$LOG_FILE"
log "homework-loop start $(date -u +%Y-%m-%dT%H:%M:%SZ) scenario=\"$SCENARIO\""

for round in $(seq 1 "$MAX_ROUNDS"); do
  test_output_file="$WORK_DIR/test-round-$round.txt"
  log "round $round: $(date -u +%Y-%m-%dT%H:%M:%SZ) running tests"

  pnpm test:e2e --grep "$SCENARIO" >"$test_output_file" 2>&1
  test_exit=$?
  log "round $round: test_exit=$test_exit"

  if [ "$test_exit" -eq 0 ]; then
    log "round $round: claude_called=false"
    record_round "$round" "$test_exit" false ""
    write_result PASS "$round"
    log "PASS after $round round(s)"
    echo "PASS"
    exit 0
  fi

  failing_output="$(tail -n "$OUTPUT_TAIL_LINES" "$test_output_file")"
  prompt="$(build_prompt "$failing_output")"
  claude_json_file="$WORK_DIR/claude-round-$round.json"

  log "round $round: $(date -u +%Y-%m-%dT%H:%M:%SZ) calling claude -p"
  env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT PATH="$PATH" claude -p "$prompt" \
    --output-format json \
    --permission-mode acceptEdits \
    --allowedTools "$ALLOWED_TOOLS" >"$claude_json_file" 2>"$WORK_DIR/claude-round-$round.err"
  claude_exit=$?

  claude_stats="$(CLAUDE_JSON="$claude_json_file" python3 -c '
import json, os
try:
    data = json.load(open(os.environ["CLAUDE_JSON"]))
except (ValueError, OSError):
    data = {}
print("duration_ms=%s total_cost_usd=%s num_turns=%s is_error=%s" % (data.get("duration_ms"), data.get("total_cost_usd"), data.get("num_turns"), data.get("is_error")))
')"
  log "round $round: claude_called=true claude_exit=$claude_exit $claude_stats"
  if [ "$claude_exit" -ne 0 ]; then
    log "round $round: claude stderr: $(tail -n 5 "$WORK_DIR/claude-round-$round.err")"
  fi

  record_round "$round" "$test_exit" true "$claude_json_file"
done

log "final verification: $(date -u +%Y-%m-%dT%H:%M:%SZ) running tests after round $MAX_ROUNDS"
if pnpm test:e2e --grep "$SCENARIO" >"$WORK_DIR/test-final.txt" 2>&1; then
  write_result PASS "$MAX_ROUNDS"
  log "PASS after $MAX_ROUNDS round(s)"
  echo "PASS"
  exit 0
fi

write_result FAIL "$MAX_ROUNDS"
log "FAIL after $MAX_ROUNDS round(s)"
echo "FAIL"
exit 1
