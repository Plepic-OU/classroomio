# Design — `score-design-document` skill

> **Date:** 2026-05-28
> **Status:** design
> **Scope:** New skill at `.claude/skills/score-design-document/`. Independent of the existing
`validate-design-document` skill.

---

## 1. Purpose

Produce a fast, per-attribute **True / False / N/A** scorecard for a design document, plus per-category tallies.
Read-only. No subagents. No Context7. Cheap enough to run repeatedly while drafting.

### Why a separate skill from `validate-design-document`

|              | `validate-design-document`               | `score-design-document`              |
|--------------|------------------------------------------|--------------------------------------|
| Output       | CRITICAL / WARNING / NOTE prose findings | T / F / N/A table + category tallies |
| Cost         | 8 parallel subagents + Context7 lookups  | Single pass, single context          |
| Side effects | Auto-applies fixes to the doc            | None — read-only                     |
| Use case     | Pre-implementation final review          | Drafting-time iteration              |
| Trigger      | Auto-invoked at end of brainstorming     | On-demand only                       |

The two skills cover different lifecycle stages — the score skill never replaces the validator.

### Non-goals

- No automatic 1–5 / 0–100 % summary score. The user explicitly rejected coarse single-number scores.
- **No edits to any file. Ever.** Not the design doc, not `attributes.md`. Pure read-only scorer.
- Concepts like "lessons captured" or "post-mortem written" are attributes the doc is checked *against*, not actions
  the skill performs.
- No Context7 / library-docs lookups. Tech currency is the validator's job.
- No subagent fan-out.

---

## 2. Invocation

Single mode. The skill scores one design document against `attributes.md` and prints the result.

```
/score-design-document [path]
```

If `[path]` is omitted, fall back to the most recent file in `docs/plans/` (same rule as `validate-design-document`).

The skill is **never auto-invoked** by other skills, including `brainstorming`. Drafting feedback is a human choice, not
a gate.

---

## 3. File layout

```
.claude/skills/score-design-document/
├── SKILL.md           # frontmatter + execution instructions
└── attributes.md      # the attribute catalogue (human-edited)
```

Two files, no extracted code.

### `SKILL.md`

YAML frontmatter:

```yaml
---
name: score-design-document
description: "Score a design document by checking individual T/F/N/A attributes. Use when asked to score, rate, or check a design doc against criteria."
---
```

Body contains: invocation rules, the execution flow (§5), parsing rules for `attributes.md`, and the output
format (§4).

### `attributes.md` format

Flat markdown. One `## ` per category. Each attribute is a bullet with three sub-bullets: name (bold), description,
applies-when hint.

```markdown
## Concreteness

- **Specific file paths named**
  - Description: At least one concrete file path (e.g. `apps/dashboard/src/lib/...`) is named where work will land —
    not "the auth code."
  - Applies when: design proposes implementation work; skip for pure RFCs.

- **No hand-wavy "etc." or "and so on"**
  - Description: Lists of items in load-bearing sections are exhaustive, not abbreviated.
  - Applies when: always.
```

`Applies when:` is a hint to help the AI decide T vs. N/A. The final call is still the AI's per-doc judgement — there is
no separate machine-readable applicability filter.

---

## 4. Output format

Markdown report with three blocks:

**1. Per-attribute table**

```markdown
| Category | Attribute | Result | Evidence |
|---|---|---|---|
| Problem framing | Problem stated concretely | T | "auth middleware mutates a global, blocking parallel tests" |
| Problem framing | Why-now / motivating trigger | F | no trigger named |
| Architecture fit | Data model changes specified | N/A | no schema changes |
```

Evidence is ≤15 words: a short quote from the doc for T, a short reason for F or N/A.

**2. Per-category tallies**

```markdown
- **Problem framing:** 2 T / 1 F / 0 N/A
- **Scope & maturity:** 1 T / 2 F / 0 N/A
- **Concreteness:** 3 T / 1 F / 0 N/A
- **Architecture fit:** 2 T / 0 F / 3 N/A
- **Testability & risk:** 1 T / 2 F / 1 N/A
- **Implementation plan:** 2 T / 1 F / 0 N/A
```

**3. F-only punch list**

```markdown
**Gaps to fix (failures only):**

- Scope & maturity — In-scope explicitly listed: section header missing.
- Testability & risk — Test strategy stated: only "we'll write tests" without boundary.
- ...
```

The skill outputs only the three blocks above. No other artifacts; no file writes.

---

## 5. Execution flow

1. Resolve doc path; if missing, pick most recent file in `docs/plans/`.
2. Read `attributes.md`. Parse categories and attributes.
3. Read the design doc.
4. In a single pass, for each attribute: assign T / F / N/A and capture ≤15-word evidence (quote for T; reason for F or
   N/A).
5. Emit table + tallies + F-only punch list (§4).
6. **No file writes.** Ever.

---

## 6. Evolving the attribute set

The skill itself does not learn. `attributes.md` evolves by humans editing it. When a doc ships and reveals that some
important property was missed (no rollback plan, no migration story, no post-ship reconciliation), the human adds an
attribute to `attributes.md`. The next score run picks it up.

Concepts like "lessons captured," "post-mortem written," and "retrospective dated after implementation" belong in
`attributes.md` as **attributes the doc should satisfy** (see §7) — not as features of this skill. The scorer just
checks them.

---

## 7. Initial attribute catalogue

Seven categories, ~27 attributes. Seed only — humans edit `attributes.md` directly as new gaps surface.

### Problem framing

- **Problem stated concretely** — User pain *or* tech pain (refactor target, perf budget, debt cost, DX friction).
  Bad: "we should clean this up." Good: "auth middleware mutates a global, blocking parallel tests." *Applies when:*
  always.
- **Why-now / motivating trigger explicit** — Incident, deadline, blocking other work, compounding cost. *Applies when:*
  always.
- **Affected audience named** — Users, on-call, specific dev team, future maintainer. *Applies when:* always.

### Scope & maturity

- **In-scope explicitly listed** — A bulleted or numbered list of what the work covers. *Applies when:* always.
- **Out-of-scope / deferred explicitly listed** — What we are choosing *not* to do this iteration. *Applies when:*
  always.
- **Maturity target stated** — POC / MVP / Production-ready. *Applies when:* always.

### Concreteness

- **Specific file paths named** — At least one concrete path where work lands. *Applies when:* design proposes
  implementation; skip for pure RFCs.
- **Specific function, table, column, or component names referenced** — Not "the auth code." *Applies when:*
  implementation work.
- **No hand-wavy "etc." or "and so on" in load-bearing lists** — Lists are exhaustive. *Applies when:* always.
- **External libraries / services named with versions where they matter** — e.g. "SvelteKit 1.x", "Hono 4". *Applies
  when:* introducing a new dependency.

### Architecture fit

- **References existing patterns or code in the repo** — Not greenfield-by-default. *Applies when:* working inside an
  existing app/package.
- **Names integration points with other apps/packages in the monorepo** — e.g. `@cio/api` → `@cio/dashboard` via
  `rpc-types`. *Applies when:* crosses package boundaries.
- **Data model changes specified** — Tables, columns, RLS policies, migrations. *Applies when:* touches Supabase schema.
- **API contract specified** — Endpoint, request/response types, RPC type sharing. *Applies when:* touches the Hono API.
- **UI surface specified** — Routes, components, loading/empty/error states. *Applies when:* touches the dashboard UI.

### Testability & risk

- **Test strategy stated with boundaries** — unit / integration / e2e clearly assigned. Not just "we'll write tests".
  *Applies when:* always.
- **At least one edge case or failure mode named** — *Applies when:* always.
- **Unstated assumptions called out** — *Applies when:* always.
- **Rollback or feature-flag plan present** — *Applies when:* shipping to prod.

### Implementation plan

- **Steps are ordered** — Numbered or sequenced list. *Applies when:* design proposes implementation.
- **Step dependencies / prerequisites explicit** — e.g. "step 3 depends on the migration in step 1". *Applies when:*
  implementation has > 3 steps.
- **Success criteria measurable** — Numeric, observable, or testable. Bad: "users like it." Good: "p95 grading latency
  under 300 ms." *Applies when:* always.

### Post-ship reconciliation

These attributes only "apply when" the design's implementation has shipped (referenced files exist in `HEAD`). They
ask whether the doc has been kept honest after the fact — not whether the scorer did it.

- **`## Lessons` section present** — The doc has a `## Lessons` section capturing what was learned. *Applies when:*
  shipped.
- **Lessons entries dated after ship date** — At least one Lessons entry is dated after the implementation merged,
  proving the doc was revisited. *Applies when:* shipped.
- **Retrospective notes capture drift** — If the implementation diverged from the design, the divergence is named
  in a Lessons / retrospective entry (not silently hidden by editing the body alone). *Applies when:* shipped and
  drift exists.
- **Post-mortem entry for any incident tied to this design** — If something broke in production and the design was
  the relevant artifact, a dated post-mortem entry exists. *Applies when:* an incident occurred.
- **Doc body matches shipped reality** — Named file paths, functions, tables, and services in the body exist in
  `HEAD` and match the design's claims. *Applies when:* shipped.

---

## 8. Open questions

None blocking v1. Possible follow-ups:

- Per-attribute weighting if the F-only punch list grows too long to be actionable.
- An optional `--strict` flag that disables N/A (turns every applies-when-skip into F).

---

## 9. Implementation plan

Ordered steps. No step depends on the others except in this order:

1. Create directory `.claude/skills/score-design-document/`.
2. Write `attributes.md` with the seed catalogue from §7.
3. Write `SKILL.md` covering frontmatter, the single execution flow (§5), the output format (§4), and the read-only
   contract (no file writes, ever).
4. Smoke-test against an existing doc in `docs/plans/` and tune the table format if too wide / too narrow.
5. Update `docs/skills-flow.md` (optional) to mention the new skill alongside `bdd-coverage` and
   `validate-design-document`.

No code, no tests, no migrations — this is pure prompt engineering in markdown.
