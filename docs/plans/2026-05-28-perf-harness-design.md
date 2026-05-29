# Performance harness (Lighthouse gate) — design

**Date:** 2026-05-28
**Scope:** Workshop W2 — a second behavioural gate alongside the BDD suite. Runs
Lighthouse against a fixed route list under the **production** build, aggregates
deterministic metrics, compares to a baseline, and exits non-zero on regression.
**Status:** approved for implementation (brainstorm settled; spec is authoritative).

This document is the source of truth for the implementation. Where the workshop
prompt (hints #1–#7, the required interface, the seed spec, and the "done when"
checks) dictates a detail, that wins over any preference expressed here.

---

## 0. Authoritative constraints (from the W2 prompt)

- **Measure the production build, never `pnpm dev`** (hint #1). Vite-dev ships
  ~27 MB JS/page vs ~1.4 MB prod; code wins are invisible against that floor.
- **Desktop preset + _simulated_ throttling** (hint #2): `throttlingMethod:
'simulate'`, `rttMs: 40`, `throughputKbps: 10240`, `cpuSlowdownMultiplier: 1`.
- **Clear the HTTP cache before every measurement** (hint #3) so JS-byte numbers
  reflect a cold network even though Chrome is reused across routes.
- **Authed routes**: log in as the persona, preserve the localStorage session
  into the Lighthouse run on the _same_ Chrome instance (hint #4). After each
  authed run, verify `finalUrl` is the requested path, not `/login`.
- **Gate only on deterministic metrics** (hints #5/#6): JS bytes and LCP. TBT,
  FCP, CLS, total bytes, score are displayed with Δ but never gate.
- **Don't pre-judge "what's slow"** (hint #7): any claim about _why_ a number is
  what it is must be proven from the Lighthouse JSON.
- `/lms/mylearning` is **intentionally slow** with the seed data: expect a
  `PAGE_HUNG` runtimeError and null metrics. That is expected workshop content,
  not a harness bug. Record it (null metrics + `runtimeError` tag) and move on.

---

## 1. File layout (required interface — names are fixed)

```
perf/
  lighthouse.mjs     # the runner — entry for `pnpm perf`
  seed.mjs           # the seed — entry for `pnpm seed:perf`
  routes.json        # committed; schema below
  baseline.json      # written by --save-baseline; GITIGNORED
  results/           # <timestamp>--<sanitized-path>.json per route; GITIGNORED
  .gitignore         # excludes baseline.json and results/
  README.md          # quick start, build/serve, what's measured, thresholds, exit codes
  gate.mjs           # OPTIONAL: split out only if lighthouse.mjs exceeds ~300 lines
                     #   (baseline load/compare + Δ table)
```

**Layout decision:** the runner is **one file** (`lighthouse.mjs`) covering chrome
resolution+launch, login, per-route reset, LH config/run, metric extraction, gate,
and report; `seed.mjs` is separate (different entry/deps). Split `gate.mjs`
(compare + table) out **only if** `lighthouse.mjs` grows past ~300 lines. No
5-file `lib/` split — that's premature structure for an internal harness. Only the
top-level names (`lighthouse.mjs`, `seed.mjs`, `routes.json`, `baseline.json`,
`results/`, `.gitignore`, `README.md`) are part of the required interface.

### routes.json (committed; from hint #4, admin email changed — see note below)

```json
{
  "users": {
    "admin": { "email": "perf-admin@workshop.local", "password": "123456" },
    "student": { "email": "perf-student-1@workshop.local", "password": "123456" }
  },
  "routes": [
    "/login",
    "/course/perf-course-1",
    { "path": "/lms/mylearning", "as": "student" },
    { "path": "/org/udemy-test", "as": "admin" }
  ]
}
```

Plain string = public route (no auth). Object with `"as": "<user>"` = log in as
that user, preserve the session into the Lighthouse run.

> **Deviation from the spec's verbatim routes.json:** the admin email was changed
> from `admin@test.com` to `perf-admin@workshop.local`. The production build
> force-logs-out `@test.com` emails (`appSetup.ts:79`, `!dev`), so `admin@test.com`
> cannot hold a session under `node build` and its authed route could never render
> — failing done-when #4. The seed creates `perf-admin@workshop.local` as an org
> admin of Udemy Test; this mirrors the student persona (which the spec already
> made `workshop.local`) and is the minimum-deviation fix. See §11.

---

## 2. Browser + Lighthouse wiring (no Puppeteer)

**Deliberate deviation from the prompt's wording.** Hint #4 says "Puppeteer-driven
login." Puppeteer is **not** installed, and the brainstorm already settled on
Playwright (the BDD suite's `@playwright/test` is a root devDep). The mechanism
the prompt actually requires is "log in, preserve the localStorage session into
the Lighthouse run on the same Chrome (`port: chrome.port`)" — which is
tool-agnostic. We use **Playwright `chromium.connectOverCDP('http://localhost:<port>')`**
against the chrome-launcher Chrome to do login + per-route storage control. This
is functionally identical to the Puppeteer recipe, avoids a second browser
download, and changes none of the required filenames or scripts.

One Chrome instance, three roles:

1. **chrome-launcher** opens Chrome and exposes a debug `port`.
2. **Lighthouse** runs against that `port` (`flags.port = chrome.port` — matches
   hint #4's literal "preserve the session into the Lighthouse run on the same
   Chrome (`port: chrome.port`)").
3. **Playwright `connectOverCDP`** to the same `port` for auth + cache control.

**CDP-connect constraints (verified):** a `connectOverCDP` browser exposes the
_existing_ context — use `browser.contexts()[0]`, **not** `browser.newContext()`
(which throws over CDP). Create a page on that context for storage work and close
only that page; never close Lighthouse's tab. **Routes run strictly serially** —
one shared Chrome with per-route cache/storage reset means parallel routes would
cross-contaminate the injected token.

### Chrome resolution order (prompt-mandated)

1. `PERF_CHROME_PATH` env var, if set.
2. Playwright's bundled Chromium — `import { chromium } from 'playwright-core'`,
   `chromium.executablePath()`. **Guard with `fs.existsSync`** — `executablePath()`
   returns a path even when the binary isn't installed; fall through to (3) if it's
   missing. The devcontainer has `chromium-1178` installed via `playwright install`,
   so this tier is the one that fires; there is **no** system Chrome (tier 3 fails
   here), making this dependency load-bearing.
3. chrome-launcher's own default discovery (system Chrome).

Launch flags: `--no-sandbox --disable-dev-shm-usage` (devcontainer), headless.

### Dependencies added to root `devDependencies`

`lighthouse`, `chrome-launcher`, `playwright-core`, `@supabase/supabase-js`
(none currently resolvable from the repo root under strict pnpm; verified — they
resolve once added to root devDeps and `pnpm i` is run, because pnpm symlinks
top-level devDeps and Node walks up from `perf/` to the root `node_modules`).
**Pin `playwright-core` to exactly `1.53.0`** (not `^1.53.0`) so it matches the
already-installed Chromium revision (1178) that ships with `@playwright/test@1.53.0`;
a floating range could resolve a newer minor whose `executablePath()` points at an
un-installed revision. Root `package.json` has no `"type": "module"`, so all
harness files use the `.mjs` extension (Lighthouse v12 is ESM-only). `perf/` is a
loose root dir, intentionally **not** a pnpm workspace (matches no `pnpm-workspace.yaml`
glob) and has no `package.json`.

---

## 3. Lighthouse config (hint #2)

Extend the desktop preset and override throttling:

```js
const flags = { port: chrome.port, onlyCategories: ['performance'], disableStorageReset: true };
const config = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop',
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false
    },
    throttlingMethod: 'simulate',
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0
    },
    onlyCategories: ['performance']
  }
};
```

Under `throttlingMethod: 'simulate'`, only `rttMs`, `throughputKbps`, and
`cpuSlowdownMultiplier` drive the result — the `requestLatencyMs` /
`downloadThroughputKbps` / `uploadThroughputKbps` trio (devtools-throttling knobs)
is ignored, so the gate's determinism rests on the first three.

`disableStorageReset: true` is **critical**: it stops Lighthouse from wiping the
localStorage auth token we inject (hint #3 warns about exactly this). We clear the
HTTP cache ourselves (§4) instead of relying on Lighthouse's storage reset.

---

## 4. Per-route determinism (hint #3)

Because storage reset is disabled _and_ the browser is reused, every route resets
its own state immediately before measuring, via a short-lived CDP page on the base
origin:

1. CDP `Network.clearBrowserCache` — clears the HTTP cache only; localStorage is
   left intact.
2. Navigate to `<base>/`, `localStorage.clear()`, set `umami.disabled='1'`
   (mirrors the BDD `.auth` states). If the route has `as`, re-inject **every**
   captured `sb-localhost-auth-token*` key **verbatim as the raw string** —
   supabase-js v2 may chunk a large session across `…-auth-token.0`, `.1`, … so
   capture/inject all matching keys; never `JSON.parse`/reserialize or extract
   only `access_token` (a bare access token won't restore the session → redirect
   to `/login` → exit 2).
3. Close the storage page, then run Lighthouse on the route URL.

This makes `/login` cold-and-anonymous regardless of run order, and authed routes
carry exactly their persona's token. The storage key is `sb-localhost-auth-token`
because the Supabase URL host is `localhost` (key = `sb-<host>-auth-token`); it is
**port-independent** (same name at `:5173` and `:3000`) but URL-coupled — noted in
the README.

### Persona login (at the start of the perf run, on the perf origin)

Each persona logs in in its **own throwaway `chromium.launch()` browser** (mirrors
`tests/e2e/fixtures/storage-state.ts`), not the shared chrome-launcher instance —
a reused instance let a prior persona's session linger and bounce `/login →
/logout`. For each persona referenced by an `as` route: Playwright drives `<base>/login`,
**calls `waitForHydration` first** (wait for `input[type='email']` — the login
fields render as `type='text'` pre-hydration and only become `email`/`password`
after Svelte hydration; filling before that silently fails on a cold bundle, which
the cleared-cache regime guarantees), fills `you@domain.com` / `************`,
clicks the `/log\s*in/i` button, then `waitForURL(landingPattern, {timeout:
30_000})` with the **per-persona** pattern (admin → `/\/org\//`, student →
`/\/lms(\/|$|\?)/`), then captures all `sb-localhost-auth-token*` keys from
localStorage. Mirrors `tests/e2e/helpers/login.ts` / `fixtures/storage-state.ts`
(30s budgets included).

**Critical: log in fresh against the perf base origin** (`PERF_BASE_URL`, i.e.
`:3000`). Do **not** import the committed `tests/e2e/.auth/*.json` — those are
captured at `:5173` and localStorage is origin-partitioned, so reusing them
injects a token the `:3000` page can't see (→ `/login` → exit 2). A login that
times out or lands on an unexpected URL is a **harness error → exit 2**. Tokens
are captured at run start (after the separate build + seed steps); the 4-route
measurement completes well within the 3600s JWT TTL, so no mid-run refresh is
needed.

---

## 5. Metric extraction (hint #7 — prove from the JSON)

Per route, from the Lighthouse report (`lhr`):

| Field        | Source                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------- |
| score        | `categories.performance.score * 100`                                                            |
| lcpMs        | `audits['largest-contentful-paint'].numericValue`                                               |
| tbtMs        | `audits['total-blocking-time'].numericValue`                                                    |
| fcpMs        | `audits['first-contentful-paint'].numericValue`                                                 |
| cls          | `audits['cumulative-layout-shift'].numericValue`                                                |
| jsBytes      | Σ `audits['network-requests'].details.items` where `resourceType === 'Script'` → `transferSize` |
| totalBytes   | Σ all `audits['network-requests'].details.items[].transferSize`                                 |
| runtimeError | `lhr.runtimeError?.code` (e.g. `PAGE_HUNG`) or null                                             |
| finalUrl     | `lhr.finalDisplayedUrl` (fallback `lhr.finalUrl`)                                               |

When `runtimeError` is present, all numeric metrics are `null`. The session-lost
check (§7) matches `finalUrl` against an anchored path test (`/\/login(\/|\?|$)/`
after normalizing trailing slash/query), not a substring `includes('/login')`.

### Result persistence

Full `lhr` JSON written to `perf/results/<timestamp>--<sanitized-path>.json`.
`timestamp` = `YYYY-MM-DDTHH-mm-ss` (colons replaced). `sanitized-path` = path
with leading `/` stripped and remaining `/` → `-` (`/login` → `login`,
`/lms/mylearning` → `lms-mylearning`, `/org/udemy-test` → `org-udemy-test`,
`/course/perf-course-1` → `course-perf-course-1`). The aggregated per-route
summary is what gets compared and (with `--save-baseline`) written to
`perf/baseline.json`.

baseline.json shape: `{ generatedAt, baseUrl, routes: [ { path, as, finalUrl,
score, lcpMs, tbtMs, fcpMs, cls, jsBytes, totalBytes, runtimeError } ] }`.

---

## 6. Gate (hints #5/#6)

Routes matched to baseline by `(path, as)`. A **regression** (→ exit 1) is any of:

- **JS bytes grew > +1%**: `base.jsBytes != null && cur.jsBytes != null &&
(cur.jsBytes - base.jsBytes) / base.jsBytes > 0.01`.
- **LCP grew > max(+100ms, +5%)**: `base.lcpMs != null && cur.lcpMs != null &&
(cur.lcpMs - base.lcpMs) > Math.max(100, 0.05 * base.lcpMs)`.
- **Crash from a healthy baseline**: `base.lcpMs != null && cur.lcpMs == null`.

Never gates: TBT, FCP, CLS, totalBytes, score (Δ shown only — TBT alone swings
30–60%/run). Never a regression: null-vs-null (steady-state `mylearning`),
null-baseline → real value (improvement), or a route absent from the baseline
(reported as "new").

**Baseline file absent on a default run.** Because `baseline.json` is gitignored
(never committed), a fresh clone has no baseline. A plain `pnpm perf` with no
`perf/baseline.json` prints the measurements with no Δ columns, logs
"no baseline — run with `--save-baseline` to create one", and **exits 0** (nothing
to gate). This is the normal first-run state, not a harness error.

---

## 7. Exit codes & flags

| Code | Meaning                                                    |
| ---- | ---------------------------------------------------------- |
| 0    | pass; or `--save-baseline`; or `--no-gate`                 |
| 1    | at least one gated regression (only when gating is active) |
| 2    | harness error                                              |

**Harness errors (exit 2):** base URL preflight unreachable; Chrome fails to
launch; persona login times out; an authed route's `finalUrl` ends in `/login`
_with no runtimeError_ (session lost); Chrome dies mid-run.

**PAGE_HUNG is not a harness error.** Discriminate by **error shape**: if the
Lighthouse run handed back an `lhr` carrying `runtimeError.code` (e.g. `PAGE_HUNG`,
`NO_FCP`) → record the route with null metrics + that code and continue; if the
call threw with **no `lhr`** (connection/protocol error — Chrome died) → exit 2.
This keys off "did Lighthouse return a report?" and needs no extra CDP plumbing.

**Flags** (after `--` so pnpm forwards them):

- `--save-baseline` — measure, write `perf/baseline.json`, exit 0 (no compare).
- `--no-gate` — measure, compare, print, always exit 0.
- default — measure, compare, print, exit 0/1.

Root scripts: `"perf": "node perf/lighthouse.mjs"`,
`"seed:perf": "node perf/seed.mjs"`. Baseline via `pnpm perf -- --save-baseline`
(documented in README; no separate script required).

---

## 8. Seed (`perf/seed.mjs`, `pnpm seed:perf`)

Bulks the local Supabase to realistic volume so DB-shaped perf issues surface.
Credentials from `apps/dashboard/.env`: `PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`)
and `PRIVATE_SUPABASE_SERVICE_ROLE` (or `SUPABASE_SERVICE_ROLE_KEY`). Uses a
service-role `@supabase/supabase-js` client.

**Target org:** `1a1dcddd-1abc-4f72-b644-0bd18191a289` (Udemy Test).
**Roles** (`apps/dashboard/src/lib/utils/constants/roles.js`): ADMIN=1, TUTOR=2,
STUDENT=3. Tutors and students share `groupmember`, distinguished by `role_id`.

Construct the supabase-js client with `auth: { persistSession: false,
autoRefreshToken: false }` so no user session attaches and inserts truly bypass
RLS.

**Creates:**

- 500 student auth users `perf-student-N@workshop.local` / `123456` via
  `auth.admin.createUser` (`email_confirm: true`) — never the public signup
  endpoint. Sequential/throttled; log progress; tolerate duplicate (409) on re-run.
- A `profile` row per user. **Required NOT-NULL/UNIQUE columns** (verified against
  the schema): `id` = auth user id; `fullname` (e.g. `Perf Student N`); `username`
  **NOT NULL + UNIQUE** (e.g. `perf-student-N`); `email` (UNIQUE) =
  `perf-student-N@workshop.local`; `role` = STUDENT. Omitting `username`/`fullname`
  fails the constraints.
- **An `organizationmember` row per student** in org `1a1dcddd-…` (`role_id: 3`).
  **This is load-bearing** — `/lms/mylearning` only fetches once `$currentOrg.id`
  resolves, which comes from `organizationmember`; without it the page renders
  empty/fast instead of PAGE_HUNG and the whole premise breaks.
- **One admin persona** `perf-admin@workshop.local` (`auth.admin.createUser`,
  `email_confirm`), a `profile` (`role: 'admin'`), and an `organizationmember` in
  org `1a1dcddd-…` with **`role_id: 1` (ADMIN)** — load-bearing for `$currentOrg`
  to resolve and `/org/udemy-test` to render. Replaces the spec's `admin@test.com`,
  which the prod build force-logs-out (see routes.json note above / §11).
- 50 `group` (NOT NULL `name`) + 50 `course` under the org. Course slugs
  `perf-course-1..50`, `is_published: true`. Required `course` columns with no
  default: `title`, `description` (supply both); leave `status` to its default
  `'ACTIVE'`, `currency`/`logo`/`metadata`/`version` to defaults. **What makes
  `/course/perf-course-1` render publicly is `is_published: true` (the course RLS
  SELECT policy) + `status = 'ACTIVE'`** — `fetchCourse(undefined, slug)` matches
  on `slug` + `status='ACTIVE'`. (`is_template` is _not_ load-bearing here.)
- 500 `lesson` (10 per course; NOT NULL `title`, `course_id`).
- 5050 `groupmember`: 100 distinct students per course (`role_id: 3`) +
  `admin@test.com` as tutor (`role_id: 2`) on each of the 50. **Dedup the
  100-student sample per group** — `groupmember` has UNIQUE
  `(group_id, profile_id)` (and `(group_id, email)`), so a repeated student in one
  group fails the batch.

The slowness driver for `/lms/mylearning` is **not** a single student's enrollment
count (a student is in at most 50 courses). It is the `get_courses` RPC, which
returns one row per ACTIVE org course and runs three correlated subqueries per row
(lesson count, student count via the now-5050-row `groupmember`, completion count),
then PostgREST post-filters by `member_profile_id`. 50 courses × ~100 members each
under simulated CPU throttling is what produces PAGE_HUNG.

**Idempotency:** before seeding, detect existing seed data — any `course` with
`slug LIKE 'perf-course-%'` OR any `profile` with `email LIKE 'perf-student-%'`.
If found, print a status line and no-op (exit 0).

**Flags:**

- `--clean` — wipe all seed data, then reseed.
- `--clean-only` — wipe, do not reseed.

**Cleanup FK order** (no `ON DELETE CASCADE` from `profile`/`groupmember` →
`auth.users`/`profile`): `groupmember` → `lesson` → `course` → `group` →
`organizationmember` (perf rows) → `analytics_login_events` (perf user_ids — the
persona logins create these, and the FK to `auth.users` can otherwise RESTRICT the
delete) → `profile` (perf rows) → `auth.users` (perf rows, via
`auth.admin.deleteUser`). Scope every delete to the perf naming pattern so the
existing admin/student fixtures are never touched.

**Volume strategy:** batch inserts (chunks of ~500 rows) to avoid statement
limits; `auth.admin.createUser` is sequential/throttled, so log progress every
N users. The detection-key check keeps a re-run cheap.

---

## 9. README contents (required)

- **Quick start:** `pnpm seed:perf`, then build/serve (below), then
  `PERF_BASE_URL=http://localhost:3000 pnpm perf -- --save-baseline`, then
  `PERF_BASE_URL=http://localhost:3000 pnpm perf`.
- **Build/serve sequence** (hint #1, with gotchas spelled out):
  ```bash
  PUBLIC_IS_SELFHOSTED=true NODE_OPTIONS="--max-old-space-size=6144" \
    pnpm build --filter=@cio/dashboard
  cd apps/dashboard
  set -a; source .env; set +a
  PUBLIC_IS_SELFHOSTED=true PORT=3000 node build &
  ```
  Gotchas: `PUBLIC_IS_SELFHOSTED=true` at **both** build and start (switches the
  adapter; without it you get `.vercel/output/` and no `build/`); `node build`
  does **not** auto-load `.env`; the default 2 GB Node heap OOMs the build (hence
  `--max-old-space-size=6144`; on a smaller host drop to `4096`, and don't run
  `supabase`/`pnpm dev` concurrently — ~7.7 GB total RAM leaves little headroom).
- **Port 3000 conflict:** the `docs` app also defaults to `:3000`. Stop any
  `pnpm dev` / docs dev server before measuring, or the served origin will be the
  wrong app. The preflight asserts the origin is the dashboard (checks a known
  dashboard marker, not just HTTP 200) and exits 2 otherwise.
- **Headless Chrome flags** `--no-sandbox --disable-dev-shm-usage` are
  **mandatory** in this container (`/dev/shm` is 64 MB); benign dbus `ERROR` lines
  on stderr are not failures.
- **Env inputs:** `PERF_BASE_URL` (default `http://localhost:3000`),
  `PERF_CHROME_PATH` (optional override), and the seed's
  `PUBLIC_SUPABASE_URL`/`SUPABASE_URL` + `PRIVATE_SUPABASE_SERVICE_ROLE`/
  `SUPABASE_SERVICE_ROLE_KEY` read from `apps/dashboard/.env`.
- **`.prettierignore`** must exclude `perf/results` and `perf/baseline.json` so
  `pnpm format` doesn't rewrite generated LHR JSON.
- The perf student `perf-student-1@workshop.local` is created by `seed.mjs` and is
  distinct from the BDD `student@test.com` — the two suites have separate personas.
- **What's measured / gate thresholds / exit codes** (§§5–7).
- **Expected initial state:** `/lms/mylearning` is expected to PAGE_HUNG with null
  metrics in the first baseline — that is workshop content a later workshop fixes,
  not a harness bug, and the run still exits 0.

---

## 10. "Done when" (acceptance, from the prompt)

1. With prod on `:3000`, `PERF_BASE_URL=… pnpm perf -- --save-baseline` writes
   `perf/baseline.json`, exits 0; `/lms/mylearning` null + PAGE_HUNG is fine.
2. `PERF_BASE_URL=… pnpm perf` re-runs, exits 0, prints per-route metrics with
   near-zero deltas; null-vs-null on `/lms/mylearning` is not a regression.
3. `pnpm seed:perf` is idempotent — second run no-ops with a status line.
4. An authed route that renders (e.g. `/org/udemy-test`) has results-JSON
   `finalUrl` = the requested path, not `/login`.
5. `perf/README.md` documents the build/serve gotchas and the expected
   `/lms/mylearning` breakage.

---

## 11. Deliberate decisions where the spec was ambiguous

- **Playwright instead of Puppeteer** for login/storage control (§2) — Puppeteer
  isn't installed; the prompt's requirement is mechanism-level and tool-agnostic.
- **PAGE_HUNG vs Chrome-crash disambiguation** via the error-shape check (§7) —
  the prompt mandates both behaviours (record PAGE_HUNG, exit 2 on crash) but not
  how to tell them apart; "did Lighthouse return an `lhr`?" is the discriminator
  (chosen over a CDP liveness probe for simplicity).
- **Single-file runner** (§1) — `lighthouse.mjs` holds the whole runner; `gate.mjs`
  splits out only past ~300 lines. No `lib/` tree.
- **Port-based CDP wiring kept** (§2) — honours hint #4's literal `port: chrome.port`
  rather than collapsing to Lighthouse's `page`-arg recipe.
- **Admin persona changed to `perf-admin@workshop.local`** (§1 routes.json, §8 seed)
  — discovered during verification: the prod build's `appSetup.ts:79` runs
  `if (authUser.email.endsWith('@test.com') && !dev) window.location.href = '/logout'`,
  so the spec's `admin@test.com` is force-logged-out under `node build` and bounces
  `/login → /logout`, making its token uncapturable and the authed route
  unrenderable. The student already used a `workshop.local` email (dodging the
  guard); seeding a matching `workshop.local` org admin is the minimum-deviation
  fix that keeps the admin route a real authenticated measurement (done-when #4).
  Per-persona login uses a fresh `chromium.launch()` browser to avoid cross-session
  bleed (§4).
- **Fresh browser per persona login** (§4) — each `captureToken` runs in its own
  throwaway `chromium.launch()` instance, mirroring `storage-state.ts`, so a prior
  persona's session can't linger and bounce `/login → /logout`. The captured token
  is injected into the separate chrome-launcher instance Lighthouse drives.
- **totalBytes from `network-requests`** (not `resource-summary`) so JS and total
  share one source (§5).

---

## 12. Risks & verification notes (from validation)

- **Gate-threshold noise floor.** The +1% JS-byte and `max(+100ms, +5%)` LCP gates
  assume back-to-back runs are stable. `transferSize` is over-the-wire bytes, so a
  304 / memory-cache hit would collapse it and thrash the +1% gate; the per-route
  `Network.clearBrowserCache` is what keeps loads cold. Before trusting a baseline,
  do a sanity two-run comparison (the "done when #2 near-zero deltas" check serves
  this) and confirm JS-byte deltas sit well under 1% and LCP under the 100ms floor.
- **`results/` growth.** Each route writes a full LHR JSON per run into gitignored
  `results/`; this is an accepted, unbounded local cost. Pruning (keep-last-N /
  `--clean-results`) is a possible follow-up, not in scope now.
- **Harness unit-testability.** The pure functions — metric extraction (§5), the
  gate math (§6), path sanitization (§5) — should be written so they can be
  exercised against a committed sample `lhr.json` without launching Chrome or the
  prod build. Not a required deliverable, but the cheapest place to catch
  null-handling and `(path, as)`-matching bugs.

```

```
