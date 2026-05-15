# Validator Agents Comparison: Haiku vs Sonnet vs Opus

**Date:** 2026-05-15  
**Task:** Validate `docs/plans/2026-05-15-bdd-coverage-design.md` using three parallel subagents  
**Agent definitions:** `.claude/agents/validator-{haiku,sonnet,opus}.md` — identical system prompt, differing only in `name`, `model`, and `color`

---

## Run 1 — Different prompts per tier (open-ended)

Each agent was given a different task scoped to its tier: Haiku checked file existence, Sonnet checked API correctness and routes, Opus did deep architectural review.

### Speed

| Agent | Duration | Tool calls |
|-------|----------|------------|
| Haiku | **5.4 s** | 1 |
| Sonnet | 46 s | 14 |
| Opus | **1 m 42 s** | 15 |

### Cost (est., ~80% input / 20% output)

| Agent | Total tokens | Est. cost |
|-------|-------------|-----------|
| Haiku | 18,355 | ~$0.03 |
| Sonnet | 19,189 | ~$0.10 |
| Opus | 32,753 | ~$0.88 |

### Findings

| Agent | Issues found | Real? | Unique to this model |
|-------|-------------|-------|----------------------|
| Haiku | 1 | Yes | — (also caught by Opus) |
| Sonnet | 3 (1 FAIL, 1 WARN, 1 bonus) | All real | playwright-bdd deprecation claim wrong; `steps` string-not-array WARN |
| Opus | 5 substantive (3 HIGH, 2 MEDIUM) | All real | `PRESERVE_TABLES` mismatch; wave-dependency conflation; `waitForHydration` quirk inversion; false-pass authz failure mode |

No false positives across any model.

---

## Run 2 — Identical prompt (controlled)

All three agents received the exact same five-check task. This isolates model behaviour from task design.

### Speed

| Agent | Duration | Tool calls | Total tokens |
|-------|----------|------------|-------------|
| Haiku | 13.6 s | 9 | 26,185 |
| Sonnet | 30.0 s | 11 | 15,334 |
| Opus | 31.0 s | 10 | 17,815 |

Notable: Haiku used the most tokens (verbose output format); Sonnet and Opus finished within 1 second of each other.

### Findings

All three returned the same verdicts: **4 PASS, 1 FAIL** (`index.md` vs `SKILL.md` naming in §2.1).

Where they diverged was in unprompted extras:

| Agent | Extra observation |
|-------|-----------------|
| Haiku | Noted the skill still invokes correctly via `/bdd-coverage` despite the naming mismatch |
| Sonnet | Flagged that §1.2 lists more routes beyond the six checked — scope gap, not a failure |
| Opus | Located `index.md` in **three** places in the doc (§2.1, §2.8, §3) — called it a systemic naming error; most actionable for fixing |

---

## Takeaways

**On task design:** open-ended tasks amplify model tier differences. Opus found five issues the others missed in Run 1 because it was asked to reason about runtime behaviour, not just structure. With a tightly scoped identical task in Run 2, all three converged on the same verdicts.

**On output depth:** with identical prompts, model tier affects *what extra value gets surfaced*, not correctness. Haiku stays literal. Sonnet flags scope gaps. Opus traces errors to all their locations.

**Natural validation pipeline:**
1. **Haiku** — cheap gate (~$0.03). Does everything referenced exist?
2. **Sonnet** — API and contract correctness (~$0.10).
3. **Opus** — architectural risk, subtle runtime behaviour (~$0.88). Use selectively.
