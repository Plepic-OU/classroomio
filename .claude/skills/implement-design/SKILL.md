---
name: implement-design
description: "Implement a design document end-to-end. Splits work into tasks, creates a scratchbook for learnings, iterates with validation, and runs code review when done."
---

# Implement Design Document

## Overview

Take a design document and implement it systematically: split into tasks, track progress and learnings in a scratchbook, validate each task, and code-review the result.

## Input

The design document path. If not provided, find the most recent `*-design.md` file in `docs/plans/`.

## Step 1: Read and Decompose

1. **Read** the design document thoroughly.
2. **Split** the work into meaningful tasks. Each task should be:
   - Small enough to implement and validate in one pass (a single file change, a new component, a migration, a config update)
   - Large enough to be a coherent unit of work (not "add an import", not "change a variable name")
   - Ordered by dependency — earlier tasks should not depend on later ones
3. Aim for **5-15 tasks** for a typical design. If you have more than 20, you are splitting too fine. If fewer than 3, you are splitting too coarse.

## Step 2: Create the Scratchbook

Create a scratchbook file **next to the design document**. Derive the name from the design doc:

- Design: `docs/plans/2026-03-13-bdd-playwright-design.md`
- Scratchbook: `docs/plans/2026-03-13-bdd-playwright-scratchbook.md`

Pattern: replace `-design.md` with `-scratchbook.md`.

### Scratchbook Format

```markdown
# Scratchbook: [Design Title]

> Design document: [relative path to design doc]
> Created: [today's date]

## Tasks

- [ ] Task 1: [short description]
- [ ] Task 2: [short description]
- [ ] Task 3: [short description]
...

## Learnings

<!-- Append learnings here as they are discovered during implementation -->
```

**Rules:**
- The scratchbook must NOT copy design document contents — it references the design doc by path
- Tasks are a checklist with short descriptions (one line each)
- Learnings are appended as they are discovered — not pre-populated

## Step 3: Iterate Through Tasks

For each task, follow this loop:

### 3a. Select Next Task

Pick the next unchecked task from the scratchbook. Announce which task you are starting.

### 3b. Implement

Implement the task based on the design document. Read relevant existing code before making changes. Follow the project's conventions (see CLAUDE.md).

### 3c. Validate

After implementing, spawn an `implementation-validator` agent to verify:
- The implementation matches what the design document specifies
- No deviations, misinterpretations, or missing pieces

Pass both the design document path and a description of what was just implemented.

### 3d. Fix Issues

If the validator finds problems, fix them before moving on. Re-validate if the fixes were significant.

### 3e. Record Learnings

If anything non-obvious was discovered during implementation — a quirk, a workaround, a pattern that differs from what the design assumed — append it to the scratchbook's **Learnings** section:

```markdown
### [short title]
[What happened and what was done about it. 1-3 sentences.]
```

Only record things that would be useful to know if someone continued this work later. Do not record routine implementation details.

### 3f. Mark Done

Update the scratchbook: check off the completed task (`- [x]`).

### 3g. Repeat

Go back to 3a until all tasks are checked off.

## Step 4: Final Review

When all tasks are complete:

1. **Run `/code-review`** if the code-review skill/plugin is available. Address any findings before finishing.
2. **Update the scratchbook** with a final status line:

```markdown
## Status

Completed: [today's date]
```

3. **Report to the user**: Summarize what was implemented, any learnings, and any issues the code review flagged.

## Key Principles

- **Design doc is the spec** — implement what it says, not more, not less. If the design is ambiguous, ask the user.
- **Scratchbook is the log** — it tracks what was done and what was learned. Keep it lean.
- **Validate early** — catch deviations per-task, not at the end when they are expensive to fix.
- **Learnings compound** — later tasks benefit from earlier learnings. Record them promptly.
- **One task at a time** — do not parallelize tasks. Sequential execution with validation catches issues before they cascade.
