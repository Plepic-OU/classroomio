---
name: implement-design-document
description: "Implement a ClassroomIO design document by breaking it into tasks, tracking progress in a scratchbook, iterating with validation, and finishing with a code review."
---

# Implement Design Document

Turn a design document into working code by working through it task by task, validating each step, and capturing learnings as you go.

## Input

The design document path. If not provided, find the most recent file matching `docs/plans/*-design.md`.

---

## Step 1 — Read the Design Document

Read the design document in full before doing anything else. Understand:
- What is being built and why
- What files will be created or changed
- What the acceptance criteria are
- Any non-obvious constraints or decisions already made

Do **not** start writing code yet.

---

## Step 2 — Split Into Tasks

Break the work into a flat list of tasks. Each task should be:

- **Completable in one focused session** — not "implement the whole feature", but also not "add one import"
- **Independently verifiable** — you can run a test, open a page, or check a file to confirm it worked
- **Ordered by dependency** — tasks that others depend on come first

Good task granularity examples:
- "Create `helpers/supabase.ts` with `getOrgSlug` and `getCourseId`"
- "Add `LessonPage` page object and wire it into `fixtures.ts`"
- "Write `lesson-creation.feature` and step file; verify test passes"

Bad granularity examples (too large):
- "Implement the lesson creation feature"

Bad granularity examples (too small):
- "Add import statement for `getOrgSlug`"

Aim for 3–8 tasks total. If a design naturally splits into more, group related sub-tasks under one task.

---

## Step 3 — Create the Scratchbook

Derive the scratchbook filename from the design document filename:

| Design doc | Scratchbook |
|---|---|
| `docs/plans/2026-03-20-e2e-expansion-design.md` | `docs/plans/2026-03-20-e2e-expansion-scratchbook.md` |

Create the scratchbook with this template:

```markdown
# Scratchbook — <title from design doc>

**Design doc:** [<filename>](<relative-path-to-design-doc>)
**Status:** In progress

## Tasks

- [ ] Task 1: <description>
- [ ] Task 2: <description>
- [ ] Task 3: <description>
...

## Learnings

_Notes about surprises, deviations from the design, or patterns discovered during implementation. Do not copy content from the design doc — reference it._
```

The scratchbook is **not** a copy of the design document. It holds:
1. The task checklist (source of truth for progress)
2. Learnings discovered during implementation (deviations, surprises, useful patterns)

---

## Step 4 — Implement Task by Task

Repeat this loop for each unchecked task:

### 4a — Select the next task

Pick the first unchecked task from the scratchbook. Read anything relevant in the codebase before touching it — do not assume structure from the design doc alone.

### 4b — Implement the task

Write the code. Prefer editing existing files over creating new ones. Follow existing patterns in the codebase.

### 4c — Run the implementation-validator agent

After completing the task, spawn the `implementation-validator` agent to verify the work:

```
Use the Agent tool with subagent_type="implementation-validator".
Prompt: "Validate the implementation of [task description].
Design doc: <path>.
Files changed: <list changed files>."
```

Review the validator's findings. Fix any Critical issues before moving on. Use judgment on Warnings — apply them if they are clearly correct and in scope.

### 4d — Update the scratchbook

If anything was surprising, different from the design doc, or worth remembering for later tasks — add it to the **Learnings** section. Keep notes short and factual.

Mark the task done in the scratchbook:

```markdown
- [x] Task 1: <description>
```

Then pick the next task and repeat from 4a.

---

## Step 5 — Final Code Review

When all tasks are checked off, run the `code-review` skill if it is available in the system prompt skills list.

If `code-review` is not available, do a self-review: read every file you created or modified and check for:
- Unused imports or dead code
- Inconsistency with surrounding code style
- Missing error handling at system boundaries (user input, external APIs)
- Acceptance criteria from the design doc — confirm each one is met

---

## Step 6 — Mark Complete

Update the scratchbook status line:

```markdown
**Status:** Complete
```

Report a brief summary to the user:
- Tasks completed
- Any acceptance criteria that are not yet met (and why)
- Any open questions or follow-up items
