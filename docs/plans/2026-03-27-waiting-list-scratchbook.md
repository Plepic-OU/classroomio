# Scratchbook: Waiting List

Design doc: docs/plans/2026-03-27-waiting-list-design.md

## Tasks

- [x] Task 1: DB migration — add org_id, replace unique constraint, add RLS policies
- [x] Task 2: WaitingList component (classroomio-com) — direct Supabase call, 3 UI states
- [x] Task 3: Hero integration + env.example update
- [x] Task 4: Dashboard page — onMount data load, table UI
- [x] Task 5: Sidebar nav item + translations (all 10 locales)
- [x] Task 6: E2E — feature file, step definitions, check-services update

## Learnings

- Translation files are at `apps/dashboard/src/lib/utils/translations/` (not `constants/translations/`).
- Hydration signal for classroomio-com: wait for the submit button to be visible (no Carbon `<Theme>` in this app, so `html[theme]` doesn't apply). Documented in step definition comment.
- `TextField` label text lives inside a `<p>` inside `<label>` — Playwright `getByLabel()` resolves it correctly via DOM containment.
- Python JSON editing preserves all keys/values correctly for translation files; sed would have been fragile given different line numbers per file.
