---
name: implement-design-document
description: "Implement a design document by breaking it into tasks, maintaining a scratchbook, iterating task-by-task with validation, and running a final code review."
---

# Implement Design Document

## Overview

Implement a ClassroomIO design document end-to-end by following a structured loop:
split into tasks → maintain a scratchbook → implement each task → validate → review.

## Input

The design document path. If not provided, find the most recent file matching `*-design.md` in `docs/plans/`.

---

## Step 1: Read the Design Document

Read the design document in full. Understand its scope, architecture decisions, and the list of things that need to be built.

---

## Step 2: Split Into Tasks

Break the work into **meaningful tasks** — each should be:
- Implementable in one focused session (not too large)
- A single coherent unit of work (not too small — don't split one file into three tasks)
- Ordered so dependencies come first

Good task granularity examples:
- "Add `course_analytics` table migration and RLS policies"
- "Implement `CourseAnalytics` Supabase service module"
- "Build `<AnalyticsDashboard>` Svelte component"
- "Wire component into `/org/[slug]/courses/[id]/analytics` route"

**Do not** copy prose from the design doc into tasks. Tasks are actions, not descriptions.

---

## Step 3: Create the Scratchbook

Derive the scratchbook filename from the design document filename:
- `YYYY-MM-DD-something-design.md` → `YYYY-MM-DD-something-scratchbook.md`
- Place it in the **same directory** as the design document.

Scratchbook template:

```markdown
# <Feature Name> — Implementation Scratchbook

> Design doc: [path/to/design.md](path/to/design.md)

## Tasks

- [ ] Task 1: <title>
- [ ] Task 2: <title>
- [ ] Task 3: <title>
...

## Learnings

_Notes added during implementation — surprises, deviations from the design, decisions made._
```

Rules for the scratchbook:
- **Reference** the design doc, never copy its content.
- **Learnings** section is append-only — add notes as you discover things; never delete.
- **Tasks** are checked off (`[x]`) as they complete.

---

## Step 4: Implement Tasks One by One

For each unchecked task, in order:

### 4a. Implement

Implement the task. Read relevant existing files before touching them. Keep changes focused on the current task only — do not fix unrelated things.

### 4b. Validate with the implementation-validator agent

After implementing, spawn the `implementation-validator` agent:

```
subagent_type: "implementation-validator"
prompt: "Validate that the implementation of '<task title>' matches the design document at <design doc path>. Focus on: [describe what was changed]. Scratchbook is at <scratchbook path>."
```

Wait for the validator to return. If it finds deviations or errors:
- Fix them before moving on.
- Re-run the validator if the fix was non-trivial.

### 4c. Update the Scratchbook

After validation passes:
1. Check off the completed task: `[x]`.
2. Append any new **Learnings** — things that differed from the design, decisions made, gotchas discovered. Keep entries concise (1-3 lines each).

### 4d. Pick the Next Task

Select the next unchecked task and repeat from 4a.

---

## Step 5: Final Code Review

When all tasks are checked off, run the `code-review` skill if it is available in the current session:

```
/code-review
```

If `code-review` is not available, summarize what was implemented and invite the user to review.

---

## Key Principles

- **Read before you edit** — always read a file before modifying it.
- **Scratchbook ≠ design doc** — the scratchbook tracks progress and surprises, not requirements.
- **Validate every task** — never skip the implementation-validator step.
- **Stay in scope** — only implement what the design doc specifies; flag out-of-scope ideas as learnings.
- **Dependencies first** — if Task B depends on Task A's output, finish A before starting B.
- **One task at a time** — complete and validate each task before starting the next.
