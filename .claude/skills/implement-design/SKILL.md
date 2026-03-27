---
name: implement-design
description: "Implement a design document by splitting it into tasks, tracking progress in a scratchbook, and iterating with validation."
---

# Implement Design Document

## Overview

Turn a design document into working code through iterative, validated implementation. Work through meaningful tasks one at a time, validating each before moving on.

## Input

The design document path. If not provided, find the most recent `*-design.md` file in `docs/plans/`.

## Process

### Step 1: Read and Understand

Read the design document thoroughly. Understand the full scope before splitting work.

### Step 2: Split Into Tasks

Break the work into meaningful tasks — not too large (should be completable in one focused session), not too small (should represent a coherent unit of change). Good task boundaries:
- A database migration + its RLS policies
- A new component + its integration point
- A service function + its unit tests
- An E2E test feature file + its step definitions

Each task should be independently verifiable.

### Step 3: Create Scratchbook

Create a scratchbook file next to the design document. If the design doc is `yyyy-mm-dd-something-design.md`, name the scratchbook `yyyy-mm-dd-something-scratchbook.md`.

The scratchbook is a living document for tracking progress and capturing learnings. It should:
- List all tasks with status (todo / in-progress / done)
- Reference the design document (do NOT copy its contents)
- Capture learnings, surprises, deviations, and decisions made during implementation
- Note anything that turned out differently from the design

Template:
```markdown
# [Feature Name] — Implementation Scratchbook

**Design doc**: [relative path to design document]
**Started**: [date]

## Tasks

- [ ] Task 1: [description]
- [ ] Task 2: [description]
- [ ] Task 3: [description]
...

## Learnings

[Updated as implementation progresses]
```

### Step 4: Iterate

For each task:

1. **Select** the next incomplete task from the scratchbook
2. **Mark** it as in-progress in the scratchbook
3. **Implement** the task
4. **Validate** by running the `implementation-validator` agent against the design document, focusing on the scope of the current task
5. **Fix** any issues the validator finds
6. **Learn** — if anything surprised you, deviated from the design, or required a judgment call, add it to the scratchbook's Learnings section
7. **Mark** the task as done in the scratchbook
8. **Repeat** until all tasks are complete

### Step 5: Final Review

When all tasks are done:
- Run the `implementation-validator` agent one final time against the full design document
- Run `/simplify` skill if available to review changed code for quality
- Update the scratchbook with a summary of what was implemented and any remaining follow-ups

## Key Principles

- **One task at a time** — finish and validate before starting the next
- **Scratchbook is the source of truth** for progress — keep it updated
- **Don't copy the design doc** into the scratchbook — reference it
- **Capture learnings** — the scratchbook should help future implementors understand what actually happened vs. what was planned
- **Validate early, validate often** — catch deviations before they compound
