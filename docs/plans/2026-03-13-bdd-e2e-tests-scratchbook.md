# Scratchbook: BDD E2E Tests

Design doc: docs/plans/2026-03-13-bdd-e2e-tests-design.md

## Tasks

- [x] Task 1: Fix .gitignore — add `playwright-report/` and `test-results/`
- [x] Task 2: Fix port inconsistency — design says 9222, code uses 9223; align CLAUDE.md with code
- [x] Task 3: Validate playwright.config.ts against design (timeout, globalSetup, no webServer)
- [ ] Task 4: Validate step definitions and feature files against design
- [ ] Task 5: Validate scripts (check-services, reset-db, global-setup) against design intent
- [ ] Task 6: Validate devcontainer.json and Dockerfile against design

## Learnings

- Port 9222 (design) → 9223 (code). Likely a conflict with another service. CLAUDE.md updated to match code rather than design.
- `reset-db.ts` uses `supabase db reset` (migrations + seed) instead of raw TRUNCATE SQL. More robust approach; design's TRUNCATE was a rough spec.
- Extra feature files (forgot-password, logout, student-signup) are beyond design scope but don't break anything — noted, not removed.
