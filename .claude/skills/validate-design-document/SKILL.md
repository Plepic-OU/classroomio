---
name: validate-design-document
description: "Validate a design document by spawning project-specific expert subagents in parallel. Use after writing a design document."
---

# Validate Design Document

## Overview

Validate a ClassroomIO design document by spawning specialized expert subagents in parallel. Each expert reviews the document from their domain perspective and reports Critical / Warning / Note findings.

## Input

The design document path. If not provided, find the most recent file in `docs/plans/`.

## Step 1: Select Relevant Validators

Read the design document. Then decide which of the 8 validators below are relevant based on what the design touches. **If in doubt, include the validator.** Most designs will need 4-6 validators. Only skip a validator when the design clearly has zero overlap with its domain.

### The 8 Validators

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

## Step 2: Spawn Validators in Parallel

For each selected validator:

1. **Read** its prompt file from the `validators/` directory (paths are relative to this skill: `.claude/skills/validate-design-document/`)
2. **Replace** `{PATH}` in the prompt with the actual design document path
3. **Spawn** as a parallel foreground agent using `subagent_type: "general-purpose"`

Spawn **all selected validators in a single message** so they run in parallel.

### Context7 Requirement

Every validator prompt includes a "Context7" section instructing the agent to use the Context7 MCP (`mcp__context7__resolve-library-id` and `mcp__context7__get-library-docs`) to look up current documentation before reviewing. This ensures validators work with up-to-date API knowledge, not stale training data.

## Step 3: Triage and Apply Results

After all validators complete, classify every finding into one of three buckets:

### Bucket A: Auto-apply (confident, clear, no conflicts)

A finding is auto-apply when ALL of these are true:
- It is unambiguous — there is one obvious fix
- No other validator contradicts it
- It does not change the design's scope, architecture, or business requirements

**Action:** Apply these changes to the design document immediately. Then list what was changed.

### Bucket B: Conflicts (validators disagree)

Two or more validators give contradictory recommendations.

### Bucket C: Needs user input (uncertain or significant)

A finding that suggests a scope change, architectural shift, or a call that depends on context you don't have.

### Output Format

1. Apply all Bucket A changes to the design document.
2. Report a summary:

```
## Design Validation Results

**Validators run:** [list]
**Validators skipped:** [list with reasons]

### Auto-applied changes
- [change 1] — [which validator(s)]
- [change 2] — [which validator(s)]

[N conflicts and M items need your input. I'll ask one at a time.]
```

3. Then work through Buckets B and C **one at a time** using the `AskUserQuestion` tool. For each item:
   - Call `AskUserQuestion` with a single question
   - Set `header` to a short label (≤12 chars), e.g. "Fixture style"
   - Provide 2–4 options. For conflicts, each option is one validator's recommendation. For needs-input, each option is a concrete alternative.
   - For each option, write a `description` (trade-off in one sentence) and a `preview` (code snippet or file layout showing what the option looks like concretely)
   - After the user selects an option, apply the decision to the design document before moving on:
     1. **Search the entire document** for every place the rejected approach appears — not just the most obvious one. Use grep or Read to find all occurrences before editing.
     2. **Update every occurrence** — code snippets, prose descriptions, directory layouts, checklists, and examples must all be consistent with the chosen option.
     3. Confirm what was changed in one sentence, then call `AskUserQuestion` for the next item.

Do **not** present all conflicts and questions as a text list. Use `AskUserQuestion` for every Bucket B and C item, one call per message.

## Step 4: Write the Validation Report

After all decisions have been applied, write a report file that documents every change made to the design document during this session.

### Report path

Place it in `docs/plans/reports/`, named after the design document:
- Design: `docs/plans/2026-05-15-foo-design.md`
- Report: `docs/plans/reports/2026-05-15-foo-design-validation-report.md`

Create the `docs/plans/reports/` directory if it doesn't exist.

### Report format

```markdown
# Validation Report — [design document filename]

_Validated: [YYYY-MM-DD]_
_Validators run: [comma-separated list]_
_Validators skipped: [name — reason, ...]_

## Auto-applied changes

Changes applied without user input (unambiguous, no conflicts).

### [Section name from design doc]

| Area | Before | After |
|------|--------|-------|
| [what changed] | [old text/approach, quoted or summarised] | [new text/approach] |

(One table per section of the design doc that was touched. Skip sections with no changes.)

## Conflicts resolved

Changes where two or more validators disagreed and the user chose an option.

### [Topic]

**Options presented:**
- **[Option A label]** — [one-sentence description]
- **[Option B label]** — [one-sentence description]

**User chose:** [Option label] — [one sentence on what was updated in the doc as a result]

## User-input decisions

Changes where the right call depended on project context.

### [Topic] — [CRITICAL / WARNING]

**Options presented:**
- **[Option A label]** — [one-sentence description]
- **[Option B label]** — [one-sentence description]

**User chose:** [Option label] — [one sentence on what was updated in the doc as a result]
```

Report files are gitignored (`docs/plans/*-validation-report.md`) — they are working notes, not permanent documentation.
