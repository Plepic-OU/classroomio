# Score — `docs/plans/2026-05-15-bdd-coverage-design.md`

> Scored by `/score-design-document` (read-only skill). Output captured to file per user request.
> Model: claude-opus-4-8.

### Summary

- **Applicable attributes:** 22 of 27 (N/A excluded: 5)
- **Result:** 14 T / 8 F — **64 % true** of applicable
- **Strongest category:** Concreteness (4 T / 0 F / 0 N/A)
- **Weakest category:** Post-ship reconciliation (0 T / 4 F / 1 N/A)
- **Final word:** The design is exceptionally concrete and well-sequenced — named file paths, helpers, selectors, and an ordered prerequisite-aware plan make it near-buildable. Its weaknesses are framing (no why-now, no measurable success criteria) and that it has shipped without being reconciled: deferred domains now have `.feature` files and a `lessons.md` exists, both contradicting the body, and there is no `## Lessons` section recording the drift.

### Per-attribute table

| Category | Attribute | Result | Evidence |
|---|---|---|---|
| Problem framing | Problem stated concretely | T | "E2E tests share the same database. A test that creates data can bleed into the next test." |
| Problem framing | Why-now / motivating trigger explicit | F | no incident/deadline/trigger naming why now vs later |
| Problem framing | Affected audience named | T | "run by a human or an agent without manual setup"; contributors referenced |
| Scope & maturity | In-scope explicitly listed | T | priority table + "What this document covers" enumerate the two parts and domains |
| Scope & maturity | Out-of-scope / deferred explicitly listed | T | "Priorities 8–11 do not get placeholder .feature files... revisit when its blocker clears" |
| Scope & maturity | Maturity target stated | F | no POC/MVP/production-ready label; "2-4 scenarios per domain" is scope not maturity |
| Concreteness | Specific file paths named | T | "steps/hooks.ts", "helpers/reset-db.ts", ".claude/skills/bdd-coverage/SKILL.md" |
| Concreteness | Specific function/table/component names referenced | T | "resetTestData()", "waitForHydration(page)", "PRESERVE_TABLES", "loginAs" |
| Concreteness | No hand-wavy "etc." in load-bearing lists | T | PRESERVE_TABLES list and selector order are exhaustive, not abbreviated |
| Concreteness | External libraries / services named with versions | T | "playwright-bdd v8.5", "bddgen", "Chromium only, workers: 1" |
| Architecture fit | References existing patterns or code in repo | T | "matches what the existing course-creation.steps.ts and lesson-management.steps.ts already use" |
| Architecture fit | Names integration points with other apps/packages | T | "Dashboard + API + Supabase are reachable"; routes/components in lib/components/<Feature> |
| Architecture fit | Data model changes specified | N/A | tests only; truncates existing tables, no schema change |
| Architecture fit | API contract specified | N/A | no Hono API endpoints designed; test harness only |
| Architecture fit | UI surface specified | T | "routes/courses/[id]/lessons/[...lessonParams]/+page.svelte"; ARIA/placeholder selectors |
| Testability & risk | Test strategy stated with boundaries | T | entire doc is the e2e strategy; "chase user flows" not line coverage, @write tagging |
| Testability & risk | At least one edge case or failure mode named | T | "open subscription from scenario N can fire INSERT/UPDATE events into scenario N+1's page" |
| Testability & risk | Unstated assumptions called out | T | "text-matched ARIA names assume English locale"; docker daemon reachability assumption |
| Testability & risk | Rollback or feature-flag plan present | F | no back-out/revert plan; test infra so impact is low but none stated |
| Implementation plan | Steps are ordered | T | "The remaining work, in order:" numbered 1-8 |
| Implementation plan | Step dependencies / prerequisites explicit | T | "Steps 1, 2, 3, 4 are prerequisites for step 7 — do not start writing scenarios until they land" |
| Implementation plan | Success criteria measurable | F | no numeric/observable target; "Enough to catch a regression" is qualitative |
| Post-ship reconciliation | `## Lessons` section present | F | no `## Lessons` section despite SKILL.md, hooks.ts, feature files now existing |
| Post-ship reconciliation | Lessons entries dated after ship date | F | no Lessons section, so no dated post-ship entry |
| Post-ship reconciliation | Retrospective notes capture drift | F | drift unrecorded: deferred domains now have .feature files; lessons.md exists despite "No lessons.md" |
| Post-ship reconciliation | Post-mortem entry for incident tied to design | N/A | no known incident traced to this design |
| Post-ship reconciliation | Doc body matches shipped reality | F | body says "No placeholder .feature files for deferred domains" but analytics/billing/email/polls/*.feature exist; says "no lessons.md" but it exists |

### Per-category tallies

- **Problem framing:** 2 T / 1 F / 0 N/A
- **Scope & maturity:** 2 T / 1 F / 0 N/A
- **Concreteness:** 4 T / 0 F / 0 N/A
- **Architecture fit:** 3 T / 0 F / 2 N/A
- **Testability & risk:** 3 T / 1 F / 0 N/A
- **Implementation plan:** 2 T / 1 F / 0 N/A
- **Post-ship reconciliation:** 0 T / 4 F / 1 N/A

### Gaps to fix (failures only)

- Problem framing — Why-now / motivating trigger explicit: no incident, deadline, or compounding cost explaining why now.
- Scope & maturity — Maturity target stated: no POC/MVP/production-ready label to calibrate reviewer expectations.
- Testability & risk — Rollback or feature-flag plan present: no back-out/revert plan stated.
- Implementation plan — Success criteria measurable: success is qualitative ("catch a regression"), no numeric/observable target.
- Post-ship reconciliation — `## Lessons` section present: no `## Lessons` section although the work has largely shipped.
- Post-ship reconciliation — Lessons entries dated after ship date: no dated post-ship entry exists.
- Post-ship reconciliation — Retrospective notes capture drift: drift (deferred-domain feature files, existing lessons.md) is unrecorded.
- Post-ship reconciliation — Doc body matches shipped reality: body claims no placeholder feature files and no lessons.md, but both now exist on disk.
