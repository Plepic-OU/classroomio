---
name: implement-design
description: "Use this skill to implement a design document. Takes a design doc path, splits work into tasks, creates a scratchbook, and iterates through implementation with validation after each task."
---

# Implement Design Document

## Overview

Systematically implement a design document by breaking it into tasks, tracking progress in a scratchbook, and validating each step.

## Input

The user provides a path to a design document (e.g., `docs/plans/yyyy-mm-dd-something-design.md`).

## Process

### Step 1: Read and understand the design

- Read the full design document
- Identify all deliverables, decisions, and acceptance criteria
- Note any dependencies between parts

### Step 2: Split into tasks

Break the work into meaningful tasks:
- Each task should be independently completable and verifiable
- Too small = trivial one-liner changes that don't need tracking
- Too large = multiple unrelated files or concerns mixed together
- Good size = one logical change that can be validated in isolation
- Order tasks by dependency (foundations first, then features that build on them)

### Step 3: Create the scratchbook

Create a scratchbook file next to the design document. If the design doc is `docs/plans/yyyy-mm-dd-something-design.md`, create `docs/plans/yyyy-mm-dd-something-scratchbook.md`.

The scratchbook contains:
- A reference to the design document (NOT a copy of its contents)
- The task list with status markers
- Learnings discovered during implementation

Template:

```markdown
# Scratchbook: <topic>

Design document: [<design doc filename>](./<design doc filename>)

## Tasks

- [ ] Task 1: <description>
- [ ] Task 2: <description>
- [ ] Task 3: <description>
...

## Learnings

<!-- Add entries here as tasks are completed. Format: "- **task N**: what was learned" -->
```

### Step 4: Iterate through tasks

For each task:

1. **Select** the next incomplete task from the scratchbook
2. **Implement** the task following the design document's decisions and conventions
3. **Validate** by launching the `implementation-validator` agent against the design document to check the work
4. **Record learnings** — if anything was surprising, different from expected, or needed adjustment, add it to the scratchbook's Learnings section
5. **Mark done** — update the task checkbox in the scratchbook from `[ ]` to `[x]`
6. **Repeat** until all tasks are complete

### Step 5: Final review

When all tasks are complete, invoke the `code-review` skill (if available) to review the full set of changes.

## Key Principles

- **The design document is the source of truth** — don't deviate without noting why in the scratchbook
- **The scratchbook is lightweight** — task list + learnings only, no duplication of design content
- **Validate after each task** — catch deviations early, not at the end
- **Learnings compound** — what you discover in task 2 may change how you approach task 5
- **Tasks can be adjusted** — if a task turns out to need splitting or merging, update the scratchbook and continue
