---
name: generic-design-review
description: "Validate a design document with a single general-purpose reviewer that has no project-specific knowledge. A baseline to compare against validate-design-document."
---

# Generic Design Review

## Overview

Validate a design document with one general-purpose reviewer. Unlike
`validate-design-document`, this skill does not fan out into project-specific
experts and does not look anything up about the codebase. It is a deliberate
baseline: run it alongside the specialised validators and compare what each catches.

## Input

The design document path. If not provided, find the most recent file in `docs/plans/`.

## Step 1: Spawn the reviewer

Spawn a single agent using `subagent_type: "general-purpose"` with the prompt below,
replacing `{PATH}` with the actual design document path.

```
Review the design document at {PATH} on general engineering merit.

Assume no special knowledge of this codebase, its frameworks, or its conventions.
Judge only what the document itself says. Do not read the codebase, look up library
docs, or assume project-specific context. If the document depends on something it
never explains, that gap is itself a finding.

## What to check

GOAL & SCOPE
- Is the problem being solved stated clearly, before any solution?
- Is the target maturity explicit (prototype / MVP / production)?
- Is anything in scope that should be cut, or missing that must be there?

REQUIREMENTS
- Are success criteria concrete and checkable, not vague?
- Are inputs, outputs, and expected behaviour defined?
- Are error cases, edge cases, and failure modes addressed?

ARCHITECTURE
- Does the proposed structure actually deliver the stated goal?
- Is it the simplest approach that works, or is it over-engineered? (YAGNI)
- Are the moving parts and their responsibilities clear?

TESTABILITY
- Is there a testing strategy?
- Can each part be verified in isolation?

RISKS & UNKNOWNS
- What are the technical risks and unstated assumptions?
- What happens if a key assumption is wrong? Is there a fallback?

## Output

Report findings grouped by severity:
- CRITICAL: a flaw that must be resolved before building
- WARNING: should be addressed before implementation
- NOTE: an improvement worth considering

Start with "## Generic Design Review", then the categorized findings. Be specific:
quote or point to the part of the document each finding refers to.
```

## Step 2: Present the findings

Show the reviewer's findings to the user as-is, preserving the CRITICAL / WARNING /
NOTE grouping. Do not apply changes automatically — this baseline is for comparison.
