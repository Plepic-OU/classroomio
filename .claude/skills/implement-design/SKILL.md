---
name: implement-design
description: Implement a feature from a design document. Use when the user provides a design doc and wants it implemented step by step with validation.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Agent
argument-hint: [path-to-design-doc]
---

# Implement Design Document

Implement a feature described in a design document, step by step with validation after each task.

## Steps

### 1. Read and understand the design document

- Read the design document at the path provided: `$ARGUMENTS`
- Understand the full scope: database changes, API changes, UI changes, migrations, tests

### 2. Create a scratchbook

- Derive the scratchbook filename from the design doc filename:
  - Design doc: `yyyy-mm-dd-something-design.md` → Scratchbook: `yyyy-mm-dd-something-scratchbook.md`
  - Place it in the same directory as the design document
- The scratchbook contains:
  - A reference to the design document (NOT a copy of its contents)
  - A task list with checkboxes (split the work into meaningful tasks — not too large, not too small)
  - A learnings section that grows as you implement
- Write the scratchbook now before starting implementation

### 3. Iterate through tasks

For each task in the scratchbook:

1. **Mark it in-progress** in the scratchbook
2. **Implement** the task — write the code, migration, test, etc.
3. **Run the implementation-validator agent** to check the implementation matches the design:
   ```
   Agent(subagent_type="implementation-validator", prompt="Validate that the implementation of [task description] matches the design document at [path]. Check for deviations, missing pieces, and errors.")
   ```
4. **Fix** any issues found by the validator
5. **Record learnings** — if you discovered anything non-obvious (gotchas, conventions, edge cases), add it to the scratchbook's Learnings section
6. **Mark the task done** in the scratchbook with a checkmark

### 4. Final review

When all tasks are complete:
- Run `/code-review` skill if available
- Update the scratchbook with a final status
