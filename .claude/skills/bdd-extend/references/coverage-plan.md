# BDD coverage plan

Canonical source of "what's next" for `/bdd-extend`. Copied from
`docs/plans/2026-09-11-bdd-coverage-design.md` (Part 1) — if that design doc's wave list
changes, update it there first and re-copy, so the two don't drift apart.

`scripts/inventory-flows.ts` parses the `- **Wave N ...:** ...` lines below, including the
backtick-quoted route paths in each, to rank gaps. Keep that shape (wave number, en-dash
label, backtick route hints in the description) if you edit this file, or the parser won't
pick up the wave.

Ordered so each wave builds on scenarios/fixtures the previous wave already proved out.

- **Wave 0 (exists):** Login (success/failure), course creation.
- **Wave 1 — Teacher authoring:** add a lesson to a course (`courses/[id]/lessons`), invite a student (`invite/s/[hash]` flow), view the people/audience list (`courses/[id]/people`).
- **Wave 2 — Student consumption:** student accepts an invite → lands in `lms/mylearning`, opens a lesson, views content.
- **Wave 3 — Assessment loop:** teacher creates an exercise/quiz, student submits via `lms/exercises`, teacher grades in `courses/[id]/submissions` and `courses/[id]/marks`.
- **Wave 4 (backlog, not designed in this pass):** org settings/onboarding, certificates, community, billing (Polar/LemonSqueezy).

## Determinism & isolation reminders (see design doc for full detail)

- Tag any feature that needs a clean DB baseline `@resets-db` — reset runs at most once per
  *worker*, not once per tagged file or per scenario (`tests/e2e/steps/hooks.ts`): only the
  first `@resets-db` file to run in a worker actually triggers it, every other one after it
  runs against whatever that first file left behind. Use unique entity names (e.g. a
  timestamp suffix) in every `@resets-db` scenario rather than assuming a fresh table.
- Don't re-do UI login per scenario. Reuse the `workerStorageState` fixture
  (`tests/e2e/fixtures.ts`) via `Given I am logged in as "{email}"` — only `login.feature`
  itself exercises the real UI login flow.
- `tests/e2e/playwright.config.ts` pins `workers: 1` — `helpers/reset-db.ts` truncates the
  whole public schema globally, not per-worker, so parallelizing workers would let one
  worker's reset wipe data another worker's in-flight scenario depends on.
