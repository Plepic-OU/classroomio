---
name: score-design-document
description: "Score a design document by checking individual True/False/N/A attributes from attributes.md. Use when the user asks to score, rate, grade, or check a design doc against criteria. Pure read-only — never edits any file."
---

# score-design-document

Score one design document against the attribute catalogue in `attributes.md`. Produce a per-attribute T / F / N/A
table, per-category tallies, and a failures-only punch list.

## Hard contract

- **Read-only.** Never write, edit, or append to any file — not the design doc, not `attributes.md`, not anything.
- **No subagents.** Single pass in the main context.
- **No Context7 / library-docs lookups.** Tech currency is the validator's job, not the scorer's.
- **No coarse standalone grade** (no 1–5, no letter grade). The Summary block does include a derived percentage of
  applicable attributes that are true — this is fine because it is computed from the table, not vibes.

If the user asks for behaviour outside this contract (e.g. "score and fix the gaps," "rewrite the doc"), score
first, then tell the user the editing step is outside this skill.

## Input

```
/score-design-document [path]
```

If `[path]` is omitted, pick the most recent `*.md` file in `docs/plans/` (sort by mtime).

## Execution

1. **Resolve the doc path.** If none given, run `ls -t docs/plans/*.md | head -1` (or equivalent) and pick the first.
2. **Read `attributes.md`** from this skill's directory (`.claude/skills/score-design-document/attributes.md`).
   Parse the categories (each `## ` heading except the intro) and the attributes under each (each `- **Name**` bullet
   with its `Description:` and `Applies when:` sub-bullets).
3. **Read the design doc.** Read the entire file. If a `## Lessons` section exists, it is part of the doc — read it
   like any other section. There is no special handling.
4. **Score each attribute** in a single pass. For each:
   - Decide **T** (the doc satisfies the attribute), **F** (the doc fails it), or **N/A** (the `Applies when:` hint
     genuinely does not match this doc).
   - Use `Applies when:` as guidance, not a hard gate. If in doubt between F and N/A, prefer F — a missing detail
     is more useful as a punch-list item than as a skip.
   - Capture **evidence in ≤15 words**:
     - For T: a short literal quote from the doc.
     - For F: a one-line reason (e.g. "no rollback section; only happy-path described").
     - For N/A: a one-line reason (e.g. "pure RFC, no implementation work").
5. **Compute the Summary** from the table: count applicable (T + F, excluding N/A), compute T / (T + F) as a whole
   percent, pick strongest and weakest categories by the same per-category percent (ties broken by larger T + F), and
   write a ≤3-sentence final word grounded in those numbers.
6. **Emit the output** in the format below — Summary first, then table, then tallies, then punch list. No file writes.

## Output format

Four blocks, in this order: Summary, per-attribute table, per-category tallies, F-only punch list.

### Block 1 — Summary

```markdown
### Summary

- **Applicable attributes:** 21 of 27 (N/A excluded: 6)
- **Result:** 14 T / 7 F — **67 % true** of applicable
- **Strongest category:** Concreteness (4 T / 0 F / 0 N/A)
- **Weakest category:** Post-ship reconciliation (0 T / 4 F / 1 N/A)
- **Final word:** Design is concrete and well-sequenced for implementation, but skips the "why" framing and has
  drifted from shipped reality — the body still describes a design that is no longer accurate.
```

Rules:

- **Result percentage = T / (T + F), rounded to whole percent.** N/A is never in the denominator.
- **Strongest / weakest category** by the same per-category percentage. Ties broken by larger T + F (more evidence).
  If every applicable category scores 100 % or 0 %, fall back to T + F count to break the tie.
- **Final word** is at most three sentences. It must reference what the table shows (strongest dimension, weakest
  dimension, one judgement like "near-final", "needs problem framing", "stale and needs reconciliation"). It is
  **not** a grade. It is **not** a recommendation list — the punch list (Block 4) is the recommendation.
- If every applicable attribute is N/A (no T or F at all), write `**Result:** no applicable attributes — nothing to
  score`. Skip strongest/weakest. Final word should explain why (e.g. "doc is a pure RFC with no implementation
  signal").

### Block 2 — Per-attribute table

```markdown
| Category | Attribute | Result | Evidence |
|---|---|---|---|
| Problem framing | Problem stated concretely | T | "auth middleware mutates a global, blocking parallel tests" |
| Problem framing | Why-now / motivating trigger | F | no trigger named |
| Architecture fit | Data model changes specified | N/A | no schema changes |
```

One row per attribute, in `attributes.md` order. Quotes in the Evidence column should be verbatim from the doc.

### Block 3 — Per-category tallies

```markdown
- **Problem framing:** 2 T / 1 F / 0 N/A
- **Scope & maturity:** 1 T / 2 F / 0 N/A
- **Concreteness:** 3 T / 1 F / 0 N/A
- **Architecture fit:** 2 T / 0 F / 3 N/A
- **Testability & risk:** 1 T / 2 F / 1 N/A
- **Implementation plan:** 2 T / 1 F / 0 N/A
- **Post-ship reconciliation:** 0 T / 0 F / 5 N/A
```

One bullet per category, in `attributes.md` order. Count exactly — the totals must match the table.

### Block 4 — F-only punch list

```markdown
**Gaps to fix (failures only):**

- Scope & maturity — Out-of-scope explicitly listed: no "out of scope" section.
- Testability & risk — Test strategy stated: only "we'll write tests" without unit/integration/e2e boundary.
- Implementation plan — Success criteria measurable: success defined as "users like it."
```

List every F from Block 1 with `Category — Attribute: reason`. If there are no F items, write
`No failed attributes.`

## Scoring rules of thumb

- **Quote when you can.** If you mark T, include a short literal quote — proves you saw the evidence.
- **Be specific in F reasons.** "Not addressed" is worse than "no rollback section; only happy-path described."
- **N/A is for genuinely-out-of-domain.** A UI-only design genuinely has no data model. But "design proposes
  implementation but names no file paths" is F, not N/A.
- **Lessons attributes only apply when shipped.** Use `git log` on referenced file paths only if a quick check is
  cheap. If you can't tell whether the design has shipped, mark Post-ship reconciliation attributes N/A and note
  "shipped status unknown" in evidence.

## When you finish

End the response with the four output blocks, in order. The Summary's final word is the qualitative judgement; the
punch list is the recommendation list. Nothing else.
