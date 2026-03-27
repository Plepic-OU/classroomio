---
name: implement-design-document
description: "Implement a design document by splitting work into tasks, tracking progress in a scratchbook, validating each task, and running a final code review."
---

# Implementing a Design Document

## Overview

Turn a validated design document into working code through structured, iterative task execution. Each task is small enough to implement and validate independently but large enough to deliver meaningful progress.

## The Process

### Step 1 — Read and Decompose

Read the design document in full. Identify the major pieces of work and break them into tasks that are:
- **Not too large**: each task should be completable and verifiable on its own (a component, a route, a migration — not "the whole feature")
- **Not too small**: avoid micro-tasks that add overhead without value (not "add one import", not "rename one variable")
- **Logically ordered**: dependencies come first

### Step 2 — Create the Scratchbook

Derive the scratchbook filename from the design document filename:
- Design doc: `docs/plans/YYYY-MM-DD-something-design.md`
- Scratchbook: `docs/plans/YYYY-MM-DD-something-scratchbook.md`

Place it next to the design document.

The scratchbook is a living working document. It must **NOT** copy content from the design doc — it references it. Structure:

```markdown
# <Feature Name> — Implementation Scratchbook

Design doc: [YYYY-MM-DD-something-design.md](./YYYY-MM-DD-something-design.md)

## Tasks

- [ ] Task 1 — short description
- [ ] Task 2 — short description
- [ ] Task 3 — short description
...

## Learnings

_Notes recorded during implementation — surprises, constraints, decisions not in the design doc._
```

Only add learnings that are **not already in the design doc** and that would be useful context for future tasks.

### Step 3 — Iterate Over Tasks

For each task (in order):

1. **Select the next unchecked task** from the scratchbook.
2. **Implement it** — read relevant files first, then make the changes.
3. **Run the `implementation-validator` agent** to verify the implementation matches the design doc and the task's intent.
4. If the validator finds issues, fix them before moving on.
5. **Record any learnings** in the scratchbook's Learnings section (only if non-obvious or not in the design doc).
6. **Mark the task done** in the scratchbook: `- [x] Task N — ...`
7. Repeat.

### Step 4 — Final Code Review

When all tasks are checked off, invoke the `code-review` skill if it is available in the project.

---

## Key Principles

- **Scratchbook ≠ design doc copy** — reference, don't duplicate.
- **Validate every task** — don't batch validations at the end.
- **Record surprises, not plans** — learnings are for things discovered during implementation, not intentions from the design doc.
- **Finish before reviewing** — complete all tasks, then run code review once at the end.
- **Stay in scope** — implement what the design doc specifies. Raise out-of-scope ideas as comments, not code.
