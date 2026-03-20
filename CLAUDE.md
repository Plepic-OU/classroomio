# ClassroomIO

## Architecture

- @docs/c4/context.mmd — Level 1: System Context
- @docs/c4/container.mmd — Level 2: Container
- @docs/c4/component-dashboard.mmd — Level 3: Dashboard components
- @docs/c4/component-api.mmd — Level 3: API components
- docs/c4/database.md — Database schema (39 tables, 55 FKs)
- SVGs: docs/c4/*.svg (rendered with `mmdc -i <file>.mmd -o <file>.svg`)

## References

- @.claude/references/chart-theme.md — Chart theme: grey boxes, white text, blue lines (Mermaid)

## E2E Tests (BDD)

- Design doc: @docs/plans/2026-03-13-bdd-playwright-v2.md
- Acceptance criteria: @docs/bdd-acceptance-criteria.md
- Package: `packages/e2e/` — uses `playwright-bdd` (Gherkin + Playwright)
- Run tests: `pnpm --filter e2e test` (requires dashboard + Supabase running)
- Playwright UI: `pnpm --filter e2e test:ui`
- HTML report: `pnpm --filter e2e report` (port 9323)
- Tests record video + screenshots for all runs (including passing)
- Timeout: 10s max — tests fail fast
- `globalSetup` health-checks services before running; fails immediately if dashboard or Supabase are down

## Skills

All skills support universal flags. See `.claude/references/skill-flags.md` for details.
