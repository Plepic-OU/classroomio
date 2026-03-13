---
name: score-design
description: "Score a design document using true/false attributes across completeness, feasibility, clarity, and safety. No numeric scores — just observable pass/fail properties."
---

# Score Design Document

## Overview

Evaluate a design document by assessing a set of true/false attributes. Each attribute is a concrete, observable property — either the document has it or it doesn't. No subjective numeric scores.

## Input

The design document path. If not provided, find the most recent file in `docs/plans/`.

## How to Score

Read the design document thoroughly. For each attribute below, determine **true** or **false** by checking the document content and, where needed, cross-referencing the codebase.

Be strict. "Partially" = false. The attribute must be clearly and fully satisfied.

## Attributes

### Completeness — Does the document cover what's needed?

| # | Attribute | How to assess |
|---|-----------|---------------|
| C1 | **States what it's building and why** | There is a clear goal or problem statement, not just a list of changes |
| C2 | **Defines scope boundaries** | There is an explicit "what's not in scope" or "out of scope" section |
| C3 | **Covers error/failure scenarios** | At least one error path, failure mode, or edge case is described |
| C4 | **Specifies test data or test strategy** | Describes what data tests use, where it comes from, or how the feature is verified |
| C5 | **Has a rollback plan** | Describes how to undo the change if something goes wrong |
| C6 | **Lists all new dependencies** | Every new library, service, or tool is named with its purpose |
| C7 | **Documents environment requirements** | New env vars, ports, services, or infrastructure are listed |

### Feasibility — Can this actually be built as described?

| # | Attribute | How to assess |
|---|-----------|---------------|
| F1 | **Uses existing project patterns** | Read the codebase — the design follows established conventions (file structure, naming, frameworks) rather than introducing novel patterns |
| F2 | **References real files/components** | Named files, routes, components, or tables exist in the codebase (or are clearly marked as new) |
| F3 | **Dependencies are compatible** | Named libraries work with the project's runtime (Node version, framework versions). Use Context7 MCP to verify if unsure |
| F4 | **No orphan references** | Every file, function, or config mentioned in one section is consistent with other sections (e.g., a file in the structure diagram is also described in the text) |
| F5 | **Data exists or is created** | Seed data, database tables, API endpoints, or other data sources referenced by the design actually exist or the design includes their creation |

### Clarity — Can a developer implement this without guessing?

| # | Attribute | How to assess |
|---|-----------|---------------|
| L1 | **No ambiguous pronouns or references** | Every "it", "this", "the service" resolves to a specific, named thing |
| L2 | **Config values are concrete** | Ports, URLs, file paths, env var names are actual values, not placeholders like "the appropriate port" |
| L3 | **Steps are ordered or independent** | If implementation order matters, it's stated. If not, sections are self-contained |
| L4 | **Jargon is project-consistent** | Terms match what's used in CLAUDE.md and the codebase (e.g., "dashboard" not "frontend app", "org" not "organization") |

### Safety — Does it avoid introducing risk?

| # | Attribute | How to assess |
|---|-----------|---------------|
| S1 | **No secrets in the document** | No API keys, passwords, or tokens appear in the design (references to env vars are fine) |
| S2 | **Auth/permissions are addressed** | If the feature touches user data or actions, the design states who can do what. If auth is irrelevant, this is true by default |
| S3 | **No destructive operations without safeguards** | Deletes, drops, resets, or overwrites have confirmation, backup, or scoping described |
| S4 | **Existing functionality is preserved** | The design does not remove or break existing features without calling it out explicitly |

## Output Format

Present results as a scorecard:

```
## Design Scorecard: <document name>

### Completeness
- [x] C1: States what it's building and why
- [ ] C2: Defines scope boundaries
- ...

### Feasibility
- [x] F1: Uses existing project patterns
- ...

### Clarity
- [x] L1: No ambiguous pronouns or references
- ...

### Safety
- [x] S1: No secrets in the document
- ...

### Summary
**Passing: 15/20**

Failing attributes:
- **C3**: No error scenarios described — the design only covers the happy path
- **F4**: `global-setup.ts` is in the file tree but removed from the config section
- ...
```

For each failing attribute, write one sentence explaining what's missing or wrong. Keep it actionable — the author should know exactly what to fix.

## When to Use

- After `/validate-design-document` has been run and changes applied
- As a final quality gate before implementation begins
- When comparing multiple design approaches
