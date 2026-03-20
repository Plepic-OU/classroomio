# Scratchbook: BDD Playwright E2E Tests

> Design document: ./2026-03-13-bdd-playwright-design.md
> Created: 2026-03-20

## Tasks

- [x] Task 1: Dependencies — add @playwright/test and playwright-bdd to devDependencies, add test:e2e scripts
- [x] Task 2: Playwright config — create playwright.config.ts with BDD config, projects, and auth setup
- [x] Task 3: Pre-flight service check — create e2e/scripts/check-services.ts
- [x] Task 4: DB reset script — create e2e/scripts/reset-db.ts with truncate + reseed
- [x] Task 5: Fixtures — create e2e/fixtures/index.ts
- [x] Task 6: Auth setup — create login.setup.ts (saves storageState + orgSlug)
- [x] Task 7: Login feature + steps — e2e/features/auth/login.feature + login.steps.ts
- [x] Task 8: Course creation feature + steps — e2e/features/courses/course-creation.feature + steps
- [x] Task 9: DevContainer changes — add port 9323, Playwright browser install in setup.sh
- [x] Task 10: Turbo config — add test:e2e pipeline entry
- [x] Task 11: .gitignore — add missing playwright-report/ and .playwright-bdd/ entries
- [x] Task 12: Environment variables — create .env.test.example
- [x] Task 13: CLAUDE.md — add E2E Tests section

## Learnings

### Most of the design was already implemented
The design document was written retrospectively — most tasks (12 of 13) were already implemented in prior sessions. Only the .gitignore entries for `playwright-report/` and `.playwright-bdd/` were missing. The scratchbook still captures the full task list for completeness.

### .features-gen/ not in design but correctly present
The `.gitignore` contains `.features-gen/` which isn't mentioned in the design doc's gitignore section. This is the `bddgen` output directory and correctly belongs in `.gitignore` — a gap in the design doc, not in the implementation.

## Status

Completed: 2026-03-20
