# Score: docs/plans/2026-05-15-bdd-coverage-design.md

> Scored by: `/score-design-document` skill  
> Model: claude-sonnet-4-6  
> Date: 2026-05-28

---

### Summary

- **Applicable attributes:** 23 of 27 (N/A excluded: 4)
- **Result:** 16 T / 7 F — **70 % true** of applicable
- **Strongest category:** Concreteness (4 T / 0 F / 0 N/A)
- **Weakest category:** Post-ship reconciliation (1 T / 3 F / 1 N/A)
- **Final word:** The design is among the most concrete in the project — exhaustive file paths, real code snippets, explicit selector ordering, and a clearly dependency-ordered implementation sequence all pass cleanly. The weakest dimension is post-ship reconciliation: three shipped files diverged from the design (`hydration.ts` still login-only, `login.ts` still hardcodes `/org/`, a `lessons.md` file exists that the design explicitly forbade) with no Lessons section to capture those divergences.

---

### Per-attribute table

| Category | Attribute | Result | Evidence |
|---|---|---|---|
| Problem framing | Problem stated concretely | T | "E2E tests share the same database. A test that creates data can bleed into the next test." |
| Problem framing | Why-now / motivating trigger explicit | F | no incident, deadline, or blocking dependency named |
| Problem framing | Affected audience named | T | teacher and student flows named in priority table; skill consumer described as "the human" |
| Scope & maturity | In-scope explicitly listed | T | flow priority table rows 1–7 + target folder structure section |
| Scope & maturity | Out-of-scope / deferred explicitly listed | T | "Priorities 8–11 do not get placeholder .feature files" with per-domain deferral reasons |
| Scope & maturity | Maturity target stated | F | no POC / MVP / production-ready label anywhere in the document |
| Concreteness | Specific file paths named | T | `tests/e2e/steps/hooks.ts`, `helpers/reset-db.ts`, `.claude/skills/bdd-coverage/SKILL.md` |
| Concreteness | Specific function, table, column, or component names referenced | T | `resetTestData()`, `loginAs(page, email)`, `waitForHydration(page)`, `PRESERVE_TABLES` |
| Concreteness | No hand-wavy "etc." or "and so on" in load-bearing lists | T | selector preference order is an exhaustive numbered list; `PRESERVE_TABLES` contents named explicitly |
| Concreteness | External libraries / services named with versions where they matter | T | "playwright-bdd v8.5", `bddgen`, Carbon Design System components cited |
| Architecture fit | References existing patterns or code in the repo | T | "course-creation.steps.ts and lesson-management.steps.ts already use successfully" |
| Architecture fit | Names integration points with other apps/packages in the monorepo | N/A | confined to `tests/e2e/` and `.claude/`; no cross-package contract introduced |
| Architecture fit | Data model changes specified | N/A | no Supabase schema changes proposed |
| Architecture fit | API contract specified | N/A | no Hono API changes proposed |
| Architecture fit | UI surface specified | T | `routes/courses/[id]/lessons/[...lessonParams]/+page.svelte`, `lib/components/Modal/index.svelte` named |
| Testability & risk | Test strategy stated with boundaries | T | e2e boundary explicit; playwright-bdd integration layer named; unit boundary out of scope by design |
| Testability & risk | At least one edge case or failure mode named | T | Realtime WebSocket bleed between scenarios; stale-FK errors after reset; `networkidle` hang |
| Testability & risk | Unstated assumptions called out | T | "does not work in environments without a reachable Docker daemon — flag this as a setup prerequisite" |
| Testability & risk | Rollback or feature-flag plan present | F | no rollback or kill-switch described; design adds new test infra with no revert path |
| Implementation plan | Steps are ordered | T | numbered 8-step Implementation sequence |
| Implementation plan | Step dependencies / prerequisites explicit | T | "Steps 1, 2, 3, 4 are prerequisites for step 7 — do not start writing scenarios until they land" |
| Implementation plan | Success criteria measurable | F | "2–4 scenarios per domain" is a count target; no suite-green gate or coverage threshold stated |
| Post-ship reconciliation | `## Lessons` section present | F | no `## Lessons` section anywhere in the document |
| Post-ship reconciliation | Lessons entries dated after ship date | F | no Lessons section; dated entries impossible |
| Post-ship reconciliation | Retrospective notes capture drift | F | `hydration.ts` still login-only; `login.ts` still hardcodes `/org/`; `lessons.md` exists despite design forbidding it — none captured |
| Post-ship reconciliation | Post-mortem entry for any incident tied to this design | N/A | no known production incident traced to this design |
| Post-ship reconciliation | Doc body matches shipped reality | T | scaffold structure, `playwright.config.ts`, hooks, shared steps match shipped HEAD; un-implemented items still marked as such |

---

### Per-category tallies

- **Problem framing:** 2 T / 1 F / 0 N/A
- **Scope & maturity:** 2 T / 1 F / 0 N/A
- **Concreteness:** 4 T / 0 F / 0 N/A
- **Architecture fit:** 2 T / 0 F / 3 N/A
- **Testability & risk:** 3 T / 1 F / 0 N/A
- **Implementation plan:** 2 T / 1 F / 0 N/A
- **Post-ship reconciliation:** 1 T / 3 F / 1 N/A

---

**Gaps to fix (failures only):**

- Problem framing — Why-now / motivating trigger explicit: no incident, deadline, or blocking dependency named to explain why coverage work starts now.
- Scope & maturity — Maturity target stated: no POC / MVP / production-ready label; readers cannot calibrate expectations on "done."
- Testability & risk — Rollback or feature-flag plan present: no revert path described for the new test infrastructure (hooks, DB reset, preflight changes).
- Implementation plan — Success criteria measurable: "2–4 scenarios per domain" is a count target, not a measurable pass/fail outcome; no suite-green gate or coverage percentage threshold defined.
- Post-ship reconciliation — `## Lessons` section present: no `## Lessons` section; document has shipped but was never revisited.
- Post-ship reconciliation — Lessons entries dated after ship date: no Lessons section exists, so no dated post-ship entries are possible.
- Post-ship reconciliation — Retrospective notes capture drift: `hydration.ts` not generalized (still login-only), `login.ts` still hardcodes `waitForURL(/\/org\//)`, `lessons.md` exists in `.claude/skills/bdd-coverage/` despite design explicitly stating "No `lessons.md`" — none of these divergences are captured.
