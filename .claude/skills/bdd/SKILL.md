# BDD Skill — Authoring Conventions

## Sub-commands

### `/bdd audit` — gap report (read-only)

1. Parse `docs/c4/bdd-flows.md` (flat Markdown checklist). If the file is absent, emit: `bdd-flows.md not found — create it first` and stop.
2. Glob `tests/e2e/features/**/*.feature`, extract all scenario names (normalise: lowercase, spaces→hyphens).
3. Cross-reference: flag checked-but-missing flows and unchecked scenarios.
4. Recommend the next 1–3 flows to write, respecting phase order and data prerequisites.

### `/bdd extend <flow-name>` — generate one feature + steps

1. Read this `SKILL.md` and `reference/svelte-carbon.md`.
2. For Playwright and playwright-bdd API questions, query Context7 MCP (`/vitalets/playwright-bdd`, `/microsoft/playwright.dev`).
3. Identify involved routes by grepping `apps/dashboard/src/routes/`. Use `docs/c4/layer3-dashboard.md` as a hint only (lossy at `--max-elements 30`).
4. Reuse existing steps from `tests/e2e/steps/_shared/`; generate new steps only for novel verbs.
5. Apply the correct `@auth-*` tag. Import `{ Given, When, Then }` from `helpers/fixtures.ts`.
6. Present the diff. Do not run until user confirms.

### `/bdd run [<glob>]` — execute and triage

Full suite:
```bash
cd tests/e2e && npx bddgen && npx playwright test --config playwright.config.ts
```

Single scenario by name or tag:
```bash
cd tests/e2e && npx bddgen && npx playwright test --config playwright.config.ts --grep "scenario name"
```

`--grep` matches against generated files in `.features-gen/`, not source `.feature` files.

On pass: tick the checkbox in `docs/c4/bdd-flows.md`.
On fail: classify (see Failure Triage below) and propose a fix. Wait for user confirmation before applying.

---

## Determinism rules (apply to every scenario)

### Rule 1 — DB reset before every scenario
`BeforeScenario(resetTestData)` runs automatically via `helpers/fixtures.ts`. Do not add manual resets.

### Rule 2 — Deterministic names via scenario identity
Use `` `Course_${$testInfo.title.replace(/[^a-zA-Z0-9_-]/g, '_')}` `` instead of hard-coded literals. Never use `Date.now()` — it hides isolation failures.

### Rule 3 — Auth via storageState, not UI replay
Every scenario must carry exactly one tag:
- `@auth-admin` — org admin user
- `@auth-student` — learner user
- `@auth-teacher` — teacher user (Phase 3+)
- `@no-auth` — anonymous (public pages, login page)

The `storageState` fixture in `fixtures.ts` picks the correct `.auth/*.json` file based on tags.

### Rule 4 — Wait for the right readiness signal
| Route type | Readiness signal |
|---|---|
| Initial `goto('/login')` | `page.locator('input[type="email"]').waitFor()` |
| Client-side navigation | `await expect(locator).toBeVisible()` for the first meaningful element |
| `/lms/*` data routes | Wait for a rendered element that proves data arrived |

### Rule 5 — Selector hierarchy
`getByRole` > `getByLabel` > `data-testid` > `getByPlaceholder` > `getByText` > **never** CSS class selectors or XPath.

**Critical:** `Form/TextField.svelte` renders labels as `<p>` not `<label>`, so `getByLabel()` returns zero elements for text fields. Use `getByPlaceholder()` or `data-testid`. See `reference/svelte-carbon.md` for details.

### Rule 6 — Artifacts only on failure
Already configured in `playwright.config.ts`: `screenshot: 'only-on-failure'`, `trace: 'on-first-retry'`, `video: 'on-first-retry'`.

---

## Phase 2+ data prerequisites

Every course-dependent scenario must create its own course and membership in `Given` steps using factory steps from `steps/_shared/`. Do not rely on seeded courses — they are wiped by `resetTestData()` before every scenario.

---

## Failure triage

| Category | Signal | Action |
|---|---|---|
| **App bug** | HTTP 500, route 404, DB constraint error, RLS-induced empty result | Report trace URL and error. Do not modify the test. Suggest filing an issue. |
| **Test bug** | Fragile selector, missing wait, assertion against dynamic value | Propose a targeted fix. Apply only after confirmation. |
| **Flake** | Inconsistent — passes on re-run with no code change | Re-run once. If second fail: treat as test bug. Never silently retry-loop. |

---

## Self-improvement mechanism

After triaging a **test-bug** failure, ask: *"Would another scenario hit this same issue?"*

If yes, the fix is a convention. Propose an edit to `SKILL.md` or `reference/svelte-carbon.md` staged alongside the scenario fix. Trigger conditions (all must be true):
1. Fix resolves a test bug (not app bug or flake).
2. Pattern generalises to a UI component or route encountered in future scenarios.
3. Convention not already documented.

---

## Known gotchas

- **`@flaky` tag** is informational only — Playwright does not skip these automatically. Exclude with `--grep-invert @flaky`.
- **Supabase JWT expiry** — JWTs expire at 3600s. If PostgREST returns 401 mid-run, restart with `pnpm test:e2e` to regenerate storage state.
- **Skip `auth-setup` at your peril** — stale `.auth/*.json` files with expired JWTs cause silent auth failures. Always run the full `pnpm test:e2e`.
- **`bddgen` before `playwright test`** — always run `npx bddgen` first; the `.features-gen/` output is the actual test input.
