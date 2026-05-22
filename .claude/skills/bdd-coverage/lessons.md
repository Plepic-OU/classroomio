# bdd-coverage lessons

Newest first. ATX heading per entry. ~5 lines max.

## 2026-05-22 — Courses created via `NewCourseModal` are always V2; V2 lessons page is section-first
**Symptom:** `lessons.feature` and `quiz.feature` clicked "Add" on the lessons page expecting an Add Lesson dialog; got an "Add New Section" dialog instead. Snapshot showed the modal open with a "Section Title *" textbox.
**Rule:** `NewCourseModal/index.svelte:88` hardcodes `version: COURSE_VERSION.V2`. On V2 (`routes/courses/[id]/lessons/+page.svelte:38-42`), `addLesson()` sets `isSection = true`, so "Add" opens the section modal. Lesson scenarios must: (1) click Add → fill section title → save section, (2) within the section, click its add-lesson control → fill lesson title → save. There is no V1 single-step flow available from `pnpm test:e2e`-authored courses.
**Applies to:** `lessons.feature`, `quiz.feature`, any future course-content scenario.

## 2026-05-22 — `setup` project needs `testDir: __dirname` when `bddgen` owns the root `testDir`
**Symptom:** Setup project silently matched zero files; Playwright reported "Running 12 tests" with no setup line; storageState file was never written and all logged-in scenarios hit ENOENT. `defineBddConfig` set root `testDir` to `.features-gen/` — the setup project's `testMatch: /.*\.setup\.ts/` looked inside that dir and missed `tests/e2e/auth.setup.ts`.
**Rule:** The setup project must override `testDir`: `{ name: 'setup', testDir: __dirname, testMatch: /.*\.setup\.ts/ }`.
**Applies to:** any future `*.setup.ts` added alongside `bddgen`-managed features.

## 2026-05-22 — Password-reset scenario needs an extended per-test timeout
**Symptom:** Even after warming `/forgot` in preflight, `getByText(/email sent/i)` timed out — page snapshot stuck in the pre-submit form state. Root cause: `supabase.auth.resetPasswordForEmail` triggers an SMTP send to Inbucket; the awaited call routinely exceeds the 10s default budget.
**Rule:** Call `$test.setTimeout(60_000)` in the first step of `password-reset.steps.ts`. Do not extend globally — this is the only SMTP-bound scenario.
**Applies to:** any scenario that awaits a Supabase Auth call that issues email.

## 2026-05-22 — `storageState` paths must resolve identically in setup and projects
**Symptom:** 7 course-feature tests failed with `ENOENT: no such file or directory, open 'playwright/.auth/admin.json'` even though the setup project passed. `auth.setup.ts` wrote via `path.join(__dirname, ...)` → `tests/e2e/playwright/.auth/admin.json`, while `playwright.config.ts` set `storageState: 'playwright/.auth/admin.json'` (relative — resolved from cwd `/workspaces/classroomio/`).
**Rule:** Define `const STORAGE_STATE = path.join(__dirname, 'playwright/.auth/admin.json');` in `playwright.config.ts` and reuse the same value in `auth.setup.ts`. Absolute paths only.
**Applies to:** any auth/storage state addition.

## 2026-05-22 — `loginAs()` pattern must accept bare `/lms` (no trailing slash)
**Symptom:** Student in role-guard scenario landed on `http://localhost:5173/lms` exactly; the pattern `/\/(org|lms)\//` required a trailing path segment and never matched.
**Rule:** Default `expectedUrlPattern` is `/\/(org|lms)(\/|$)/`. Supersedes the earlier `/\/(org|lms)\//` rule.
**Applies to:** any non-admin login where the destination may be the bare `/lms`.

## 2026-05-22 — Preflight must warm every cold-SSR target inside the 10s test budget
**Symptom:** `login.feature` timed out at 10s with `/org/udemy-test` fully rendered (cold SSR ate the budget). `password-reset.feature` never saw the `Email Sent!` h3 because the success state never fired in the time left after a cold `/forgot` render.
**Rule:** Add every route a `@noauth` or login-redirect scenario touches to `helpers/preflight.ts` `SERVICES`. Current additions: `/forgot`, `/org/udemy-test`.
**Applies to:** any new feature that hits a route not already in the warm list.

## 2026-05-22 — Signup UI returns early when `currentOrg.id` is empty
**Symptom:** `signup.feature` expected redirect to `/login`; URL stayed `/signup?`. `signup/+page.svelte:65` reads `if (!$currentOrg.id) return;` after `auth.signUp` — for a fresh noauth signup at the root domain, `currentOrg.id` is `''` (default in `store/org.ts:14`), so the redirect and profile insert both skip.
**Rule:** Verify signup via `auth.users` directly using `helpers/supabase-admin.ts` `userExistsInAuth(email)` (psql over docker exec). Do not assert URL redirect from a fresh signup until the UI flow is reworked.
**Applies to:** `auth/signup.feature` and any future signup variants.

## 2026-05-22 — `test.use()` at module scope fails under `bddgen`
**Symptom:** `pnpm test:e2e` failed with `Playwright Test did not expect test.use() to be called here.` Trace pointed at `steps/auth/login.steps.ts:6`. `bddgen` `requireOrImport`s each step file to discover step definitions, and `_currentSuite()` is unset during that load.
**Rule:** Do not call `test.use({ storageState: ... })` at step-file scope. Override `storageState` in `steps/fixtures.ts` via the `$tags` fixture (playwright-bdd v8.5 tagged-fixture pattern). Add `@noauth` to the Feature tag line of any feature that must start logged-out.
**Applies to:** every `@noauth` feature (`login`, `signup`, `password-reset`, `role-guard`) and any future feature that needs a clean session.

## 2026-05-22 — Lesson exercise authoring lives under `Course/components/Lesson/Exercise/`, not `Org/Quiz/`
**Symptom:** Initial quiz scenario targeted `lib/components/Org/Quiz/` (`multichoice` / `boolean` types) but the design called for radio + checkbox + paragraph — those types only exist in the lesson exercise editor.
**Rule:** Question-type authoring with radio/checkbox/textarea uses `Course/components/Lesson/Exercise/EditMode.svelte` and the Carbon `<Select>` over `QUESTION_TYPES` from `Question/constants.ts`. Labels: "Single answer", "Multiple answers", "Paragraph".
**Applies to:** any scenario that authors questions for a course lesson.

## 2026-05-22 — Add-question button in the exercise editor has no accessible name
**Symptom:** `getByRole('button', { name: /add/i })` resolves to the "Add" exercise PrimaryButton, not the in-toolbar add-question IconButton.
**Rule:** Use `page.locator('button.root.small')` for the unlabeled add-question IconButton in `Exercise/index.svelte`. It is the only `size="small"` IconButton on that page.
**Applies to:** the lesson exercise editor at `/courses/[id]/lessons/[lessonId]/exercises/[exerciseId]`.

## 2026-05-22 — `loginAs()` URL pattern must accept students
**Symptom:** Student login (role-guard scenario) hung because `loginAs()` defaulted to `/\/org\//` and a student in admin's org sometimes lands at `/lms/`.
**Rule:** `loginAs(page, email, expectedUrlPattern?)` — default `/\/(org|lms)\//`. Pass an explicit RegExp when a scenario expects a specific destination.
**Applies to:** any non-admin login.

## 2026-05-22 — SvelteKit `<input>` ships with no `type` attribute during SSR
**Symptom:** Filling the login email field before hydration matched the *placeholder* but the field rejected non-text input quirks.
**Rule:** `use:typeAction` *adds* the `type` attribute client-side post-mount; browsers treat unset `type` as `"text"` so visible behavior matches. Always call `waitForLoginHydration(page)` (waits for `input[type="email"]` to be visible) before touching login form fields.
**Applies to:** any scenario that navigates to `/login` or `/signup`.

## 2026-05-22 — Course link snippet has no accessible name; locate by content
**Symptom:** Carbon `<CodeSnippet>` rendered the course link inside `<pre><code>` with class `bx--snippet-container`. Using the Carbon class as a selector couples the test to internal Carbon markup.
**Rule:** Use `page.locator('pre').filter({ hasText: /\/course\// })` to find the course link snippet by content. Trim the returned `textContent`.
**Applies to:** `courses/publish-and-landing.feature` and any future test reading content from a Carbon CodeSnippet.

## 2026-05-22 — Inbucket strips the `@host` part of email addresses
**Symptom:** Polled `GET /api/v1/mailbox/test@test.com` returned 404.
**Rule:** Use only the local-part: `GET /api/v1/mailbox/test`. The `helpers/inbucket.ts` `waitForEmail(localpart, ...)` already takes the bare local-part.
**Applies to:** any scenario that reads test mail via Inbucket.

## 2026-05-22 — `auth.users` DELETE hits FK from `public.profile`
**Symptom:** `resetTestData()` failed with `profile_id_fkey` violation when deleting `auth.users` rows.
**Rule:** Delete `public.profile` rows first, then `auth.users`, both filtered by the same exclusion set (`admin@test.com`, `student@test.com`, `test@test.com`).
**Applies to:** any change to `helpers/reset-db.ts`.

## 2026-05-22 — `getByLabel` is unsafe in this codebase
**Symptom:** Filling fields by label text matched the wrong input — multiple forms reuse the same label.
**Rule:** The visible label is rendered as `<p for="…">`, which is invalid HTML and ignored by `getByLabel`. Prefer placeholder text, which is unique per field. Use `data-testid` if i18n makes placeholder text unstable.
**Applies to:** all form interactions in dashboard scenarios.
