---
name: implement-design
description: "Implement a design document by splitting it into tasks, tracking progress in a scratchbook, and iterating with validation. Use when the user wants to build what a design doc describes."
---

# Implement Design Document

## Overview

Turn a design document into working code through structured, validated iterations. Each task is small enough to implement and validate in one pass, but large enough to be meaningful.

## Input

The design document path. If not provided, find the most recent file matching `*-design.md` in `docs/plans/`.

## Step 1: Read and Understand the Design

1. Read the design document thoroughly
2. Read any files it references (existing code, schemas, configs) to understand the current state
3. Identify the scope boundaries — what's in, what's out

## Step 2: Create the Scratchbook

Derive the scratchbook filename from the design document:
- If design is `docs/plans/2026-03-20-waitlist-design.md` → create `docs/plans/2026-03-20-waitlist-scratchbook.md`
- Pattern: replace `-design.md` with `-scratchbook.md`, same directory

The scratchbook contains:
```markdown
# [Feature Name] — Implementation Scratchbook

Design: [relative path to design doc]

## Tasks

- [ ] Task 1: Brief description
- [ ] Task 2: Brief description
- ...

## Learnings

Notes discovered during implementation that aren't in the design doc.
```

**Rules for the scratchbook:**
- Reference the design document, do NOT copy its contents
- Tasks should be in dependency order (earlier tasks unblock later ones)
- Each task should be completable in one focused pass (a few files, one concern)
- Aim for 3-8 tasks. Fewer than 3 means tasks are too large; more than 8 means they're too granular
- The Learnings section captures surprises, gotchas, and decisions made during implementation

## Step 3: Create Task List

Use `TaskCreate` to create a task for each item in the scratchbook. Include enough context in each task description that it can be understood without re-reading the full design.

Set up `blockedBy` dependencies where tasks genuinely depend on earlier ones.

## Step 4: Iterate Through Tasks

For each task, in order:

### 4a. Implement
- Mark the task `in_progress`
- Read relevant existing code before writing new code
- Implement the task, following project conventions from CLAUDE.md
- Keep changes focused — don't fix unrelated things

### 4b. Validate
- Spawn an `implementation-validator` agent to check the implementation against the design document
- The validator prompt should include: the design doc path, what was just implemented, and which task this covers
- If the validator finds issues, fix them before moving on

### 4c. Update Scratchbook
- If you learned anything non-obvious during implementation (unexpected constraints, edge cases, decisions made), add it to the Learnings section
- Check off the completed task in the scratchbook's task list
- Mark the task `completed`

### 4d. Next Task
- Pick the next unblocked pending task and repeat from 4a

## Step 5: Final Review

When all tasks are complete:

1. Update the scratchbook with a final status line: `## Status: Complete — YYYY-MM-DD`
2. Run the `code-review` skill on the changes (invoke via Skill tool)
3. Run all relevant test suites (see CLAUDE.md for commands — typically `pnpm test` for unit tests, `pnpm test:e2e` for E2E if applicable). Fix any failures before considering the implementation done. If a fix changes behavior, re-run the `implementation-validator` on the affected task

## Key Principles

- **Small validated steps** — Implement, validate, record, repeat
- **Scratchbook is living** — Update it as you learn; it's the source of truth for progress
- **Design doc is immutable** — Don't modify the design document during implementation. If the design needs changes, flag it to the user
- **Validate every task** — Never skip the implementation-validator step
- **Stay focused** — Each task touches one concern. Don't refactor the world
