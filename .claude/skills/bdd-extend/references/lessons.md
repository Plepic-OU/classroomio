# Lessons

Append-only. UI/interaction patterns and timing quirks discovered while drafting or fixing
BDD scenarios — read this before writing new steps so you reuse a known pattern instead of
rediscovering it (or hitting the same bug again).

- **Post-login landing route depends on role.** Admins land on `/org/<slug>`, students land
  on `/lms` — there is no single redirect target. Don't hardcode `waitForURL(/\/org\//)` in
  a step that might run as a non-admin role; wait for navigation away from `/login`
  (`!url.pathname.startsWith('/login')`) or match `/\/(org|lms)/` if you specifically need
  to confirm *some* authenticated landing.

- **`/` is a public marketing page with no server-side auth redirect.** Authentication is
  entirely client-side (Supabase session in `localStorage`, key `sb-<project-ref>-auth-token`;
  no auth cookies are set). The redirect off the marketing page for an already-authenticated
  visitor happens in a client-side boot check that reads `localStorage` at hydration time —
  restoring `localStorage` *after* first load (e.g. a post-navigation `page.evaluate()`) is
  too late, the check already ran. If you need a page to start "logged in" without a UI
  login, seed `localStorage` via `page.addInitScript()` *before* the first navigation, not
  after (see `tests/e2e/helpers/auth-state.ts` `restoreStorageState`).

- **`NewCourseModal` is two-step.** Step 0 is course-type selection (a default type is
  pre-selected), step 1 is title/description entry. Click "Next" once before filling the
  title field.

- **The `.auth` storageState cache must be freshness-checked, not just existence-checked.**
  Supabase rotates refresh tokens (`supabase/config.toml` `enable_refresh_token_rotation`),
  so a cached session file from a previous work session can be present but dead. Reusing it
  blindly (`fs.existsSync`) produces a scenario that hangs until timeout with no clue why.
  `isStorageStateFresh()` in `tests/e2e/helpers/auth-state.ts` checks the cached JWT's
  `expires_at` with a generous buffer (currently 30min against a 60min `jwt_expiry`) before
  reuse — the buffer needs to stay generous because it's checked once per worker, not once
  per scenario that reuses the file.

- **`workers: 1` is load-bearing, not incidental.** `helpers/reset-db.ts` truncates the
  whole `public` schema globally (see `PRESERVE_TABLES`), not scoped to a worker or test.
  Don't raise `playwright.config.ts`'s `workers` count without redesigning the reset
  strategy first — a second worker's reset would wipe data an in-flight scenario in another
  worker still needs.

- **The lessons/content sidebar's "+" and "menu" buttons need `{ force: true }`.** On a
  course's Content tab (`courses/[id]/lessons`), each section's add-lesson ("+") and
  overflow-menu buttons live inside an `svelte-dnd-action` drag-and-drop zone
  (`role="list" aria-disabled="true" aria-describedby="dnd-zone-drag-disabled"`) that's
  marked `aria-disabled` whenever dragging isn't active. The buttons themselves have no
  `disabled` attribute and `pointer-events: auto` — a real mouse click works fine — but
  Playwright's actionability check inherits the ancestor's `aria-disabled` and refuses a
  plain `.click()`. Use `{ force: true }` (see `steps/courses/lessons.steps.ts`).

- **Section/lesson title inputs have no placeholder, but are label-wrapped.** The "Add New
  Section"/"Add New Lesson" forms render a single `<label><p>Section Title *</p><input
  .../></label>` — `getByPlaceholder` won't work (placeholder is `""`), but `getByLabel`
  resolves fine via the implicit wrapping association, no explicit `for`/`id` needed.

- **Clicking a course's "Content" sidebar item navigates to `courses/[id]/lessons`.** The
  UI label is "Content", not "Lessons" — it's a `<span>` inside a Carbon-style nav button,
  not a plain `<a href>`, so target it with `getByText('Content', { exact: false })` (or
  similar) rather than `getByRole('link', ...)`.

- **The student invite link is generated client-side, not server-issued.** Under a course's
  People tab → Add → "Invite Students", "Copy Link" writes `invite/s/<base64 JSON of {id,
  name, description, orgSiteName}>` straight to the clipboard — there's no backend call to
  fetch an existing invite token. To read it in a step, grant clipboard permissions on the
  page's context *before* clicking Copy Link (`await page.context().grantPermissions([
  'clipboard-read', 'clipboard-write'])`; the default `page` fixture has none), then
  `await page.evaluate(() => navigator.clipboard.readText())`.

- **Passing a value between steps in one scenario: use the `sharedState` fixture, not a
  module-level variable.** `tests/e2e/fixtures.ts` exposes a test-scoped `sharedState`
  object (fresh per scenario) for exactly this — e.g. stashing a generated invite link in
  one step to `page.goto()` in a later one. A module-level `let` in a `*.steps.ts` file
  would leak across scenarios that share a worker process.

- **Org settings: go by URL, and wait for the name field to fill.** The sidebar's settings
  links live inside collapsed dropdowns (profile menu, org switcher), so steps navigate
  straight to `/org/<slug>/settings?tab=org` (slug parsed from the post-login URL) and
  assert `getByRole('tab', { name: 'Organization', selected: true })`. The "Organization
  Name" input (label-wrapped, `getByLabel` works) is bound to the `currentOrg` store and is
  `""` for a moment after every load — `await expect(field).not.toHaveValue('')` before
  reading or filling it (see `steps/org/settings.steps.ts`).

- **Don't treat a success snackbar as proof of a save.** `OrgSettings.svelte`'s
  `handleUpdate()` shows "Update successful" *before* checking the Supabase error. Wait on
  the write itself instead: `page.waitForResponse` for the `PATCH /rest/v1/<table>` and
  assert `.ok()`.

- **Changes to PRESERVE_TABLES rows need their own cleanup.** `resetTestData()` never
  touches `organization`, `profile`, etc., so a scenario that edits one of those rows and
  fails midway leaves the edit behind for every later run. Pattern: record the original
  value in `sharedState`, restore it in a final step, and add an `AfterScenario` hook
  (exported from `fixtures.ts`) that writes it back via `docker exec ... psql` only when
  that step didn't run. Pass values as `psql -v` variables (`:'name'`), not string-built
  SQL.

- **Per-scenario timeout: use the `@timeout:<ms>` tag, not the global config.**
  playwright-bdd 8.5 supports `@timeout:20000` (and `@slow`) on a scenario. Use it only
  when a step-duration breakdown (`--reporter=json`, `results[].steps[].duration`) shows
  the time is spread across legitimately slow steps (e.g. full reloads in dev mode) rather
  than one hung step.
