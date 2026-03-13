---
name: validate-design-document
description: "Validate a design document by spawning project-specific expert subagents in parallel. Use after writing a design document."
metadata:
  version: 2.0.0
  category: quality
---

# Validate Design Document

## Overview

Validate a ClassroomIO design document by spawning specialized expert subagents in parallel. Each expert reviews the document from their domain perspective and reports Critical / Warning / Note findings. Results are applied interactively, producing a new versioned copy of the document.

## Input

The design document path. Supports three resolution modes:

1. **Exact path** — e.g., `docs/plans/2026-03-13-bdd-playwright-v1.md`
2. **Fuzzy search** — e.g., `bdd`, `playwright`, `auth`. Search `docs/plans/` for files whose name contains the query (case-insensitive). If multiple matches, list them and ask the user to pick one.
3. **No argument** — find the most recent file in `docs/plans/` by modification time.

## Step 1: Resolve Document & Determine Version

1. Resolve the input to a single file using the rules above.
2. Detect the current version from the filename:
   - Pattern: `*-v<N>.md` (e.g., `-v1.md`, `-v2.md`)
   - If no version suffix, treat as v0
3. The **output file** will be the same base name with the next version number:
   - `2026-03-13-bdd-playwright-v1.md` → `2026-03-13-bdd-playwright-v2.md`
   - `2026-03-13-bdd-playwright-v2.md` → `2026-03-13-bdd-playwright-v3.md`
   - `my-design.md` (no version) → `my-design-v1.md`

## Step 2: Select Relevant Validators

Read the design document. Then decide which of the 9 validators below are relevant based on what the design touches. **If in doubt, include the validator.** Most designs will need 4-6 validators. Only skip a validator when the design clearly has zero overlap with its domain.

### The 9 Validators

| # | Validator | Prompt file | When to include |
|---|-----------|-------------|-----------------|
| 1 | Supabase & Database | `validators/supabase-database.md` | Touches data storage, queries, or schema |
| 2 | Auth & Permissions | `validators/auth-permissions.md` | Access control, roles, or user identity |
| 3 | SvelteKit Frontend | `validators/sveltekit-frontend.md` | UI, routing, stores, or components |
| 4 | API Contract | `validators/api-contract.md` | Hono API, type sharing, or server endpoints |
| 5 | Monorepo & Integration | `validators/monorepo-integration.md` | Multiple packages or build pipeline |
| 6 | Devcontainer | `validators/devcontainer.md` | Local dev setup, Docker, or dev environment |
| 7 | E2E Tests | `validators/e2e-tests.md` | E2E/integration tests, Playwright, BDD, test selectors, or test data |
| 8 | Simplifier | `validators/simplifier.md` | **Always include** (cuts unnecessary complexity) |
| 9 | General Design Quality | `validators/general-design-quality.md` | **Always include** (catches what specialists miss) |

## Step 3: Spawn Validators in Parallel

For each selected validator:

1. **Read** its prompt file from the `validators/` directory (paths are relative to this skill: `.claude/skills/validate-design-document/`)
2. **Replace** `{PATH}` in the prompt with the actual design document path
3. **Spawn** as a parallel foreground agent using `subagent_type: "general-purpose"`

Spawn **all selected validators in a single message** so they run in parallel.

### Context7 Requirement

Every validator prompt includes a "Context7" section instructing the agent to use the Context7 MCP (`mcp__context7__resolve-library-id` and `mcp__context7__get-library-docs`) to look up current documentation before reviewing. This ensures validators work with up-to-date API knowledge, not stale training data.

## Step 4: Triage Results

After all validators complete, classify every finding into one of three buckets:

### Bucket A: Auto-apply (confident, clear, no conflicts)

A finding is auto-apply when ALL of these are true:
- It is unambiguous — there is one obvious fix
- No other validator contradicts it
- It does not change the design's scope, architecture, or business requirements

### Bucket B: Conflicts (validators disagree)

Two or more validators give contradictory recommendations (e.g., one says add an API endpoint, another says use a direct Supabase call; one says add a component, simplifier says reuse an existing one).

### Bucket C: Needs user input (uncertain or significant)

A finding that:
- Suggests a scope change or architectural shift
- Could go either way — reasonable arguments on both sides
- Is a WARNING/NOTE where the right call depends on context you don't have

## Step 5: Interactive Update Mode

Present results and walk through fixes one by one. This replaces the old bulk-apply approach.

### 5a: Show Summary

```
## Design Validation Results

**Document:** <input file> → <output file (next version)>
**Validators run:** [list]
**Validators skipped:** [list with reasons]
**Findings:** X auto-apply, Y conflicts, Z need input
```

### 5b: Copy Source to Next Version

Before applying any changes, copy the input document to the output version path. All edits are applied to the new version file — the original is never modified.

**One version bump per session:** If the output version file already exists (i.e., this skill was already run in this conversation), reuse it — do NOT increment again. Only create a new version file on the first run.

### 5c: Walk Through Fixes

Present findings **one at a time** in priority order: Critical → Warning → Note. For each finding:

```
### [N/total] [severity] — [topic]
**Validator:** [which validator(s)]
**Bucket:** [A: auto-apply | B: conflict | C: needs input]

[description of the finding and recommended change]

> Apply? (y/n/edit)
```

- **Bucket A findings:** Default is apply. Show what will change and say "Applying (auto). Reply 'n' to skip." — then apply immediately unless the user objects.
- **Bucket B findings (conflicts):** Show both sides, ask user to pick one or skip.
- **Bucket C findings:** Present the recommendation, ask user to accept, reject, or modify.

User responses:
- **y** or no response for auto-apply — apply the fix to the new version file
- **n** — skip, move to next finding
- **edit** — user provides modified version of the fix, apply that instead

### 5d: Completion

After all findings are processed, show a summary of everything that changed between the input and output versions:

```
## Done

**Output:** <path to new version file>
**Applied:** X of Y findings
**Skipped:** Z findings

### Changes summary
1. [Section: ...] — [what changed and why] — [validator]
2. [Section: ...] — [what changed and why] — [validator]
...

### Skipped findings
1. [topic] — [reason skipped] — [validator]
...
```

This gives the user a complete picture of how the new version differs from the original without needing to diff the files manually.
