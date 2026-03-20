# Agent Comparison Analysis: Sonnet vs Haiku Design Plan Evaluation

**Date:** 2026-03-13
**Document evaluated:** `docs/plans/2026-03-13-bdd-playwright-setup-design.md`
**Reference baseline:** Opus evaluation (14/15, 93%) — performed in the main conversation prior to agent runs.

---

## 1. Performance Summary

| Metric | Sonnet (quick-task-runner) | Haiku (haiku-worker) |
|--------|---------------------------|----------------------|
| **Rating** | 13 / 15 (87%) | 14 / 15 (93%) |
| **Total tokens** | 23,679 | 28,054 |
| **Duration** | 30.6 s | 15.3 s |
| **Criteria marked ❌** | #10 Data Model, #12 Testing Strategy | (none fully ❌) |
| **Criteria marked ⚠️** | (none) | #10 Data Model (partial) |
| **Matches Opus baseline** | 12 of 15 criteria agree | 14 of 15 criteria agree |

---

## 2. Where the Agents Diverged

### Criterion 10 — Data Model

| Agent | Verdict | Reasoning |
|-------|---------|-----------|
| **Opus** | ✅ Yes | Section 6 describes test data strategy — seed data, specific accounts, rationale for no teardown. Treated the test data strategy as sufficient for the "data model" criterion. |
| **Sonnet** | ❌ No | Demanded a data-flow diagram or type-level description of how data moves between fixtures, steps, and page objects. Found the prose-only description insufficient. |
| **Haiku** | ⚠️ Partial | Acknowledged the test data strategy exists but noted missing Supabase schema details and data flow documentation. Used a "partial" label rather than binary Yes/No. |

**Analysis:** Sonnet applied the strictest interpretation — requiring an explicit data model or data-flow diagram, not just a test data strategy. Haiku took a middle-ground approach (⚠️ Partial) but ultimately counted it as a Yes in the final tally, matching Opus. The evaluation rubric specifies "Yes only if the document clearly and explicitly addresses it" and includes the qualifier "if applicable." For a test scaffolding plan (not a feature with new database tables), the test data strategy in Section 6 is arguably sufficient. Sonnet's stricter reading is defensible but arguably over-applies the criterion to a plan where no new data models are introduced.

### Criterion 12 — Testing Strategy

| Agent | Verdict | Reasoning |
|-------|---------|-----------|
| **Opus** | ✅ Yes | The entire document *is* a testing strategy — feature files with scenarios are fully specified. |
| **Sonnet** | ❌ No | Distinguished between "how the code will be tested" (Yes — that's the plan itself) and "how we verify the test scaffolding is correct" (No — no meta-testing/smoke-run step). Argued the plan needs a strategy for validating the setup itself. |
| **Haiku** | ✅ Yes | Treated the feature files, page object pattern, and developer workflow as a comprehensive testing strategy. |

**Analysis:** This is the most interesting divergence. Sonnet introduced a meta-level distinction: the plan describes *what* tests to write, but not *how to verify the test infrastructure works*. This is a sophisticated reading — it's asking "who tests the tests?" However, the rubric asks "Does the plan describe how the work will be tested?" For a plan whose deliverable *is* a test suite, the natural reading is that the feature files and developer workflow (Section 7, step 4: "Run tests headless") constitute the testing strategy. Sonnet's interpretation, while intellectually interesting, reads more into the criterion than intended.

### Criterion 15 — No Ambiguity

All three agents agreed ✅ Yes, but for different reasons:

- **Opus** rated this ❌ No in the earlier main-conversation evaluation, citing step definitions lacking concrete code
- **Sonnet** rated ✅ Yes, citing method signatures, locator strategies, and the `getByLabel()` note
- **Haiku** rated ✅ Yes, citing exact port numbers, locator priority rules, and seed credentials

**Note:** The Opus baseline evaluation (in the main conversation) actually scored 14/15 with criterion 15 as the sole ❌, flagging that step definitions describe patterns but omit implementation code. Neither Sonnet nor Haiku caught this gap.

---

## 3. Quality of Justifications

### Sonnet Strengths
- **Deeper analytical reasoning**: The meta-testing argument on criterion 12 shows Sonnet thinking beyond surface-level evaluation. It asked "how do we know the scaffolding works?" — a genuinely useful question for a plan author.
- **More specific evidence**: Cited exact section numbers and quoted text more precisely (e.g., "Section 0 states explicitly: '...'" with full quote).
- **Stronger summary**: The gaps section connected two missing criteria into a coherent narrative about verifiability.
- **Stricter standard**: Applying a higher bar can be valuable for catching real weaknesses in plans.

### Haiku Strengths
- **2x faster execution**: Completed in 15.3s vs 30.6s — half the wall-clock time.
- **Closer to baseline**: 14/15 criteria matched the Opus reference evaluation, suggesting better calibration to the intended rubric.
- **Pragmatic interpretation**: Correctly recognized that a plan for building a test suite inherently addresses "testing strategy" without needing meta-testing.
- **Appropriate scope**: Evaluated the data model criterion proportionally — the plan introduces no new data models, so the test data strategy is adequate.
- **No protocol violations**: Despite using ⚠️ Partial (not strictly binary), the final count correctly reflected a Yes, showing good judgment on borderline cases.

### Haiku Weaknesses
- **Less precise citations**: Used shorter, less specific references (e.g., "Section 6 describes test data strategy" without quoting).
- **Introduced non-binary label**: The ⚠️ Partial on criterion 10 violates the rubric's "strictly Yes or No" instruction, even though the final tally treated it as Yes.
- **Missed criterion 15 gap**: Did not identify the step definitions' lack of implementation code as potential ambiguity.

### Sonnet Weaknesses
- **Over-interpreted criteria**: The meta-testing reading of criterion 12 goes beyond the rubric's intent for a plan whose deliverable is itself a test suite.
- **Slower**: Took twice as long with fewer tokens used, suggesting more reasoning overhead.
- **Missed criterion 15 gap**: Same as Haiku — did not catch the step definition ambiguity that Opus flagged.

---

## 4. Verdict

**Haiku performed better overall for this task.**

### Why Haiku Won

1. **Accuracy**: Haiku's 14/15 rating more closely matched the Opus baseline (also 14/15, though disagreeing on which criterion was ❌). Its pragmatic interpretations of criteria 10 and 12 are more defensible given the rubric's wording and the plan's nature as a test infrastructure document.

2. **Speed**: At 15.3s vs 30.6s, Haiku delivered results in half the time. For a structured evaluation task with clear criteria, the additional reasoning time Sonnet spent did not translate into a more accurate result — it produced a *different* result that happened to be more conservative but less well-calibrated.

3. **Cost efficiency**: Haiku used more tokens (28k vs 24k) but at a fraction of the per-token cost, making it significantly cheaper for equivalent or better output quality.

4. **Right level of strictness**: Sonnet's stricter standards (demanding meta-testing, requiring data-flow diagrams) are intellectually interesting but risk penalizing well-scoped plans for not addressing concerns outside their stated scope. Haiku better matched the "evaluate what's written against the criteria as stated" intent.

### Where Sonnet Would Win

Sonnet's deeper reasoning would be more valuable for:
- Evaluating complex architectural plans where subtle gaps have real consequences
- Plans with genuinely ambiguous language that needs careful parsing
- Situations where the evaluator needs to *generate recommendations* rather than just rate

### Recommendation

For **design plan evaluation** (a structured, criteria-based task): prefer **Haiku** — it's faster, cheaper, and better calibrated to the rubric.

For **design plan creation or improvement** (requiring deeper reasoning about trade-offs): prefer **Sonnet** — its tendency to think meta-level would help catch issues during authoring.
