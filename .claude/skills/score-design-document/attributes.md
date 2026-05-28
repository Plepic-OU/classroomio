# Design Document Attributes

This file is the catalogue of attributes a design document is scored against. The `score-design-document` skill reads
this file, walks every attribute against the design doc, and emits a T / F / N/A scorecard.

**How to evolve this file:** edit it by hand. Add attributes when you notice recurring gaps in real design docs.
Remove or reword attributes that produce noise. The skill never edits this file.

**Format per attribute:**

- **Attribute name (short, imperative)**
  - Description: what to look for, with a good/bad example where helpful.
  - Applies when: hint to help decide T vs. N/A. Final call is the AI's per-doc judgement.

---

## Problem framing

- **Problem stated concretely**
  - Description: User pain *or* tech pain (refactor target, perf budget, debt cost, DX friction) is named in specific
    terms. Bad: "we should clean this up." Good: "auth middleware mutates a global, blocking parallel tests."
  - Applies when: always.

- **Why-now / motivating trigger explicit**
  - Description: An incident, deadline, blocking dependency, or compounding cost is named — explains why the work
    is being done *now* rather than later.
  - Applies when: always.

- **Affected audience named**
  - Description: Names which users, teams, or future maintainers are affected. Not "people" or "us."
  - Applies when: always.

---

## Scope & maturity

- **In-scope explicitly listed**
  - Description: A bulleted or numbered list of what the work covers — not just implied by the prose.
  - Applies when: always.

- **Out-of-scope / deferred explicitly listed**
  - Description: What we are choosing *not* to do this iteration. "Out of scope" or "deferred" section present.
  - Applies when: always.

- **Maturity target stated**
  - Description: POC / MVP / production-ready (or equivalent) is named, so reviewers can calibrate expectations.
  - Applies when: always.

---

## Concreteness

- **Specific file paths named**
  - Description: At least one concrete path (e.g. `apps/dashboard/src/lib/...`) is named where work will land —
    not "the auth code."
  - Applies when: design proposes implementation work; skip for pure RFCs.

- **Specific function, table, column, or component names referenced**
  - Description: Names actual symbols from the codebase, not abstract roles. Bad: "the user service." Good:
    `services/user.ts::getCurrentUser`.
  - Applies when: design proposes implementation work.

- **No hand-wavy "etc." or "and so on" in load-bearing lists**
  - Description: Lists that constrain scope or implementation are exhaustive, not abbreviated.
  - Applies when: always.

- **External libraries / services named with versions where they matter**
  - Description: e.g. "SvelteKit 1.x", "Hono 4", "Supabase JS SDK v2". Skip for libraries already pinned by the
    monorepo and not being upgraded.
  - Applies when: introducing a new dependency or upgrading one.

---

## Architecture fit

- **References existing patterns or code in the repo**
  - Description: Links to or names existing files/patterns the new work follows or extends — not greenfield by default.
  - Applies when: working inside an existing app/package.

- **Names integration points with other apps/packages in the monorepo**
  - Description: e.g. `@cio/api` → `@cio/dashboard` via `rpc-types`. Cross-package contracts are named.
  - Applies when: design crosses package boundaries.

- **Data model changes specified**
  - Description: Tables, columns, RLS policies, migrations are named explicitly.
  - Applies when: design touches Supabase schema.

- **API contract specified**
  - Description: Endpoint path(s), method(s), request/response types, RPC type sharing are spelled out.
  - Applies when: design touches the Hono API.

- **UI surface specified**
  - Description: Routes, components, loading/empty/error states are named.
  - Applies when: design touches the dashboard UI.

---

## Testability & risk

- **Test strategy stated with boundaries**
  - Description: unit / integration / e2e are clearly assigned to what's being built. Not just "we'll write tests."
  - Applies when: always.

- **At least one edge case or failure mode named**
  - Description: One specific edge case (empty list, concurrent edit, network drop, etc.) is called out.
  - Applies when: always.

- **Unstated assumptions called out**
  - Description: At least one assumption that could turn out wrong is named explicitly.
  - Applies when: always.

- **Rollback or feature-flag plan present**
  - Description: How to back this out if it goes wrong in production — feature flag, kill switch, revert plan.
  - Applies when: shipping to prod.

---

## Implementation plan

- **Steps are ordered**
  - Description: A numbered or sequenced list of implementation steps, not a bag of bullets.
  - Applies when: design proposes implementation.

- **Step dependencies / prerequisites explicit**
  - Description: e.g. "step 3 depends on the migration in step 1." Reader can build a dependency graph.
  - Applies when: implementation has more than 3 steps.

- **Success criteria measurable**
  - Description: Numeric, observable, or testable outcomes. Bad: "users like it." Good: "p95 grading latency under
    300 ms."
  - Applies when: always.

---

## Post-ship reconciliation

These attributes ask whether the doc has been kept honest after the implementation merged. They only apply once the
referenced work has shipped.

- **`## Lessons` section present**
  - Description: The doc has a `## Lessons` section capturing what was learned post-implementation.
  - Applies when: design's implementation has shipped (its referenced files exist in `HEAD`).

- **Lessons entries dated after ship date**
  - Description: At least one Lessons entry is dated *after* the implementation merged, proving the doc was revisited.
  - Applies when: shipped.

- **Retrospective notes capture drift**
  - Description: If implementation diverged from the design (different file, different library, different shape),
    the divergence is named in a Lessons / retrospective entry — not silently masked by a body edit.
  - Applies when: shipped and the design's claims have drifted from `HEAD`.

- **Post-mortem entry for any incident tied to this design**
  - Description: If something broke in production and this design was the relevant artifact, a dated post-mortem
    entry exists in `## Lessons`.
  - Applies when: a known incident traced back to this design.

- **Doc body matches shipped reality**
  - Description: Named file paths, functions, tables, and external services in the body match what actually exists
    in `HEAD`. The body is not lying about what shipped.
  - Applies when: shipped.
