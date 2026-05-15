# Validator Agents Comparison: Haiku vs Sonnet vs Opus

**Date:** 2026-05-15  
**Task:** Validate `docs/plans/2026-05-15-bdd-coverage-design.md` using three parallel subagents

---

## Speed

| Agent | Duration | Tool calls |
|-------|----------|------------|
| Haiku | **5.4 s** | 1 |
| Sonnet | 46 s | 14 |
| Opus | **1 m 42 s** | 15 |

Haiku was 8× faster than Sonnet and 19× faster than Opus. The gap is not just model speed — Haiku finished in a single tool call (a file listing), while Sonnet and Opus each made 14–15 calls to read multiple source files before reasoning.

---

## Cost

Only total tokens are reported (no input/output split), so these are estimates assuming ~80% input / 20% output:

| Agent | Total tokens | Est. cost |
|-------|-------------|-----------|
| Haiku | 18,355 | ~$0.03 |
| Sonnet | 19,189 | ~$0.10 |
| Opus | 32,753 | ~$0.88 |

Opus costs roughly **30× more than Haiku** and **9× more than Sonnet**. Opus also generated more output (longer reasoning chains), which is priced at ~19× Haiku's output rate.

---

## Findings

| Agent | Issues found | Real? | Unique to this model |
|-------|-------------|-------|----------------------|
| Haiku | 1 | Yes | — (also caught by Opus) |
| Sonnet | 3 (1 FAIL, 1 WARN, 1 bonus) | All real | Deprecation claim wrong; `steps` string-not-array WARN |
| Opus | 5 substantive (3 HIGH, 2 MEDIUM) | All real | `PRESERVE_TABLES` mismatch; wave-dependency conflation; `waitForHydration` quirk inversion; false-pass authz failure mode |

No false positives across any model — every finding was grounded in actual file reads.

### What each model missed

**Haiku** missed everything beyond file existence. It cannot reason about whether the content of those files matches the doc.

**Sonnet** missed the four architectural defects Opus found. It stayed in its lane (API contracts, route existence, config shape) and did that well.

**Opus** found what no one else did — the two highest-value findings:
- The `PRESERVE_TABLES` mismatch (Wave 2 will silently break at runtime because `course_type` and `resource_type` are not preserved, despite the doc claiming they are)
- The `is_org_admin()` false-pass failure mode (the `@known-failing` tag strategy is the wrong tool for a bug that causes spurious passes, not failures)

Both required reading multiple files and reasoning about runtime behavior, not just structure.

---

## Takeaway

The three tiers form a natural validation pipeline:

1. **Haiku first** — cheap gate ($0.03). Does everything referenced actually exist?
2. **Sonnet second** — API and contract correctness ($0.10).
3. **Opus only for high-stakes decisions** — architectural risk, subtle runtime behaviour ($0.88).

For this design doc, Haiku's $0.03 run caught nothing Opus didn't also catch — its value would be higher earlier in the process, when the doc still has obvious structural gaps.
