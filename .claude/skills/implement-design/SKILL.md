---
name: implement-design
description: 'Implement a design document by splitting it into tasks, tracking progress in a scratchbook, and iterating through implementation with validation. Use after a design document has been written and validated.'
---

# Implement Design Document

## Overview

Turn a validated design document into working code through disciplined task-by-task implementation with validation at each step.

## Input

The design document path. If not provided, find the most recent file in `docs/plans/`.

## Step 1: Read and Understand the Design

Read the design document thoroughly. Understand the full scope, components, data flow, and dependencies before planning any work.

## Step 2: Split into Tasks

Break the design into meaningful implementation tasks. Each task should be:

- **Small enough** to implement and validate in one focused pass (typically one file or one logical unit)
- **Large enough** to be meaningful on its own (not "add an import" or "rename a variable")
- **Ordered** by dependencies -- foundational pieces first, dependent pieces later
- **Independently verifiable** -- you can tell if it's done correctly without the rest

Aim for 3-10 tasks depending on the design's scope. If it's more than 10, the design may need to be split into phases.

## Step 3: Create the Scratchbook

Create a scratchbook file next to the design document:
- If design is `docs/plans/2026-03-20-feature-design.md`, create `docs/plans/2026-03-20-feature-scratchbook.md`
- If design is in a custom location, place the scratchbook alongside it with the same naming pattern

The scratchbook should contain:

```markdown
# Scratchbook: [Feature Name]

**Design document:** [relative path to design doc]
**Started:** [date]

## Tasks

- [ ] Task 1: [brief description]
- [ ] Task 2: [brief description]
- [ ] Task 3: [brief description]
...

## Learnings

_Notes discovered during implementation that aren't in the design doc._
```

**Important:** The scratchbook references the design document -- it does NOT copy its contents. It tracks task progress and captures implementation learnings only.

## Step 4: Iterate Through Tasks

For each task in order:

### 4a. Select the next uncompleted task
Read the scratchbook and pick the next `- [ ]` task.

### 4b. Implement
Write the code for this task. Follow the design document's specifications. Keep changes focused on this task only. Use agents as instructed in CLAUDE.md

### 4c. Validate
Run the `implementation-validator` agent to check the implementation against the design document. The agent should verify:
- The implementation matches the design's specifications
- No deviations or misinterpretations
- Code quality and correctness

Pass both the design document path and a description of what was just implemented.

### 4d. Record learnings
If anything surprising, non-obvious, or different from the design was discovered during implementation, add it to the scratchbook's **Learnings** section. Examples:
- An API that works differently than expected
- A dependency that needed a different version
- An edge case the design didn't cover
- A simplification that was possible

### 4e. Mark complete
Update the scratchbook: change `- [ ]` to `- [x]` for the completed task.

### 4f. Repeat
Go back to 4a until all tasks are done.

## Step 5: Final Review

When all tasks are marked complete:

1. Run the `/code-review` skill if available to review all changes
2. Present a summary of what was implemented and any learnings from the scratchbook

## Key Principles

- **Follow the design** -- The design document is the spec. If something needs to change, note it in the scratchbook and flag it to the user rather than silently deviating.
- **One task at a time** -- Don't jump ahead or work on multiple tasks simultaneously.
- **Validate after each task** -- Catch issues early before they compound.
- **Capture learnings** -- The scratchbook becomes valuable context for future work.
- **Keep the scratchbook lean** -- Only record what's not in the design doc and what would be useful to know later.
