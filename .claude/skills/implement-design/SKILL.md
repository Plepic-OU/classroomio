---
name: implement-design
description: "Implement a design document step by step. Use when user says 'implement design', 'build this design', 'implement this plan', 'execute design doc', or wants to turn a design document into working code."
metadata:
  version: 1.0.0
  category: project
---

# Implement Design Document

Systematically implement a design document by breaking it into tasks, tracking progress in a scratchbook, and validating each step.

## Instructions

### Step 1: Identify the Design Document

If the user provided a path, use it. Otherwise, list design documents and ask which one:

```bash
ls docs/plans/*.md
```

Read the design document thoroughly before proceeding.

### Step 2: Create the Scratchbook

Derive the scratchbook filename from the design document:
- If design doc is `docs/plans/yyyy-mm-dd-something-design.md`, create `docs/plans/yyyy-mm-dd-something-scratchbook.md`
- If the name doesn't end in `-design`, just append `-scratchbook` before `.md`

The scratchbook is a living document — NOT a copy of the design doc. It references the design doc and tracks:
- Task breakdown with status
- Learnings discovered during implementation
- Decisions made that deviate from or clarify the design
- Blockers encountered and how they were resolved

Write the initial scratchbook:

```markdown
# Scratchbook: <feature name>

Design doc: @docs/plans/<design-doc-filename>
Started: <today's date>

## Tasks

- [ ] Task 1: <description>
- [ ] Task 2: <description>
- ...

## Learnings

(populated during implementation)
```

#### Task Granularity

Split the design into meaningful tasks — not too large (should be completable in one focused session), not too small (should represent a coherent unit of work). Good tasks:
- Create a single file or closely related group of files
- Implement one logical piece of functionality
- Wire up one integration point

Bad tasks:
- "Implement everything" (too large)
- "Add import statement" (too small)
- Tasks with unclear completion criteria

### Step 3: Iterate Through Tasks

For each task, follow this cycle:

#### 3a. Select Next Task

Pick the next unchecked task from the scratchbook. Announce which task you're working on.

#### 3b. Implement

Write the code for this task. Follow the design document's specifications. If the design doc references specific file paths, structures, or patterns — follow them.

#### 3c. Validate

After implementing, run the **implementation-validator** agent to check your work against the design document. Pass both the design document path and a description of what was just implemented.

```
Agent: implementation-validator
Prompt: Validate the implementation of [task description] against the design doc at [path]. Check git diff for the changes.
```

If the validator finds issues, fix them before moving on.

#### 3d. Record Learnings

If you discovered anything noteworthy during implementation — unexpected behavior, clarifications to the design, gotchas, useful patterns — add it to the **Learnings** section of the scratchbook.

#### 3e. Mark Task Complete

Update the scratchbook: change `- [ ]` to `- [x]` for the completed task.

#### 3f. Repeat

Go back to 3a and pick the next task. Continue until all tasks are complete.

### Step 4: Final Review

When all tasks are marked complete:

1. Run the **code-review** skill (`/code-review`) on the full set of changes
2. Update the scratchbook with a completion note and any final learnings

## Flags

This skill supports universal flags (see `.claude/references/skill-flags.md`):

- `--plan` / `-p`: Show the task breakdown without implementing anything
- `--help` / `-h`: Show usage information
- `--list` / `-l`: List available design documents in `docs/plans/`

## Important

- **Follow the design doc** — don't add features or make architectural changes not in the design
- **Keep the scratchbook updated** — it's the source of truth for progress
- **Validate after each task** — don't batch validate at the end
- **Record learnings** — future implementations benefit from captured knowledge
- **Small commits** — if the user wants commits, suggest one per task
- **Don't copy the design doc** — the scratchbook references it, doesn't duplicate it
