---
name: implement-design-document
description: "Implement a design document by breaking it into tasks, maintaining a scratchbook, iterating task-by-task with validation, and finishing with a code review."
---

# Implement Design Document

## Overview

Turn a validated design document into working code by breaking the work into meaningful tasks, tracking progress and learnings in a scratchbook, and iterating with validation after each task.

## Input

The design document path. If not provided, find the most recent file in `docs/plans/` matching `*-design.md`.

## Step 1: Read the Design Document

Read the design document in full. Understand:
- What is being built
- The components and their responsibilities
- Data flows and dependencies between parts
- Any constraints or non-obvious decisions

## Step 2: Create the Scratchbook

Derive the scratchbook path from the design document path:
- Design doc: `docs/plans/YYYY-MM-DD-something-design.md`
- Scratchbook: `docs/plans/YYYY-MM-DD-something-scratchbook.md`

The scratchbook is a living working document. It must NOT copy design document content — instead reference the design doc and track implementation-specific state.

Write the scratchbook with this structure:

```markdown
# Implementation Scratchbook: <topic>

**Design doc:** <relative path to design doc>
**Started:** <YYYY-MM-DD>

## Task List

- [ ] Task 1: <short name> — <one-line description>
- [ ] Task 2: <short name> — <one-line description>
- [ ] Task 3: ...

## Learnings

> Notes added during implementation — surprises, corrections, gotchas, decisions made that weren't in the design doc.

## Task Notes

### Task 1: <short name>
> (filled in as each task runs)
```

## Step 3: Plan the Task List

Break the implementation into tasks that are:
- **Not too large**: each task should be completable and reviewable in one focused session (roughly one logical unit of change — one component, one migration, one endpoint, one test suite)
- **Not too small**: don't split trivially related lines into separate tasks; if two changes always go together, keep them together
- **Ordered by dependency**: implement foundational pieces (schema, types, services) before things that depend on them (UI, tests)

Typical task sizes for reference:
- A database migration + its type definitions = one task
- A single API endpoint + its types = one task
- A single UI component or route = one task
- The full test suite for a feature = one task

Write the task list into the scratchbook before starting any implementation.

Show the user the task list and ask: **"Does this task breakdown look right? Any changes before I start?"** Wait for confirmation or adjustments before proceeding.

## Step 4: Iterate — One Task at a Time

For each task (in order):

### 4a. Implement

Implement the task. Follow the design doc. Keep changes focused — do not implement future tasks speculatively.

### 4b. Validate

After implementing, run the `implementation-validator` agent:

```
subagent_type: implementation-validator
prompt: "Verify the implementation of [task name] against the design document at [design doc path].
Scratchbook is at [scratchbook path]. Focus on: [brief description of what was just implemented]."
```

Review the validator's findings:
- **Critical issues**: fix before marking the task done
- **Warnings/notes**: use judgment — fix now if cheap, otherwise note in scratchbook learnings

### 4c. Update Scratchbook

After validation:
1. Add any new learnings, surprises, or decisions to the **Learnings** section
2. Add task-specific notes under **Task Notes > [Task Name]** if anything noteworthy happened
3. Mark the task as done: `- [x] Task N: ...`

### 4d. Pick Next Task

Select the next uncompleted task from the list and repeat from 4a.

Tell the user after each task completes: **"Task N done. Moving to Task N+1: [name]."**

## Step 5: Final Code Review

When all tasks are marked done, run the `/code-review` skill if it is available in the current environment.

If `/code-review` is not available, summarize what was implemented across all tasks and note any outstanding warnings from the scratchbook learnings.

## Key Principles

- **Scratchbook is for learnings, not design**: don't duplicate the design doc — reference it
- **One task at a time**: complete and validate before moving on
- **Validate every task**: do not skip the implementation-validator step
- **Fix criticals immediately**: don't carry critical issues into later tasks where they compound
- **Confirm task breakdown first**: the plan is collaborative, not unilateral
