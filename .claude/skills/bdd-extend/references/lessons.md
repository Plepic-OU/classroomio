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
