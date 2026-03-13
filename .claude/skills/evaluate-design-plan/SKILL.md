---
name: evaluate-design-plan
description: "Rate a design plan document against a boolean checklist of quality criteria. Outputs a score (yes-count / total) with per-criterion results."
---

# Evaluate Design Plan

## Overview

Evaluate a design plan document by checking it against a fixed set of boolean (Yes/No) criteria. The final rating is the ratio of "Yes" answers to total criteria count, expressed as a fraction and percentage.

## Input

The design plan document path. If not provided, find the most recent file in `docs/plans/`.

## Step 1: Read the Document

Read the design plan document in full.

## Step 2: Evaluate Each Criterion

For each criterion below, determine **Yes** or **No**. A criterion is "Yes" only if the document clearly and explicitly addresses it — do not infer or assume.

### Criteria Checklist

| #  | Criterion | Question |
|----|-----------|----------|
| 1  | Goal | Does the plan state a clear business or technical goal? |
| 2  | Success Criteria | Does the plan define measurable success criteria or acceptance conditions? |
| 3  | Steps Defined | Does the plan have a series of concrete implementation steps or tasks? |
| 4  | Logical Order | Are the steps in a logical, dependency-respecting order? |
| 5  | Scope Defined | Does the plan clearly define what is in scope? |
| 6  | Out of Scope | Does the plan explicitly state what is out of scope? |
| 7  | Directory/File Structure | Does the plan describe the directory or file structure affected? |
| 8  | Dependencies | Does the plan list external dependencies, libraries, or services needed? |
| 9  | Configuration | Does the plan cover configuration or environment setup? |
| 10 | Data Model | Does the plan describe data models, schemas, or data flow (if applicable)? |
| 11 | Error/Edge Cases | Does the plan address error handling or edge cases? |
| 12 | Testing Strategy | Does the plan describe how the work will be tested? |
| 13 | Developer Workflow | Does the plan explain how a developer will use or run the result? |
| 14 | Incremental Delivery | Can the plan be executed incrementally (not all-or-nothing)? |
| 15 | No Ambiguity | Are the steps specific enough that two developers would implement them the same way? |

## Step 3: Output the Results

Present results in this exact format:

```
## Design Plan Evaluation

**Document:** [path]
**Rating:** [yes-count] / [total] ([percentage]%)

### Criteria Results

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| 1 | Goal | ✅ Yes / ❌ No | [brief justification] |
| 2 | Success Criteria | ✅ Yes / ❌ No | [brief justification] |
| ... | ... | ... | ... |

### Summary

**Strengths:** [1-2 sentences on what the plan does well]

**Gaps:** [1-2 sentences on the most impactful missing criteria, if any]
```

## Key Principles

- **Binary only** — each criterion is strictly Yes or No, no partial credit
- **Evidence-based** — cite the relevant section or explain why it's missing
- **Brief notes** — keep justifications to one sentence each
- **No modifications** — this skill evaluates only, it does not edit the document
