---
name: bdd-coverage
description: |
  Use when the user asks to add, extend, or fix BDD/Playwright tests for ClassroomIO.
  Triggers: "add a test for X", "fill out BDD coverage", "why is scenario Y flaky".
---

# bdd-coverage

Extends ClassroomIO's `tests/e2e/` BDD suite by detecting route-vs-feature gaps and authoring the missing `.feature` + `.steps.ts` files in the codebase's established style.

## File layout

```
tests/e2e/
  features/<area>/*.feature
  steps/<area>/*.steps.ts
  steps/common.steps.ts          shared Given "I am logged in as ..."
  steps/fixtures.ts              base.extend + createBdd; exports Given/When/Then + hooks
  helpers/
    hydration.ts                 waitForLoginHydration(page)
    login.ts                     loginAs(page, email, expectedUrlPattern?)
    inbucket.ts                  waitForEmail / extractLink
    reset-db.ts                  resetTestData()
    preflight.ts                 globalSetup; warms routes + Inbucket
    test-users.ts                seeded user table
  auth.setup.ts                  storageState bootstrap
  playwright.config.ts
```

Skill writes only to:
- `tests/e2e/features/**/*.feature`
- `tests/e2e/steps/**/*.steps.ts`
- `.claude/skills/bdd-coverage/lessons.md`

Helpers, `auth.setup.ts`, `playwright.config.ts`, and this `SKILL.md` are not auto-edited; propose changes to the user instead.

## Tag taxonomy

| Tag | Meaning |
|---|---|
| `@p0` `@p1` | Tier label. Useful for `--grep "@p0"` scoping. |
| `@slow` | SSR-heavy paths; eligible for extended per-test timeout. |
| `@needs-reset` | Opt-in to per-scenario DB reset. Default-on for authoring features. |
| `@noauth` | Feature runs without the cached `storageState` admin cookie. Set on the Feature tag line; `steps/fixtures.ts` overrides `storageState` to empty when `$tags` includes `@noauth`. Do NOT call `test.use(...)` in step files — it breaks `bddgen`. |
| `@role-guard` | Single Tier 1 negative-auth smoke. |

## Determinism rules

1. **Web-first assertions only.** `await expect(locator).toBeVisible()` / `expect(page).toHaveURL()`. No `page.waitForTimeout(...)`, no `page.waitForURL(...)`, no bare `locator.waitFor(...)`.
2. **Always go through `loginAs()`.** Never repeat login selectors in feature steps. Exception: `auth/login.feature` itself. `loginAs(page, email, expectedUrlPattern?)` accepts a custom URL pattern; default `/\/(org|lms)\//` handles both admin and student.
3. **Selector priority is `getByRole` > `getByPlaceholder` > `getByText` > CSS.** `getByLabel` is avoided — `Form/TextField.svelte` wraps the visible label as an inner `<p for="…">` (invalid HTML; ignored). Placeholders are unique per field. CSS class selectors are the escape hatch for icon-only buttons with no accessible name (e.g. `button.root.small` for the unlabeled add-question IconButton).
4. **Test timeout stays at 10s.** Raise per-step via `$test.setTimeout()` only with a comment explaining why. For cold-compile routes, scope a `@slow` tag.
5. **Preflight pre-warms routes.** `WARMUP_TIMEOUT = 180_000` in `helpers/preflight.ts`. `SERVICES` includes `/login` and `/org/<seed-slug>/courses` (NOT bare `/courses` — does not exist). When authoring new scenarios that touch a previously-untouched route, add it to `SERVICES`.
6. **Preflight probes Inbucket.** `SERVICES` includes `http://localhost:54324` so the password-reset scenario fails fast when Inbucket is down. No SMTP probe needed in v1.
7. **`waitForHydration` is `waitForLoginHydration`.** Single call site. Don't parameterize the selector speculatively.
8. **Cold-SSR is a flake to design around, not a feature.** First-render of `/login` measured ~30s–2min. Pre-warm via preflight; do not try to fix in steps. If a new route runs cold inside the 10s test budget, add it to preflight `SERVICES`.
9. **`workers = 1`.** Required while `resetTestData()` is global. Module-level `let` state between steps is safe under this constraint; flag it in `lessons.md` if workers ever rises.
10. **SSR `<input>` ships with no `type` attribute.** `use:typeAction` *adds* it client-side post-mount; browsers treat unset `type` as `"text"`, so visible behaviour matches. The hydration helper waits for the type attribute to *appear*, not to change.

## Gap-detection algorithm (inline; no scripts)

1. **Build "should cover" set:**
   ```
   find apps/dashboard/src/routes -name '+page.svelte' | sort
   ```
   Dynamic segments (`[id]`, `[slug]`) collapse to one canonical scenario plus one error-path scenario. The C4 component map (`docs/c4/L3-dashboard.md`) is a structural overview only — routes remain the source of truth.

2. **Build "covered" set:**
   ```
   grep -rE '^(Feature|Scenario):' tests/e2e/features
   grep -rEo "page\.goto\(['\"][^'\"]+['\"]\)" tests/e2e/steps
   ```

3. **Diff in-context.** Emit a short candidate list grouped by C4 component, tagged P0 / P1 / deferred.

4. **Confirmation gate.** Never write a feature without showing the candidate list and asking the user to pick (multi-select, recommended-first, 1–3 at a time).

5. **Authoring template.** Load `helpers/login.ts`, `test-users.ts`, and the closest existing `.steps.ts` as style anchors. Reuse `Given "I am logged in as {string}"` and `Given "I have created a course named {string}"` from `steps/common.steps.ts` rather than re-inventing.

## Run loop

1. **Preflight** — run the two inline searches above; diff in-context; show top 3 gaps; ask which to author (multi-select, single prompt).
2. **Pre-warm** — issue one long curl (180s timeout) to each chosen route to dodge cold-SSR flake.
3. **Author** — write `.feature` + `.steps.ts` reusing helpers. Each new authoring feature file gets `@p0 @needs-reset` at the feature tag line. Auth features get `@p0 @noauth` (no `@needs-reset`).
4. **Run** — `pnpm test:e2e -- --grep "@<new-tag>"`. The script is `npx bddgen --config tests/e2e/playwright.config.ts && npx playwright test --config tests/e2e/playwright.config.ts` (the `bddgen` step is mandatory; it writes `.features-gen/` which Playwright runs).
5. **Diagnose on failure** — read the failing trace/screenshot from `playwright-report/`. If a generalizable rule emerges (selector that should be more specific, hydration wait that needs a longer timeout, a route the preflight forgot to warm), write a `lessons.md` entry.
6. **Re-run once.** If still red, surface the failure to the user with prose diagnosis — do not loop autonomously.

## Library pointers

- **playwright-bdd 8.5** — hooks created via `createBdd(test)` after `base.extend(...)`. `BeforeScenario({ tags: '@x' }, fn)` is tag-aware. Built-in fixtures: `$tags`, `$test`, `$testInfo`, `$step`. Tag expressions use cucumber syntax (`'@a and not @b'`, `'@a or @b'`); comma-separated lists are invalid. Docs: https://vitalets.github.io/playwright-bdd/
- **Playwright 1.53** — prefer `getByRole` / `getByPlaceholder` / `getByText` over CSS. `await expect(locator).toBeVisible()` auto-retries. `test.extend<T>()` for fixtures; `storageState` + `dependencies` for auth bootstrap.
- **Svelte 4 + SvelteKit** — SSR omits the `type` attribute on `<input>`; `use:typeAction` *adds* it client-side post-mount. Always call `waitForLoginHydration(page)` before filling login fields.
- **Course type strings** — `lib/components/Courses/components/NewCourseModal/index.svelte` exposes exactly `"Live Class"` and `"Self Paced"`.
- **Question types (lesson exercise editor)** — `lib/components/Question/constants.ts`: `RADIO=1` ("Single answer"), `CHECKBOX=2` ("Multiple answers"), `TEXTAREA=3` ("Paragraph"). Authoring is in `lib/components/Course/components/Lesson/Exercise/EditMode.svelte`.
- **Supabase local** — `resetTestData()` execs into container `supabase_db_classroomio` and truncates `public.*` tables. Preserve list: `profile`, `organization`, `organizationmember`, `organization_plan`, `role`, `question_type`, `submissionstatus`, `currency`, `groupmember`. Also deletes `auth.users` matching `%@test.com` except seeded fixtures.
- **Inbucket** — Supabase ships this at `http://localhost:54324`. `GET /api/v1/mailbox/<localpart>` lists messages; Inbucket strips the `@host` part so `user@test.com` lands in mailbox `user`. Supabase Auth password-reset mails are captured natively; no SMTP listener needed.

## Confirmation gate

Never auto-author features. Always show the gap list and ask which to write. YAGNI applies — do not generate placeholder scenarios.

Read `lessons.md` before authoring any new scenario.
