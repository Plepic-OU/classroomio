---
name: implement-design
description: "Implement a design document. Creates a scratchbook, breaks work into tasks, iterates task-by-task with implementation validation, and runs a code review at the end."
---

# Implement Design Document

## Overview

Turn a validated design document into working code by breaking it into focused tasks, implementing each one with validation, and tracking learnings in a scratchbook alongside the design.

## Input

The design document path. If not provided, find the most recent `*-design.md` file in `docs/plans/`.

---

## Step 1: Read the Design Document

Read the design document in full before doing anything else. Understand:
- What is being built and why
- The components, data flow, and constraints
- Any explicitly listed implementation tasks or phases

---

## Step 2: Create the Scratchbook

Derive the scratchbook filename from the design doc:
- Design doc: `yyyy-mm-dd-something-design.md`
- Scratchbook: `yyyy-mm-dd-something-scratchbook.md`
- Place it in the **same directory** as the design doc

The scratchbook structure:

```markdown
# <Topic> — Implementation Scratchbook

> Design doc: <relative path to design doc>

## Tasks

- [ ] Task 1: <short title>
- [ ] Task 2: <short title>
- [ ] Task 3: <short title>
...

## Learnings

_Notes added during implementation — surprises, decisions, gotchas._
```

**Task sizing rules:**
- Each task should be completable in one focused implementation pass
- Not too large: a task should touch one concern (one component, one DB migration, one API route, one test suite — not all at once)
- Not too small: don't split a 5-line change into 3 tasks
- Aim for 3–8 tasks total for most designs; complex designs may have more

Do NOT copy design document contents into the scratchbook. Reference the design doc instead.

---

## Step 3: Implement Tasks One by One

For each unchecked task, in order:

### 3a. Implement

Implement the task. Follow the design doc. Keep changes focused to the task scope — do not accidentally implement future tasks.

### 3b. Validate

After implementing the task, run the `implementation-validator` agent with a prompt like:

> "Validate that the implementation of [task title] matches the design in [design doc path]. Focus on [the specific concern of this task]."

Wait for the validator to complete. Apply any clear corrections. If the validator raises something ambiguous, note it in the scratchbook and use your judgement.

### 3c. Update the Scratchbook

If you learned anything new during this task — a constraint you discovered, a decision you made that deviated from the design, an unexpected dependency — add a brief note under **Learnings**. Keep notes short and factual.

### 3d. Mark Done

Mark the task as `[x]` in the scratchbook before moving to the next one.

---

## Step 4: Code Review

When all tasks are checked off, run the `/code-review` skill if it is listed in the available skills for this project.

Present the review results to the user. Apply any straightforward suggestions; flag anything that requires a decision.

---

## Key Principles

- **Design doc is the source of truth** — if something is unclear, re-read the design before inventing
- **One task at a time** — finish and validate before moving on; do not batch-implement
- **Scratchbook is lean** — a few bullet points per learning, not paragraphs
- **Validator findings are signals, not mandates** — apply obvious fixes, note ambiguous ones, skip noise
- **Stay in scope** — if you notice something outside the current task that needs fixing, add it as a new task rather than fixing it inline
