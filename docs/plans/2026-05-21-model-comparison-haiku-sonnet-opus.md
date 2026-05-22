# Three-Model SRD Validation — Haiku 4.5 / Sonnet 4.6 / Opus 4.7

**Date:** 2026-05-21 · **Author:** `@mkontus` (with Claude Code)

This is an observational study, not a design. The same design document — `docs/plans/2026-05-15-bdd-coverage-and-skill-design.md` — was passed to three `general-purpose` subagents whose **only difference is the underlying model**. Same system prompt, same task, same tools (`Read`, `Glob`, `Grep`). Subagent definitions live at `.claude/agents/srd-validator-{haiku,sonnet,opus}.md`.

The goal: see what changes when you swap models and otherwise hold everything constant.

---

## §1 — Setup

- **Document under review:** `docs/plans/2026-05-15-bdd-coverage-and-skill-design.md` (post-validation-triage version, 348 lines, ~14 k words).
- **System prompt (identical for all three):** "Senior software architect performing an independent validation review. Identify gaps, contradictions, missing detail, over-engineering, scope creep, hand-waving, untested assumptions. Verify codebase claims by reading files. Read-only."
- **Tools (identical):** `Read`, `Glob`, `Grep`.
- **Invocation:** all three spawned in a single message as parallel foreground `general-purpose` agents with `model:` overrides.
- **Variable:** the model.

---

## §2 — Side-by-side findings

Each row is one distinct finding from one of the three runs (or a finding multiple models converged on). Columns: did Haiku flag it, did Sonnet, did Opus, severity (best across reports), and whether the finding is *actually real* against the codebase — verified by re-reading the relevant file or section.

A small number of findings appear in both Sonnet's and Opus's reports with near-identical wording; those are merged into one row.

Legend: ✓ = flagged · — = not flagged · severity from the strongest model that raised it.

### Findings Sonnet AND Opus both caught (high-agreement core)

| # | Finding | Haiku | Sonnet | Opus | Severity | Actually real? |
|---|---|---|---|---|---|---|
| 1 | The `groupmember` student-enrolment row is in `seed.sql`, not `data.sql` as the design states | — | ✓ | ✓ | CRITICAL | **Yes** — verified at `supabase/seed.sql:187-192` |
| 2 | `data.sql` is not loaded automatically by anything (`.devcontainer/setup.sh` has no `psql … < data.sql`); §5's "three loaders" framing is wrong | — | ✓ | ✓ | CRITICAL | **Yes** — verified |
| 3 | `@test.com` emails trigger `window.location.href = '/logout'` outside `dev` mode (`appSetup.ts:79`) — breaks every `@auth:*` storage state if §9's `vite preview` ever lands | — | ✓ | ✓ | WARNING | **Yes** — verified |
| 4 | `globalSetup` storage-state precompute omits browser-launch boilerplate; existing `loginAs` takes a `Page`, not a `BrowserContext` — non-trivial refactor not sketched | — | ✓ | ✓ | WARNING | **Yes** |
| 5 | `screenshot/trace/video: 'on-first-retry'` is dead with `retries: 0` (and `'on-first-retry'` isn't a valid `screenshot` mode) | — | ✓ | ✓ | WARNING | **Yes** — type-check verified |
| 6 | §6's `/bdd triage` mtime stale-results guard contradicts §2's explicit rejection of mtime on 9p / gRPC-FUSE mounts | — | ✓ | ✓ | WARNING | **Yes** |
| 7 | §8 risk #3's `refresh_token_reuse_interval` reasoning conflates the replay-protection window with active rotation cadence | — | ✓ | ✓ | WARNING | **Yes** |
| 8 | X-02 only tests the client-side redirect; the actual authorization boundary is Supabase RLS, which the test never exercises | — | ✓ | ✓ | WARNING | **Yes** — partial, design's X-02 note already acknowledges client-only |
| 9 | The i18n `loading` store probe has no page/test boundary mechanism (no `window.__i18nLoading` exposure proposed) | — | ✓ | ✓ | NOTE | **Yes** |
| 10 | `/bdd run` defaulting to "most recently modified `.feature` per `git status`" has no specified command (`git status` reports state, not order) | — | ✓ | ✓ | NOTE | **Yes** |
| 11 | §8 risk #2's "diff migrations since last `learnings.md` infra entry" requires a cursor field absent from the §7 entry template | — | ✓ | ✓ | NOTE | **Yes** |
| 12 | `@mutating:profile` is referenced as the canonical subcategory example in §2/§9 but no backlog row uses it | — | ✓ | ✓ | NOTE | **Yes** |

### Findings ONLY Sonnet caught

| # | Finding | Haiku | Sonnet | Opus | Severity | Actually real? |
|---|---|---|---|---|---|---|
| 13 | Existing step files (`steps/auth/login.steps.ts`, `steps/courses/course-creation.steps.ts`) import `createBdd` from `playwright-bdd` directly — design never specifies the migration | — | ✓ | — | WARNING | **Yes** — verified |
| 14 | `test-fixtures.sql` idempotency strategy is unspecified — re-apply against PRESERVE'd `profile` rows can fail uniqueness | — | ✓ | — | WARNING | **Yes** |
| 15 | Current `course-creation.feature` (T-02 starting point) is *already* untagged despite calling `Finish` — the design's risk #1 is present in the starting state, not flagged | — | ✓ | — | NOTE | **Yes** |
| 16 | `test-fixtures.sql` locale pin only fires inside `@mutating` reset; read-only scenarios (F-03, T-01, S-01..S-03) rely on whatever locale the DB had | — | ✓ | — | NOTE | **Yes** |

### Findings ONLY Opus caught

| # | Finding | Haiku | Sonnet | Opus | Severity | Actually real? |
|---|---|---|---|---|---|---|
| 17 | Fixture course vs T-04/T-05/T-06 self-created course can collide after re-apply — undefined whether fixture course is reused or replaced | — | — | ✓ | WARNING | **Yes** |
| 18 | `storageState` fixture override depending on `$tags` works only because playwright-bdd wraps context creation — design treats this as obvious and cites no working snippet | — | — | ✓ | WARNING | **Yes** (mild) |
| 19 | `pnpm test:e2e -- tests/e2e/features/auth/login.feature:10` may pass the feature-path positional arg to `bddgen`, not Playwright — needs verification | — | — | ✓ | WARNING | **Yes** |
| 20 | `test-fixtures.sql` appears in the §3 layout but isn't bolded as new; never specified who creates the initial file or what it contains | — | — | ✓ | NOTE | **Yes** (cosmetic but real) |
| 21 | Five named workflows in §6 vs "intent-dispatched from the user's prompt" — which is canonical? Disambiguation rule absent | — | — | ✓ | NOTE | **Yes** |
| 22 | Proposed mutation-verb lint flags `getByRole('button', { name: /finish/i }).click()` which is already in `course-creation.steps.ts:34` — false-positive shape | — | — | ✓ | NOTE | **Yes** |

### Findings ONLY Haiku caught

| # | Finding | Haiku | Sonnet | Opus | Severity | Actually real? |
|---|---|---|---|---|---|---|
| 23 | Storage-state precompute "entirely missing from codebase" | ✓ | — | — | CRITICAL (Haiku) | **No — category error.** This is the design's deliverable; the doc proposes adding it |
| 24 | `test-fixtures.sql` "referenced as existing but missing" | ✓ | — | — | CRITICAL (Haiku) | **No — same category error** |
| 25 | `BeforeScenario`/`AfterScenario` hooks "do not exist" | ✓ | — | — | CRITICAL (Haiku) | **No — same category error** |
| 26 | Hydration discipline "redesign incomplete vs current helpers" | ✓ | — | — | WARNING (Haiku) | **No — category error** |
| 27 | Stale-fixture guard "not implemented" | ✓ | — | — | WARNING (Haiku) | **No — category error** |
| 28 | playwright-bdd ^8.5.0 fixture pattern claimed as docs-accurate but not verified by Haiku itself | ✓ | — | — | WARNING | **Yes** (mild — Opus #18 raises the same concern more sharply) |
| 29 | Skill reads design from hardcoded path `2026-05-15-bdd-…md` — filename drift risk | ✓ | — | — | WARNING | **Yes** |
| 30 | "Invoke from inside devcontainer" constraint should be louder | ✓ | — | — | WARNING | **Mostly addressed** — already in §5 execution-environment paragraph |
| 31 | §6 hard constraints are governance rules, not machine-checked gates | ✓ | — | — | WARNING | **Yes** (real but design-level) |
| 32 | `data.sql` dependency claim has no lint enforcement | ✓ | — | — | WARNING | **Already in §8 risk #1** as planned lint |
| 33 | `is_org_admin` no-arg RLS bug | ✓ | — | — | WARNING | **Already in §9 out-of-doc** |
| 34 | `goto()` followed by selector without hydration probe — no lint | ✓ | — | — | WARNING | **Yes** (real, missing lint) |
| 35 | Subcategory tag mapping (`@mutating:fresh-user` → which cleanup fn?) not specified | ✓ | — | — | NOTE | **Yes** (mild — the wiring is implicit) |
| 36 | Three fixture files for ~50 LOC is over-modularised | ✓ | — | — | NOTE | **Already in §9** as deferred |
| 37 | `@slow` advertises 30s but `playwright.config.ts` timeout is 10s; raising mechanism unspecified | ✓ | — | — | NOTE | **Yes** |
| 38 | Preflight "triggers Vite compilation" claim overstates what HTTP GETs do | ✓ | — | — | NOTE | **Yes** (mild) |
| 39 | `learnings.md` has no concurrency model for parallel appends | ✓ | — | — | NOTE | **Yes** (theoretical — skill is foreground-only) |
| 40 | Phase 1 scenarios are "written by hand" not by skill | ✓ | — | — | NOTE | **Already explicit in design** (closing implementation order) |

### Summary counts

| Category | Haiku | Sonnet | Opus |
|---|---|---|---|
| Total findings | 18 | 16 | 18 |
| Self-reported totals | 5C/9W/4N (= 18, but mis-tallied) | 2C/7W/5N (= 14, slight under-count) | 2C/9W/6N (= 17, off-by-one) |
| Actual recount | 3C/9W/6N | 2C/8W/6N | 2C/9W/7N |
| Of which actually real | 5 of 18 (28 %) | 16 of 16 (100 %) | 18 of 18 (100 %) |
| Of which false-positive category errors | 5 of 18 (28 %) | 0 | 0 |
| Of which already addressed in §8/§9 of the design | 4 | 0 | 0 |
| Of which agree with Sonnet | 0 | — | 12 |
| Of which agree with Opus | 0 | 12 | — |

The pattern: **Sonnet and Opus converged on a shared set of 12 real issues; Haiku found 0 of them**. Haiku's unique findings include 5 outright category errors (treating planned work as critical bugs) and 4 issues already addressed in §8/§9 of the design. The remaining Haiku findings are real but mostly minor.

---

## §3 — Speed

| Model | Wall-clock | × Haiku | Tool uses |
|---|---|---|---|
| Haiku 4.5 | **130.8 s** (≈ 2 min 11 s) | 1.0× | 32 |
| Opus 4.7 | 283.9 s (≈ 4 min 44 s) | 2.2× | 68 |
| Sonnet 4.6 | **555.4 s** (≈ 9 min 15 s) | 4.2× | 119 |

Surprising: **Sonnet was the slowest, not Opus**. Tool-use counts explain why — Sonnet read substantially more files (119 tool calls vs Opus's 68 vs Haiku's 32). Opus did similar substantive work in roughly half Sonnet's time with about 57 % the tool calls. Haiku's speed advantage comes partly from doing less verification — fewer file reads, fewer codebase claims actually checked.

This may be an artefact of one run and shouldn't be taken as a stable model property. But the *direction* (Sonnet doing more file reads than Opus, and slower per token) showed up clearly.

---

## §4 — Tokens & approximate cost

Tokens reported are total (input + output combined) — the tool result doesn't split them. For cost estimates I assume a 90 / 10 input / output split typical of read-heavy validation work, and use rough public-pricing tiers (Haiku 4.5 ≈ $1 / $5 per million; Sonnet 4.6 ≈ $3 / $15; Opus 4.7 ≈ $15 / $75). Treat the dollar amounts as order-of-magnitude.

| Model | Total tokens | Approx. input | Approx. output | Approx. cost | × Haiku |
|---|---|---|---|---|---|
| Haiku 4.5 | 81,204 | ~73 k | ~8 k | **~ $0.11** | 1.0× |
| Sonnet 4.6 | 84,094 | ~76 k | ~8 k | ~ $0.35 | 3.2× |
| Opus 4.7 | 83,996 | ~76 k | ~8 k | **~ $1.74** | 15.8× |

Tokens were within ~3 % of each other across the three runs — model choice barely moves token count for this kind of task, but moves cost 16× and time 4×.

Cost-per-real-finding (assuming all real findings are equally valuable, which they aren't):
- Haiku: $0.11 / 5 real findings ≈ **$0.022 per real finding**
- Sonnet: $0.35 / 16 ≈ **$0.022 per real finding**
- Opus: $1.74 / 18 ≈ **$0.097 per real finding**

By that crude metric Haiku and Sonnet are tied, with Opus ~4× more expensive per real finding. But the metric is misleading — Sonnet and Opus found ~12 issues that *no other model in the run found at all*. Haiku's 5 real findings were mostly minor and three of them overlap with what the design itself already calls out.

---

## §5 — Qualitative observations

**Haiku's behaviour.** Sharp pattern: Haiku treats the design document as if it were an audit of an *existing* system rather than a *plan* for a future one. Five of its CRITICAL findings amount to "this file doesn't exist yet" — for files the design explicitly proposes adding in Phase 1. This is a category error a careful reader wouldn't make; the design's §3 folder structure literally calls them additions. Haiku also misses subtle codebase facts (the `seed.sql` vs `data.sql` confusion, the `@test.com` auto-logout) — Sonnet and Opus both caught them by reading the relevant source files; Haiku didn't read those files.

**Sonnet's behaviour.** Highest read-volume of the three (119 tool calls). Every finding is grounded in a specific file or line. Sonnet caught four issues Opus missed, all of which required reading existing test/feature files to notice. Trade-off: Sonnet took ~4× Haiku's wall-clock and was the slowest of the three. Worth it when the document under review is small and codebase grounding is critical; less worth it when the question can be answered from the document alone.

**Opus's behaviour.** Found six unique issues, several of which require *reasoning about implications* rather than just reading code — e.g. the fixture-course vs T-04-created-course collision is an interaction Sonnet didn't surface. Opus also caught the `bddgen` positional-arg routing issue that needed Opus to mentally simulate the command-line. Opus reads less than Sonnet (68 vs 119 tool calls) but seems to extract more per file. Cost is the obvious downside — 16× Haiku.

**Self-reported totals.** All three miscounted their own findings to varying degrees:
- Haiku: claimed 5C/9W/4N, actual 3C/9W/6N — overstated criticals (probably because of the category-error confidence)
- Sonnet: claimed 2C/7W/5N, actual 2C/8W/6N — slight undercount, no severity drift
- Opus: claimed 2C/9W/6N, actual 2C/9W/7N — off-by-one on notes

This is a small but real reliability gap: even when asked for a structured count, models don't reliably tally their own bullet list. Don't trust the `TOTALS:` line — recount.

**Zero unanimous findings.** No single finding was caught by all three models. The 12 highest-confidence findings (the ones in §2's first table) are the ones Sonnet AND Opus agreed on — Haiku found none of them. This means using Haiku alone for SRD validation would miss every issue the bigger models think matters most. **Even an ensemble of three Haiku runs would not surface those 12 issues**, because the limiting factor isn't variance — it's the model's tendency to interpret a design document as an audit.

---

## §6 — Conclusion: which model for which work

**Validation against a real codebase → Sonnet or Opus.** Sonnet is the cost-effective default: it found everything Opus found minus 6 implication-heavy issues, at ~1/5 the cost. Use Sonnet when you want findings grounded in actual file contents and you don't need second-order reasoning.

**Reviews where reasoning about consequences matters → Opus.** Opus's unique contributions (fixture/test course collision; `bddgen` arg routing; intent-dispatch vs explicit-command ambiguity) all involve simulating what would happen at runtime or asking "if X is true, then Y…". Worth the 5× Sonnet cost when the design has many interacting parts.

**Validation of a design document → not Haiku.** Haiku misread the genre. A design document describes what *will* be built; Haiku flagged it as a system that *already* exists and is broken. The fix isn't a better prompt — every prompt in this run said "design document" explicitly. Haiku may still work well for tasks where the success criterion is "does the visible thing match a checklist" (lint passes, formatting consistency, simple fact lookups in existing code), but treating a forward-looking spec as ground-truth is a class of error to avoid for this model tier on this kind of work.

**Don't use a single model as ground truth.** No single model found everything. Sonnet missed 6 of Opus's findings; Opus missed 4 of Sonnet's. Even between the two strongest, ~30 % of real findings are unique to one. For a high-stakes review, run two models and union the results. For a lower-stakes review where 70 % coverage of real issues is fine, one strong model is enough.

**Notable about this run specifically.** The design document was already validated once (with the domain-specific multi-validator skill on Day 2 W2 step 5) and triage applied. Sonnet's and Opus's new findings represent the *next layer* of issues — things the earlier domain-specific validators missed because they were checking domain-specific concerns. A two-pass review (domain-specific first, generic SRD second) caught issues neither pass would catch alone. Worth doing again on the next design.

---

## §7 — Threats to validity

- **n = 1 per model.** Single run per model; results may be noisy. The wall-clock variance in particular (Sonnet slower than Opus) might not replicate.
- **Token split is estimated.** The tool result reports `total_tokens`, not input/output split. Cost estimates assume 90/10; actual could be 85/15 or 80/20, which would scale Sonnet's and Opus's costs proportionally up.
- **"Actually real?" is judged by the author, not blindly.** The author had context from the original validation triage, which may bias the assessment of which findings are "real" — though the worst false-positives (Haiku's category errors) are objectively wrong against the design's own text.
- **Design document is large and recently revised.** Models may behave differently on a fresh, smaller, or unrevised document. Don't generalise from this run alone.
- **Pricing is approximate.** Real per-token prices for the 1M-context variants of Sonnet/Opus may differ from the standard tier numbers used here.
