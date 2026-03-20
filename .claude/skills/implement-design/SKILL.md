---
name: implement-design
description: "Implement a validated design document task-by-task with a scratchbook, implementation validation after each task, and a final test run."
---

# Implement Design Document

## Overview

Turn a validated design document into working code by splitting the work into tasks, tracking progress in a scratchbook, and validating each task before moving on.

## Input

The design document path. If not provided, find the most recent `*-design.md` file in `docs/plans/`.

## Step 1: Create the Scratchbook

Derive the scratchbook path from the design document path:
- Design: `docs/plans/YYYY-MM-DD-something-design.md`
- Scratchbook: `docs/plans/YYYY-MM-DD-something-scratchbook.md`

Create the scratchbook with this structure:

```markdown
# [Feature Name] — Implementation Scratchbook

**Design doc:** [relative path to design doc]
**Started:** YYYY-MM-DD

## Tasks

- [ ] Task 1: ...
- [ ] Task 2: ...
- [ ] Task 3: ...
...

## Learnings

_Notes added during implementation — surprises, deviations from the design, gotchas._
```

### How to split tasks

- Each task should be a coherent unit of work (e.g. "DB migration", "RPC functions", "Service layer", "UI component", "Email notifications", "Unit tests", "E2E tests")
- Not too large (no "implement the whole feature"), not too small (no "add one line")
- Typical task count: 5–10 for a medium feature
- Tasks should follow a dependency order (DB first, then service layer, then UI, then tests)

Do **not** copy design doc content into the scratchbook. Reference the design doc instead.

## Step 2: Iterate Over Tasks

For each task, in order:

### 2a. Implement

Read the relevant sections of the design doc. Read the existing code in the area you are about to change. Then implement the task.

### 2b. Validate

After implementing each task, run the `implementation-validator` agent:

```
Spawn agent: subagent_type "implementation-validator"
Prompt: "Validate the implementation of [task name] against the design document at [design doc path].
Focus on: [brief description of what was just implemented]."
```

If the validator finds issues, fix them before moving on.

### 2c. Update the Scratchbook

After the task passes validation:
- Mark the task done: `- [x] Task N: ...`
- If you learned anything new (a gotcha, a deviation from the design, a decision made), add it to the **Learnings** section

Then pick the next task.

## Step 3: Code Review

After all tasks are complete, run the `simplify` skill if available:
```
/simplify
```

Address any findings before proceeding.

## Step 4: Run All Tests and Fix Errors

Run the full test suite:

```bash
# Unit tests
cd apps/dashboard && pnpm test

# E2E tests (only if supabase + dev server are running)
pnpm test:e2e
```

Fix any failures. Do not move on until all tests pass.

## Key Principles

- **Read before writing** — Always read the existing code in an area before modifying it
- **One task at a time** — Complete and validate each task fully before starting the next
- **Scratchbook is a log, not a copy** — Reference the design, don't repeat it; record surprises
- **Fix forward** — If validation finds an issue, fix it; don't skip or defer
- **Tests are part of done** — A task that includes tests is not done until the tests pass
