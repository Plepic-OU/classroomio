---
name: implement-design-document
description: "Implement a design document end-to-end: break into tasks, maintain a scratchbook, implement each task with validation, and finish with code review."
---

# Implement Design Document

## Overview

Turn a finalized design document into working code. Work task-by-task with a scratchbook for tracking progress and learnings. Validate each task after implementation, then run a code review at the end.

## Input

The design document path. If not provided, find the most recent `*-design.md` in `docs/plans/`.

## Step 1: Read the Design Document

Read the design document in full before doing anything else. Understand the scope, components, and decisions made.

## Step 2: Create the Scratchbook

Derive the scratchbook path from the design document path:
- Design doc: `YYYY-MM-DD-something-design.md`
- Scratchbook: `YYYY-MM-DD-something-scratchbook.md` (same directory)

Create the scratchbook with this structure:

```markdown
# Scratchbook: [Design Title]

Design doc: [relative path to design doc]

## Tasks

- [ ] Task 1: [short title]
- [ ] Task 2: [short title]
- [ ] Task 3: [short title]
...

## Learnings

_Notes about surprises, constraints, or decisions discovered during implementation._
```

### Task sizing rules

- Each task should be a coherent unit of work — one layer, one feature slice, one migration.
- Too large: "implement the whole feature" → split by layer (DB, API, UI) or by sub-feature.
- Too small: "add one import" → merge into its natural parent task.
- Aim for 3–10 tasks total. A task should take one focused implementation cycle, not days.

Do **not** copy design document content into the scratchbook. Reference the design doc by path.

## Step 3: Implement Tasks One by One

Repeat for each uncompleted task:

### 3a. Implement

Select the next uncompleted task. Read the relevant parts of the design document and the current codebase before writing any code. Implement the task.

### 3b. Validate

After implementing, run the `implementation-validator` agent:

```
subagent_type: "implementation-validator"
prompt: "Validate the implementation of [task title] against the design document at [path]. Focus on: does the code match the design intent? Are there deviations, missing pieces, or bugs introduced?"
```

Review the validator's findings:
- **Clear issues**: fix them before moving on.
- **Uncertain findings**: use your judgment; note the decision in the scratchbook under Learnings.
- **False positives**: note them so future passes don't repeat the question.

### 3c. Update Scratchbook

If the implementation or validation revealed anything non-obvious — unexpected constraints, better patterns found, decisions made that aren't in the design — add a brief note to the **Learnings** section.

Keep notes short. One or two sentences per insight.

### 3d. Mark Task Done

Update the task checkbox in the scratchbook:
```
- [x] Task N: [short title]
```

Then proceed to the next task.

## Step 4: Code Review

When all tasks are complete, run the `code-review` skill if it is available in the current session.

Invoke it as:
```
/code-review
```

If the `code-review` skill is not available, notify the user that all tasks are complete and suggest they run `/code-review` manually.

## Key Principles

- **Read before writing** — always read relevant code before implementing a task.
- **One task at a time** — finish and validate before moving to the next.
- **Scratchbook is a log, not a copy** — reference the design, don't duplicate it.
- **Fix validator issues before moving on** — don't accumulate debt across tasks.
- **Stay in scope** — if you discover work outside the design, note it in Learnings but don't implement it now.
