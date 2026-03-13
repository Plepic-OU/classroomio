# Test Coverage Report Skill

Generate a functionality-perspective test coverage report for ClassroomIO.

**Answers: "What features does the app have, and which ones are tested?"** — not line-coverage percentages.

Outputs `docs/test-coverage/report.md`.

---

## Step 1 — Run All Tests

Run both test suites and capture output. Continue even if tests fail.

```bash
# Dashboard (Jest)
cd /workspaces/classroomio && pnpm test --filter=@cio/dashboard 2>&1 | tail -40
```

```bash
# API (Vitest)
cd /workspaces/classroomio && pnpm test --filter=@cio/api 2>&1 | tail -20
```

Record:
- Dashboard: N passed, N failed, N total
- API: N passed, N failed, N total (or "no test files found")

---

## Step 2 — Inventory Source Features

Run these commands to enumerate what exists in the codebase.

```bash
# Dashboard utility functions (each file = one feature group)
find apps/dashboard/src/lib/utils/functions -maxdepth 2 -name "*.ts" -o -name "*.js" | grep -v spec | grep -v test | sort
```

```bash
# Dashboard services (each file = one service)
find apps/dashboard/src/lib/utils/services -maxdepth 1 -name "*.ts" | grep -v spec | sort
```

```bash
# Dashboard UI components (each top-level dir = one component)
find apps/dashboard/src/lib/components -maxdepth 1 -mindepth 1 -type d | sort
```

```bash
# Dashboard server API routes (each +server.ts = one endpoint)
find apps/dashboard/src/routes/api -name "+server.ts" | sed 's|apps/dashboard/src/routes/api/||' | sed 's|/+server.ts||' | sort
```

```bash
# Dashboard page routes (each +page.svelte = one page)
find apps/dashboard/src/routes -name "+page.svelte" | grep -v "/api/" | sed 's|apps/dashboard/src/routes/||' | sed 's|/+page.svelte||' | sort
```

```bash
# API routes
find apps/api/src/routes -name "*.ts" | grep -v spec | sort
```

```bash
# API services
find apps/api/src/services -name "*.ts" | grep -v spec | sort
```

---

## Step 3 — Inventory Tests

```bash
# All test files
find apps/dashboard apps/api -name "*.spec.ts" -o -name "*.spec.js" -o -name "*.test.ts" -o -name "*.test.js" | grep -v node_modules | sort
```

For each test file found, extract test descriptions:

```bash
# Extract describe/it/test blocks from all test files at once
grep -rh --include="*.spec.*" --include="*.test.*" -E "^\s*(describe|it|test)\s*\(" apps/dashboard/src apps/api/src 2>/dev/null | sed "s/^[[:space:]]*//"
```

---

## Step 4 — Build Coverage Map

Match test files to source files using this rule:
- `foo.spec.ts` or `foo.test.ts` covers `foo.ts` / `foo.js`
- A source file with NO matching spec/test file is **not tested**
- A source file WITH a matching spec/test file is **tested** (or **partial** if the test file exists but has only 1–2 test cases)

Group every source item into one of these **feature domains** using the path/name:

| Domain | Paths/keywords |
|--------|---------------|
| Auth & Profiles | `profile`, `auth`, `email-verif`, `login`, `validateEmail`, `verify` |
| Organization | `org`, `organization`, `team`, `audience`, `domain`, `invite` |
| Course Management | `course`, `lesson`, `section`, `slug`, `CourseLanding`, `Courses` |
| Assessment | `exercise`, `submission`, `marks`, `grading`, `question`, `Question` |
| AI Features | `completion`, `prompt`, `ai` |
| Community & Social | `newsfeed`, `community`, `comment`, `notification` |
| Apps (Polls & Quiz) | `poll`, `Poll`, `quiz`, `Apps` |
| Billing | `polar`, `lemon`, `plan` |
| Navigation & Layout | `Navigation`, `Page`, `routes` (page routes) |
| File & Media | `upload`, `UploadWidget`, `video`, `presign`, `unsplash` |
| Utility Functions | `lib/utils/functions` (all helpers: date, string, currency, etc.) |
| Infrastructure | `config`, `middleware`, `redis`, `store`, `types`, `constants` |

Assign each source item a status:
- ✅ **Tested** — matching test file exists AND has ≥ 3 test cases
- ⚠️ **Partial** — matching test file exists but has ≤ 2 test cases
- ❌ **Not tested** — no matching test file

---

## Step 5 — Generate Report

Ensure output dir exists:
```bash
mkdir -p /workspaces/classroomio/docs/test-coverage
```

Write `docs/test-coverage/report.md` with this structure:

```markdown
# Functionality Test Coverage Report
_Generated: {ISO timestamp}_
_Dashboard test runner: Jest | API test runner: Vitest_

---

## Test Run Results

| App | Passed | Failed | Skipped | Total |
|-----|--------|--------|---------|-------|
| Dashboard (`@cio/dashboard`) | N | N | N | N |
| API (`@cio/api`) | N | N | N | N |

---

## Coverage Summary

| Feature Domain | Features | Tested | Partial | Not Tested | Coverage |
|----------------|----------|--------|---------|------------|----------|
| Auth & Profiles | N | N | N | N | N% |
| Organization | ... |
| Course Management | ... |
| Assessment | ... |
| AI Features | ... |
| Community & Social | ... |
| Apps (Polls & Quiz) | ... |
| Billing | ... |
| Navigation & Layout | ... |
| File & Media | ... |
| Utility Functions | ... |
| Infrastructure | ... |
| **Total** | **N** | **N** | **N** | **N** | **N%** |

> Coverage % = (Tested + 0.5 × Partial) / Total

---

## Feature Coverage Detail

For each domain, write a section:

### {Domain Name}

| Feature | Source File | Test File | Status | What's Tested |
|---------|-------------|-----------|--------|---------------|
| Date utilities | `lib/utils/functions/date.ts` | `date.spec.ts` | ✅ Tested | calDateDiff, getGreeting |
| Email validation | `lib/utils/functions/validateEmail.ts` | `validateEmail.spec.js` | ✅ Tested | valid/invalid formats |
| Course service | `lib/utils/services/courses.ts` | — | ❌ Not tested | — |
...

---

## Gaps by Priority

List the most impactful untested areas:

### High Priority (core user flows with no tests)
- ...

### Medium Priority (supporting features with no tests)
- ...

### Low Priority (infrastructure / internal utilities)
- ...

---

## What Would Good Coverage Look Like?

For each major user journey, describe what tests are needed:

1. **Enroll in a course** — needs: route handler test for `routes/api/courses/*`, service test for `services/courses.ts`
2. **Submit an exercise** — needs: ...
3. **Grade a submission** — needs: ...
4. (Add one line per major journey that currently has no coverage)
```

After writing the file, print the file size and first 20 lines to confirm it was written.

```bash
wc -l docs/test-coverage/report.md && head -20 docs/test-coverage/report.md
```

---

## Step 6 — Report to User

Print a short summary:
- Files written
- Total features inventoried
- Overall coverage percentage
- Top 3 highest-priority gaps
