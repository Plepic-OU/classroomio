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

Read the design document. Then decide which of the 9 validators below are relevant based on what the design touches. **If in doubt, include the validator.** Most designs will need 4-6 validators. Only skip a validator when the design clearly has zero overlap with its domain.

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

**Action:** Apply these changes to the design document immediately. Then list what was changed so the user is informed.

### Bucket B: Conflicts (validators disagree)

Two or more validators give contradictory recommendations (e.g., one says add an API endpoint, another says use a direct Supabase call; one says add a component, simplifier says reuse an existing one).

**Action:** Present each conflict with the competing recommendations side by side. Ask the user to decide.

### Bucket C: Needs user input (uncertain or significant)

A finding that:
- Suggests a scope change or architectural shift
- Could go either way — reasonable arguments on both sides
- Is a WARNING/NOTE where the right call depends on context you don't have

**Action:** List these and ask the user which to accept, reject, or modify.

### Output Format

Present results in this order:

```
## Design Validation Results

**Validators run:** [list]
**Validators skipped:** [list with reasons]

### Auto-applied changes
- [change 1] — [which validator(s)]
- [change 2] — [which validator(s)]
- ...

### Conflicts (need your decision)

**Conflict 1: [topic]**
- [Validator A] recommends: ...
- [Validator B] recommends: ...

**Conflict 2: [topic]**
- ...

### Recommendations needing your input
- [finding 1] — [severity] — [which validator]
- [finding 2] — [severity] — [which validator]
- ...
```

After the user responds to Buckets B and C, apply the accepted changes to the design document.
